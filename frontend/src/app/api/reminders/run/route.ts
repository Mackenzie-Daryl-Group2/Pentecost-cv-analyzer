import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getServerEnv } from "../../signup/_lib/server-env";
import { getUserRole } from "@/utils/roles";
import { mergeTemplate, textToHtml } from "@/utils/email-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function client() {
  const url = getServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase server credentials are not configured.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function authorized(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cronSecret = getServerEnv("CRON_SECRET");
  if (cronSecret && bearer === cronSecret) return { db: client(), actor: "cron" };
  if (!bearer) return null;
  const db = client();
  const { data, error } = await db.auth.getUser(bearer);
  if (error || !data.user || !["hr", "admin"].includes(getUserRole(data.user))) return null;
  return { db, actor: data.user.email || getUserRole(data.user) };
}

function mailer() {
  const user = getServerEnv("SMTP_USER");
  const pass = getServerEnv("SMTP_PASSWORD");
  const host = getServerEnv("SMTP_HOST");
  const port = Number(getServerEnv("SMTP_PORT") || 587);
  const secure = getServerEnv("SMTP_SECURE") === "true";
  if (!user || !pass) throw new Error("SMTP credentials are not configured.");
  return nodemailer.createTransport(host
    ? { host, port, secure, auth: { user, pass } }
    : { service: "gmail", auth: { user, pass } });
}

async function execute(req: NextRequest) {
  try {
    const auth = await authorized(req);
    if (!auth) return NextResponse.json({ error: "Reminder runner access denied." }, { status: 403 });
    const now = new Date();
    const interviewFrom = new Date(now.getTime() + 23 * 3600000).toISOString();
    const interviewTo = new Date(now.getTime() + 25 * 3600000).toISOString();
    const referenceTo = new Date(now.getTime() + 48 * 3600000).toISOString();
    const [{ data: interviews }, { data: references }, { data: templates }] = await Promise.all([
      auth.db.from("applications").select("id,name,full_name,email,job_id,interview_scheduled_at,interview_meet_link,status,interview_passed")
        .gte("interview_scheduled_at", interviewFrom).lte("interview_scheduled_at", interviewTo),
      auth.db.from("reference_requests").select("*").eq("status", "Pending").lte("due_at", referenceTo),
      auth.db.from("email_templates").select("*").eq("is_active", true),
    ]);
    const transport = mailer();
    const from = getServerEnv("SMTP_FROM") || getServerEnv("SMTP_USER");
    let sent = 0;
    let skipped = 0;

    for (const application of interviews || []) {
      if (!application.email || application.interview_passed === true || application.interview_passed === false) continue;
      const key = `interview:${application.id}:${application.interview_scheduled_at}`;
      const { data: existing } = await auth.db.from("reminder_deliveries").select("id").eq("reminder_key", key).maybeSingle();
      if (existing) { skipped += 1; continue; }
      const { data: job } = await auth.db.from("jobs").select("title").eq("id", application.job_id).maybeSingle();
      const template = (templates || []).find((item: any) => item.name === "Interview reminder" || item.category === "reminder");
      const values = {
        candidate_name: application.name || application.full_name || "Applicant",
        job_title: job?.title || `Position ${application.job_id}`,
        interview_time: new Date(application.interview_scheduled_at).toLocaleString(),
        meeting_link: application.interview_meet_link || "Sign in to the portal for meeting details",
      };
      await transport.sendMail({
        from: `"Pentecost Recruitment" <${from}>`,
        to: application.email,
        subject: mergeTemplate(template?.subject || "Interview reminder: {{job_title}}", values),
        html: textToHtml(mergeTemplate(template?.body || "Your interview is scheduled for {{interview_time}}. {{meeting_link}}", values)),
      });
      await auth.db.from("reminder_deliveries").insert({
        reminder_key: key, reminder_type: "interview", application_id: String(application.id),
        recipient: application.email, metadata: { scheduled_at: application.interview_scheduled_at },
      });
      sent += 1;
    }

    for (const reference of references || []) {
      if (!reference.referee_email || reference.reminders_sent >= 3) continue;
      const dayKey = now.toISOString().slice(0, 10);
      const key = `reference:${reference.id}:${dayKey}`;
      const { data: existing } = await auth.db.from("reminder_deliveries").select("id").eq("reminder_key", key).maybeSingle();
      if (existing) { skipped += 1; continue; }
      const link = `${new URL(req.url).origin}/reference/${reference.token}`;
      await transport.sendMail({
        from: `"Pentecost Recruitment" <${from}>`,
        to: reference.referee_email,
        subject: "Reminder: Pentecost University reference request",
        html: textToHtml(`Hello ${reference.referee_name},\n\nThis is a reminder to complete the requested employment reference by ${new Date(reference.due_at).toLocaleDateString()}:\n\n${link}\n\nPentecost University HR`),
      });
      await auth.db.from("reference_requests").update({
        reminders_sent: Number(reference.reminders_sent || 0) + 1,
        last_reminder_at: now.toISOString(),
        updated_at: now.toISOString(),
      }).eq("id", reference.id);
      await auth.db.from("reminder_deliveries").insert({
        reminder_key: key, reminder_type: "reference", application_id: reference.application_id,
        reference_request_id: reference.id, recipient: reference.referee_email,
      });
      sent += 1;
    }

    return NextResponse.json({ success: true, sent, skipped, runAt: now.toISOString(), actor: auth.actor });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Reminder run failed." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return execute(req);
}

export async function POST(req: NextRequest) {
  return execute(req);
}

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getServerEnv } from "../../signup/_lib/server-env";
import { getUserRole } from "@/utils/roles";
import { mergeTemplate, textToHtml } from "@/utils/email-template";

export const runtime = "nodejs";

function adminClient() {
  const url = getServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase server credentials are not configured.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function requireManager(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const client = adminClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || !["hr", "admin"].includes(getUserRole(data.user))) return null;
  return { client, user: data.user, role: getUserRole(data.user) };
}

function transporter() {
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

export async function GET(req: NextRequest) {
  try {
    const auth = await requireManager(req);
    if (!auth) return NextResponse.json({ error: "HR or Admin access is required." }, { status: 403 });
    const [{ data: templates, error: templateError }, { data: references, error: referenceError }, { data: reminders, error: reminderError }, { data: logs, error: logError }] = await Promise.all([
      auth.client.from("email_templates").select("*").order("updated_at", { ascending: false }),
      auth.client.from("reference_requests").select("*").order("created_at", { ascending: false }),
      auth.client.from("reminder_deliveries").select("*").order("sent_at", { ascending: false }).limit(100),
      auth.client.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    const missing = [templateError, referenceError, reminderError, logError].some((error: any) =>
      error && ["42P01", "PGRST205"].includes(String(error.code || ""))
    );
    if (missing) return NextResponse.json({ templates: [], references: [], reminders: [], setupRequired: true });
    if (templateError) throw templateError;
    if (referenceError) throw referenceError;
    if (reminderError) throw reminderError;
    if (logError) throw logError;
    return NextResponse.json({ templates: templates || [], references: references || [], reminders: reminders || [], logs: logs || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Operations data could not be loaded." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireManager(req);
    if (!auth) return NextResponse.json({ error: "HR or Admin access is required." }, { status: 403 });
    const body = await req.json();

    if (body.action === "save-template") {
      const record = {
        name: String(body.name || "").trim().slice(0, 120),
        category: String(body.category || "general"),
        subject: String(body.subject || "").trim().slice(0, 200),
        body: String(body.body || "").trim().slice(0, 10000),
        is_active: body.isActive !== false,
        created_by: auth.user.id,
        updated_at: new Date().toISOString(),
      };
      if (!record.name || !record.subject || !record.body) {
        return NextResponse.json({ error: "Template name, subject, and body are required." }, { status: 400 });
      }
      const query = body.id
        ? auth.client.from("email_templates").update(record).eq("id", body.id)
        : auth.client.from("email_templates").insert(record);
      const { data, error } = await query.select("*").single();
      if (error) throw error;
      return NextResponse.json({ template: data });
    }

    if (body.action === "delete-template") {
      const { error } = await auth.client.from("email_templates").delete().eq("id", body.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (body.action === "send-reference") {
      const applicationId = String(body.applicationId || "");
      const refereeName = String(body.refereeName || "").trim();
      const refereeEmail = String(body.refereeEmail || "").trim().toLowerCase();
      if (!applicationId || !refereeName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(refereeEmail)) {
        return NextResponse.json({ error: "A candidate, referee name, and valid referee email are required." }, { status: 400 });
      }
      const { data: application, error: applicationError } = await auth.client
        .from("applications").select("id,name,full_name,email,job_id").eq("id", applicationId).single();
      if (applicationError) throw applicationError;
      const { data: job } = await auth.client.from("jobs").select("title").eq("id", application.job_id).maybeSingle();
      const dueAt = body.dueAt ? new Date(body.dueAt).toISOString() : new Date(Date.now() + 7 * 86400000).toISOString();
      const { data: reference, error } = await auth.client.from("reference_requests").insert({
        application_id: applicationId,
        referee_name: refereeName,
        referee_email: refereeEmail,
        relationship: String(body.relationship || "").trim() || null,
        due_at: dueAt,
        sent_at: new Date().toISOString(),
        created_by: auth.user.id,
      }).select("*").single();
      if (error) throw error;

      const origin = new URL(req.url).origin;
      const values = {
        candidate_name: application.name || application.full_name || "the candidate",
        referee_name: reference.referee_name,
        job_title: job?.title || `Position ${application.job_id}`,
        due_date: new Date(dueAt).toLocaleDateString(),
        reference_link: `${origin}/reference/${reference.token}`,
      };
      const { data: template } = await auth.client.from("email_templates").select("*").eq("category", "reference").eq("is_active", true).limit(1).maybeSingle();
      const subject = mergeTemplate(template?.subject || "Reference request for {{candidate_name}}", values);
      const content = mergeTemplate(template?.body || "Please complete this reference: {{reference_link}}", values);
      const from = getServerEnv("SMTP_FROM") || getServerEnv("SMTP_USER");
      await transporter().sendMail({ from: `"Pentecost Recruitment" <${from}>`, to: reference.referee_email, subject, html: textToHtml(content) });
      await auth.client.from("activity_logs").insert({
        actor_id: auth.user.id,
        actor_email: auth.user.email,
        actor_role: auth.role,
        action: "reference_request_sent",
        entity_type: "application",
        entity_id: applicationId,
        description: `Reference request sent to ${reference.referee_email}.`,
        metadata: { reference_request_id: reference.id },
      });
      return NextResponse.json({ reference });
    }

    return NextResponse.json({ error: "Unsupported operations action." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Operations action failed." }, { status: 500 });
  }
}

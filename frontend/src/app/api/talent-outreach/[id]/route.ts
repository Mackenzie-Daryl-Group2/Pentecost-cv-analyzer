import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getServerEnv } from "../../signup/_lib/server-env";
import { getUserRole } from "@/utils/roles";

export const runtime = "nodejs";

function adminClient() {
  const url = getServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase server credentials are not configured.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const client = adminClient();
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user || !["hr", "admin"].includes(getUserRole(userData.user))) {
      return NextResponse.json({ error: "HR access is required." }, { status: 403 });
    }

    const { id } = await context.params;
    const { data: application, error: applicationError } = await client
      .from("applications")
      .select("id,email,name,full_name,talent_pool_consent")
      .eq("id", id)
      .single();
    if (applicationError) throw applicationError;
    if (!application.talent_pool_consent) {
      return NextResponse.json({ error: "The candidate has not consented to talent-pool contact." }, { status: 403 });
    }
    if (!application.email) {
      return NextResponse.json({ error: "The candidate has no email address on file." }, { status: 400 });
    }

    const body = await req.json();
    const subject = String(body.subject || "").trim().slice(0, 200);
    const html = String(body.html || "").trim();
    const jobIds = Array.isArray(body.jobIds) ? body.jobIds.map(Number).filter(Number.isFinite) : [];
    if (!subject || !html || !jobIds.length) {
      return NextResponse.json({ error: "Subject, email content, and at least one vacancy are required." }, { status: 400 });
    }

    const { data: selectedJobs, error: jobsError } = await client
      .from("jobs")
      .select("id")
      .in("id", jobIds);
    if (jobsError || !selectedJobs?.length) {
      return NextResponse.json({ error: "The selected vacancies could not be verified." }, { status: 400 });
    }

    const smtpUser = getServerEnv("SMTP_USER");
    const smtpPassword = getServerEnv("SMTP_PASSWORD");
    const smtpHost = getServerEnv("SMTP_HOST");
    const smtpPort = Number(getServerEnv("SMTP_PORT") || 587);
    const smtpSecure = getServerEnv("SMTP_SECURE") === "true";
    const smtpFrom = getServerEnv("SMTP_FROM") || smtpUser;
    if (!smtpUser || !smtpPassword) {
      return NextResponse.json({ error: "SMTP credentials are not configured." }, { status: 503 });
    }

    const transporter = nodemailer.createTransport(
      smtpHost
        ? {
            host: smtpHost,
            port: Number.isFinite(smtpPort) ? smtpPort : 587,
            secure: smtpSecure,
            auth: { user: smtpUser, pass: smtpPassword },
          }
        : { service: "gmail", auth: { user: smtpUser, pass: smtpPassword } }
    );
    await transporter.sendMail({
      from: `"Pentecost Recruitment" <${smtpFrom}>`,
      to: application.email,
      subject,
      html,
    });

    return NextResponse.json({ success: true, recipient: application.email });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Talent outreach could not be sent." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getServerEnv } from "../../signup/_lib/server-env";

export const runtime = "nodejs";

function env(name: string) {
  return String(getServerEnv(name) || "").trim();
}

function splitEmails(value: string) {
  return value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function uniqueEmails(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.flatMap((value) => splitEmails(String(value || "")))));
}

function escapeHtml(value?: string | null) {
  return String(value || "").replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export async function POST(req: NextRequest) {
  try {
    const {
      candidateName,
      candidateEmail,
      candidatePhone,
      roleTitle,
      scheduledAt,
      meetLink,
      calendarEventLink,
      notes,
      organizerEmail,
    } = await req.json();

    const recipients = uniqueEmails([organizerEmail, env("INTERVIEW_STAKEHOLDER_EMAILS")]);
    if (!recipients.length) {
      return NextResponse.json({ success: true, recipients: [], skipped: true });
    }

    const smtpUser = env("SMTP_USER");
    const smtpPassword = env("SMTP_PASSWORD");
    const smtpHost = env("SMTP_HOST");
    const smtpPort = Number(env("SMTP_PORT") || 587);
    const smtpSecure = env("SMTP_SECURE") === "true";
    const smtpFrom = env("SMTP_FROM") || smtpUser;

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
        : {
            service: "gmail",
            auth: { user: smtpUser, pass: smtpPassword },
          }
    );

    await transporter.sendMail({
      from: `"Pentecost Recruitment" <${smtpFrom}>`,
      to: recipients,
      subject: `Interview Scheduled: ${String(roleTitle || "Applicant Interview")}`,
      html: `
        <h2>Interview Scheduled</h2>
        <p>An interview has been scheduled for <strong>${escapeHtml(candidateName || "Applicant")}</strong>.</p>
        <p><strong>Role:</strong> ${escapeHtml(roleTitle || "Role not specified")}</p>
        <p><strong>Date and time:</strong> ${escapeHtml(formatDate(scheduledAt))}</p>
        ${candidateEmail ? `<p><strong>Applicant email:</strong> ${escapeHtml(candidateEmail)}</p>` : ""}
        ${candidatePhone ? `<p><strong>Applicant phone:</strong> ${escapeHtml(candidatePhone)}</p>` : ""}
        ${meetLink ? `<p><strong>Meeting link:</strong> <a href="${escapeHtml(meetLink)}">${escapeHtml(meetLink)}</a></p>` : ""}
        ${calendarEventLink ? `<p><strong>Calendar event:</strong> <a href="${escapeHtml(calendarEventLink)}">Open event</a></p>` : ""}
        ${notes ? `<p><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ""}
        <p>Please keep this meeting available on your calendar.</p>
      `,
    });

    return NextResponse.json({ success: true, recipients });
  } catch (error: any) {
    console.error("Staff interview notification failed:", error);
    return NextResponse.json({ error: error.message || "Staff notification could not be sent." }, { status: 500 });
  }
}

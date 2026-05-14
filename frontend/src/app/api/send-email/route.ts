import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { to, subject, html } = await req.json();
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpSecure = process.env.SMTP_SECURE === "true";
    const smtpFrom = process.env.SMTP_FROM || smtpUser;

    if (!to || !subject || !html) {
      return NextResponse.json({ error: "Missing email recipient, subject, or body" }, { status: 400 });
    }

    if (!smtpUser || !smtpPassword) {
      return NextResponse.json(
        { error: "SMTP credentials are not configured. Add SMTP_USER and SMTP_PASSWORD in Vercel environment variables." },
        { status: 503 }
      );
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
            service: 'gmail',
            auth: { user: smtpUser, pass: smtpPassword },
          }
    );

    await transporter.sendMail({
      from: `"Pentecost Recruitment" <${smtpFrom}>`,
      to,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return NextResponse.json({ error: error.message || "Email could not be sent" }, { status: 500 });
  }
}

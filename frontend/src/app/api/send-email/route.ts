import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  try {
    const { to, subject, html } = await req.json();

    // Nodemailer configuration using Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        // We will tell the user to put their Gmail credentials in .env.local
        // For fallback we can grab it from existing env variables if they match
        user: process.env.SMTP_USER || process.env.NEXT_PUBLIC_SMTP_USER,
        pass: process.env.SMTP_PASSWORD || process.env.NEXT_PUBLIC_SMTP_PASSWORD,
      },
    });

    // Check if credentials exist
    if (!transporter.options.auth?.user || !transporter.options.auth?.pass) {
      console.warn("SMTP credentials not configured in .env.local. Simulating email send.");
      console.log(`[SIMULATED EMAIL] To: ${to}\nSubject: ${subject}\nHTML: ${html}`);
      return NextResponse.json({ success: true, simulated: true });
    }

    await transporter.sendMail({
      from: `"Pentecost Recruitment" <${transporter.options.auth.user}>`,
      to,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

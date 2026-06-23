import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import nodemailer from "nodemailer";
import {
  encryptPendingSignup,
  hashSignupCode,
  pendingSignupCookieName,
} from "../_lib/pending-signup";
import { getServerEnv } from "../_lib/server-env";

export const runtime = "nodejs";

async function sendVerificationEmail(to: string, username: string, code: string) {
  const smtpUser = getServerEnv("SMTP_USER");
  const smtpPassword = getServerEnv("SMTP_PASSWORD");
  const smtpHost = getServerEnv("SMTP_HOST");
  const smtpPort = Number(getServerEnv("SMTP_PORT") || 587);
  const smtpSecure = getServerEnv("SMTP_SECURE") === "true";
  const smtpFrom = getServerEnv("SMTP_FROM") || smtpUser;

  if (!smtpUser || !smtpPassword) {
    throw new Error("SMTP credentials are not configured.");
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
    to,
    subject: "Your Pentecost Recruitment verification code",
    html: `
      <h2>Verify your Pentecost Recruitment account</h2>
      <p>Hi ${username},</p>
      <p>Use this verification code to finish creating your account:</p>
      <p style="font-size: 28px; font-weight: 800; letter-spacing: 6px;">${code}</p>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not request this account, you can ignore this email.</p>
    `,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { username, email, password } = await req.json();
    const cleanUsername = String(username || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "");

    if (!cleanUsername || !cleanEmail || !cleanPassword) {
      return NextResponse.json({ error: "Username, email, and password are required." }, { status: 400 });
    }

    if (cleanPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const code = String(randomInt(100000, 1000000));
    const pendingSignupToken = encryptPendingSignup({
      username: cleanUsername,
      email: cleanEmail,
      password: cleanPassword,
      codeHash: hashSignupCode(cleanEmail, code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    await sendVerificationEmail(cleanEmail, cleanUsername, code);

    const response = NextResponse.json({ success: true, method: "Email" });
    response.cookies.set(pendingSignupCookieName, pendingSignupToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: getServerEnv("NODE_ENV") === "production",
      path: "/",
      maxAge: 10 * 60,
    });

    return response;
  } catch (error: any) {
    console.error("Signup verification request failed:", error);
    return NextResponse.json({ error: error.message || "Verification code could not be sent." }, { status: 500 });
  }
}

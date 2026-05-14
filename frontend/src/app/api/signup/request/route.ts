import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import nodemailer from "nodemailer";
import {
  encryptPendingSignup,
  hashSignupCode,
  pendingSignupCookieName,
  SignupDeliveryMethod,
} from "../_lib/pending-signup";
import { getServerEnv } from "../_lib/server-env";

export const runtime = "nodejs";

function normalizeDeliveryMethod(value: unknown): SignupDeliveryMethod {
  return String(value || "Email").toLowerCase() === "sms" ? "SMS" : "Email";
}

function normalizePhone(value: unknown) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  return digits ? `${raw.startsWith("+") ? "+" : ""}${digits}` : "";
}

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

async function sendVerificationSms(to: string, code: string) {
  const accountSid = getServerEnv("TWILIO_ACCOUNT_SID");
  const authToken = getServerEnv("TWILIO_AUTH_TOKEN");
  const fromNumber = getServerEnv("TWILIO_FROM_NUMBER");

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("Twilio SMS credentials are not configured.");
  }

  const body = new URLSearchParams({
    From: fromNumber,
    To: to,
    Body: `Pentecost Recruitment verification code: ${code}. It expires in 10 minutes.`,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "SMS verification code could not be sent.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { username, email, password, phone, verificationMethod } = await req.json();
    const cleanUsername = String(username || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "");
    const cleanPhone = normalizePhone(phone);
    const deliveryMethod = normalizeDeliveryMethod(verificationMethod);

    if (!cleanUsername || !cleanEmail || !cleanPassword) {
      return NextResponse.json({ error: "Username, email, and password are required." }, { status: 400 });
    }

    if (cleanPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    if (deliveryMethod === "SMS" && !/^\+\d{8,15}$/.test(cleanPhone)) {
      return NextResponse.json({ error: "A valid phone number with country code is required for SMS verification." }, { status: 400 });
    }

    const code = String(randomInt(100000, 1000000));
    const pendingSignupToken = encryptPendingSignup({
      username: cleanUsername,
      email: cleanEmail,
      password: cleanPassword,
      phone: cleanPhone,
      deliveryMethod,
      codeHash: hashSignupCode(cleanEmail, code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (deliveryMethod === "SMS") {
      await sendVerificationSms(cleanPhone, code);
    } else {
      await sendVerificationEmail(cleanEmail, cleanUsername, code);
    }

    const response = NextResponse.json({ success: true, method: deliveryMethod });
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

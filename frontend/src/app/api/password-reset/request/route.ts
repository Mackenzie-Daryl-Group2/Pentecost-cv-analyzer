import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { getServerEnv } from "../../signup/_lib/server-env";
import {
  encryptPendingPasswordReset,
  hashResetCode,
  pendingPasswordResetCookieName,
} from "../_lib/pending-reset";

export const runtime = "nodejs";

function getAdminClient() {
  const supabaseUrl = getServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin credentials are not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function findUserByEmail(email: string) {
  const supabase = getAdminClient();
  const normalizedEmail = email.toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) throw error;

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === normalizedEmail);
    if (user) return user;
    if (data.users.length < 1000) return null;

    page += 1;
  }
}

async function sendResetCodeEmail(to: string, code: string) {
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
    subject: "Your Pentecost password reset code",
    html: `
      <h2>Password Reset Code</h2>
      <p>Use this code to reset your Pentecost Recruitment password:</p>
      <p style="font-size: 28px; font-weight: 800; letter-spacing: 6px;">${code}</p>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not request a password reset, you can ignore this email.</p>
    `,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json({ error: "A valid account email is required." }, { status: 400 });
    }

    const user = await findUserByEmail(cleanEmail);
    if (!user?.id || !user.email) {
      return NextResponse.json({ error: "No account was found for that email address." }, { status: 404 });
    }

    const code = String(randomInt(100000, 1000000));
    const pendingResetToken = encryptPendingPasswordReset({
      email: cleanEmail,
      userId: user.id,
      codeHash: hashResetCode(cleanEmail, code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    await sendResetCodeEmail(cleanEmail, code);

    const response = NextResponse.json({ success: true });
    response.cookies.set(pendingPasswordResetCookieName, pendingResetToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: getServerEnv("NODE_ENV") === "production",
      path: "/",
      maxAge: 10 * 60,
    });

    return response;
  } catch (error: any) {
    console.error("Password reset code request failed:", error);
    return NextResponse.json({ error: error.message || "Password reset code could not be sent." }, { status: 500 });
  }
}

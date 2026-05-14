import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { getServerEnv } from "../../signup/_lib/server-env";
import {
  codeHashesMatch,
  decryptPendingPasswordReset,
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

async function sendPasswordResetConfirmation(to: string) {
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
    subject: "Pentecost password reset confirmation",
    html: `
      <h2>Password Reset Successful</h2>
      <p>Your Pentecost Recruitment account password has been changed successfully.</p>
      <p>If you made this change, no further action is needed.</p>
      <p>If you did not reset your password, please contact the recruitment office immediately.</p>
    `,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { email, code, password } = await req.json();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanCode = String(code || "").trim();
    const cleanPassword = String(password || "");
    const pendingResetCookie = req.cookies.get(pendingPasswordResetCookieName)?.value;

    if (!cleanEmail || !cleanCode || !cleanPassword) {
      return NextResponse.json({ error: "Email, reset code, and new password are required." }, { status: 400 });
    }

    if (cleanPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    if (!pendingResetCookie) {
      return NextResponse.json({ error: "No pending password reset was found. Please request a new code." }, { status: 400 });
    }

    const pendingReset = decryptPendingPasswordReset(pendingResetCookie);

    if (pendingReset.email !== cleanEmail) {
      return NextResponse.json({ error: "This code was requested for a different email address." }, { status: 400 });
    }

    if (Date.now() > new Date(pendingReset.expiresAt).getTime()) {
      return NextResponse.json({ error: "Reset code expired. Please request a new code." }, { status: 400 });
    }

    if (!codeHashesMatch(pendingReset.codeHash, hashResetCode(cleanEmail, cleanCode))) {
      return NextResponse.json({ error: "Invalid reset code." }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { error } = await supabase.auth.admin.updateUserById(pendingReset.userId, {
      password: cleanPassword,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    let confirmationEmailSent = false;
    try {
      await sendPasswordResetConfirmation(cleanEmail);
      confirmationEmailSent = true;
    } catch (emailError) {
      console.error("Password reset confirmation email failed:", emailError);
    }

    const response = NextResponse.json({ success: true, confirmationEmailSent });
    response.cookies.delete(pendingPasswordResetCookieName);
    return response;
  } catch (error: any) {
    console.error("Password reset code verification failed:", error);
    return NextResponse.json({ error: error.message || "Password could not be reset." }, { status: 500 });
  }
}

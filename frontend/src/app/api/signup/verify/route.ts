import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  codeHashesMatch,
  decryptPendingSignup,
  hashSignupCode,
  pendingSignupCookieName,
} from "../_lib/pending-signup";
import { getServerEnv } from "../_lib/server-env";

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

async function findUserByEmail(supabase: ReturnType<typeof getAdminClient>, email: string) {
  const normalizedEmail = email.toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) throw error;

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === normalizedEmail
    );
    if (user) return user;
    if (data.users.length < 1000) return null;

    page += 1;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email, token } = await req.json();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanToken = String(token || "").trim();
    const pendingSignupCookie = req.cookies.get(pendingSignupCookieName)?.value;

    if (!cleanEmail || !cleanToken) {
      return NextResponse.json({ error: "Email and verification code are required." }, { status: 400 });
    }

    if (!pendingSignupCookie) {
      return NextResponse.json({ error: "No pending signup was found. Please request a new code." }, { status: 400 });
    }

    const pendingSignup = decryptPendingSignup(pendingSignupCookie);

    if (pendingSignup.email !== cleanEmail) {
      return NextResponse.json({ error: "This code was requested for a different email address." }, { status: 400 });
    }

    if (Date.now() > new Date(pendingSignup.expiresAt).getTime()) {
      return NextResponse.json({ error: "Verification code expired. Please request a new code." }, { status: 400 });
    }

    if (!codeHashesMatch(pendingSignup.codeHash, hashSignupCode(cleanEmail, cleanToken))) {
      return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
    }

    const supabase = getAdminClient();
    const existingUser = await findUserByEmail(supabase, cleanEmail);
    const metadata = {
      username: pendingSignup.username,
      full_name: pendingSignup.username,
      phone: pendingSignup.phone,
      role: "user",
    };

    if (existingUser?.email_confirmed_at || existingUser?.confirmed_at) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please log in." },
        { status: 409 }
      );
    }

    if (existingUser) {
      const { error } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: pendingSignup.password,
        email_confirm: true,
        user_metadata: {
          ...(existingUser.user_metadata || {}),
          ...metadata,
        },
        app_metadata: {
          ...(existingUser.app_metadata || {}),
          role: "user",
        },
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    } else {
      const { error } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: pendingSignup.password,
        email_confirm: true,
        user_metadata: metadata,
        app_metadata: { role: "user" },
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete(pendingSignupCookieName);
    return response;
  } catch (error: any) {
    console.error("Signup verification failed:", error);
    return NextResponse.json({ error: error.message || "Verification failed." }, { status: 500 });
  }
}

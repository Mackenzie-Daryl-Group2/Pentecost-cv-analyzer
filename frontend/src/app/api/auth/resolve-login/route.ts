import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "../../signup/_lib/server-env";

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

async function findUserByUsername(username: string) {
  const supabase = getAdminClient();
  const normalizedUsername = username.trim().toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) throw error;

    const user = data.users.find((candidate) => {
      const metadataUsername = String(candidate.user_metadata?.username || "").trim().toLowerCase();
      return metadataUsername === normalizedUsername;
    });

    if (user) return user;
    if (data.users.length < 1000) return null;

    page += 1;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { identifier } = await req.json();
    const cleanIdentifier = String(identifier || "").trim();

    if (!cleanIdentifier) {
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }

    if (cleanIdentifier.includes("@") || cleanIdentifier.startsWith("+")) {
      return NextResponse.json({ identifier: cleanIdentifier });
    }

    const user = await findUserByUsername(cleanIdentifier);

    if (!user?.email) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 404 });
    }

    return NextResponse.json({ email: user.email });
  } catch (error: any) {
    console.error("Login identifier resolution failed:", error);
    return NextResponse.json({ error: "Login could not be resolved." }, { status: 500 });
  }
}

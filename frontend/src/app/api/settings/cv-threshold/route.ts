import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "../../signup/_lib/server-env";
import { getUserRole } from "@/utils/roles";

export const runtime = "nodejs";

function adminClient() {
  const url = getServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase server credentials are not configured.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function requireRecruitmentManager(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const client = adminClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const role = getUserRole(data.user);
  return role === "hr" || role === "admin" ? { client, user: data.user } : null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRecruitmentManager(req);
    if (!auth) return NextResponse.json({ error: "HR or Admin access required." }, { status: 403 });

    const { data, error } = await auth.client
      .from("recruitment_settings")
      .select("cv_pass_threshold")
      .eq("id", 1)
      .maybeSingle();
    if (error && ["42P01", "PGRST205"].includes(String(error.code || ""))) {
      return NextResponse.json({ threshold: 55, setupRequired: true });
    }
    if (error) throw error;
    return NextResponse.json({ threshold: Number(data?.cv_pass_threshold || 55) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "CV threshold could not be loaded." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireRecruitmentManager(req);
    if (!auth) return NextResponse.json({ error: "HR or Admin access required." }, { status: 403 });

    const threshold = Number((await req.json()).threshold);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
      return NextResponse.json({ error: "CV pass threshold must be between 0 and 100." }, { status: 400 });
    }

    const { error } = await auth.client.from("recruitment_settings").upsert({
      id: 1,
      cv_pass_threshold: Math.round(threshold),
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    });
    if (error && ["42P01", "PGRST205"].includes(String(error.code || ""))) {
      return NextResponse.json(
        {
          error: "Recruitment settings are not installed yet. Run frontend/supabase/recruitment-settings.sql in the active Supabase project.",
          setupRequired: true,
        },
        { status: 503 }
      );
    }
    if (error) throw error;

    return NextResponse.json({ success: true, threshold: Math.round(threshold) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "CV threshold could not be saved." }, { status: 500 });
  }
}

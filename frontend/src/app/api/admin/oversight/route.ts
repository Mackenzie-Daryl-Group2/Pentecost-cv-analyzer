import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "../../signup/_lib/server-env";
import { getUserRole, type AppRole } from "@/utils/roles";

export const runtime = "nodejs";

const assignableRoles: AppRole[] = ["user", "hr", "pro_vc", "admin", "registrar"];

function adminClient() {
  const url = getServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase server credentials are not configured.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const client = adminClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || getUserRole(data.user) !== "admin") return null;
  return { client, user: data.user };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    const url = new URL(req.url);
    const limit = Math.min(500, Math.max(25, Number(url.searchParams.get("limit") || 200)));
    const [{ data: profiles, error: profileError }, { data: logs, error: logError }] = await Promise.all([
      auth.client.from("profiles").select("*").order("created_at", { ascending: false }),
      auth.client.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(limit),
    ]);
    const missingSchema = [profileError, logError].some((error: any) =>
      error && ["42P01", "PGRST205"].includes(String(error.code || ""))
    );
    if (missingSchema) {
      return NextResponse.json({
        profiles: [],
        logs: [],
        setupRequired: true,
        setupMessage: "Run frontend/supabase/admin-oversight.sql in the active Supabase SQL Editor, then refresh the schema cache.",
      });
    }
    if (profileError) throw profileError;
    if (logError) throw logError;

    return NextResponse.json({ profiles: profiles || [], logs: logs || [], setupRequired: false });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Oversight data could not be loaded." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    const { userId, role } = await req.json();
    if (!userId || !assignableRoles.includes(role)) {
      return NextResponse.json({ error: "A valid user and role are required." }, { status: 400 });
    }
    if (userId === auth.user.id && role !== "admin") {
      return NextResponse.json({ error: "You cannot remove your own Admin access." }, { status: 400 });
    }

    const { data: target, error: targetError } = await auth.client.auth.admin.getUserById(userId);
    if (targetError || !target.user) throw targetError || new Error("User was not found.");

    const { error: updateError } = await auth.client.auth.admin.updateUserById(userId, {
      app_metadata: { ...(target.user.app_metadata || {}), role },
      user_metadata: { ...(target.user.user_metadata || {}), role },
    });
    if (updateError) throw updateError;

    await auth.client.from("profiles").update({ role, updated_at: new Date().toISOString() }).eq("id", userId);
    await auth.client.from("activity_logs").insert({
      actor_id: auth.user.id,
      actor_email: auth.user.email,
      actor_role: "admin",
      action: "user_role_updated",
      entity_type: "profile",
      entity_id: userId,
      description: `Changed ${target.user.email || "user"} role to ${role}.`,
      metadata: { previousRole: getUserRole(target.user), nextRole: role },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "User role could not be updated." }, { status: 500 });
  }
}

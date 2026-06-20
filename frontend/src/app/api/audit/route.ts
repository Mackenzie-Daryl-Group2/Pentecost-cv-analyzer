import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "../signup/_lib/server-env";
import { getUserRole } from "@/utils/roles";

export const runtime = "nodejs";

function adminClient() {
  const url = getServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase server credentials are not configured.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const client = adminClient();
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const body = await req.json();
    const action = String(body.action || "").trim().slice(0, 100);
    const description = String(body.description || "").trim().slice(0, 500);
    if (!action || !description) {
      return NextResponse.json({ error: "Action and description are required." }, { status: 400 });
    }

    const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ipAddress = forwardedFor || req.headers.get("x-real-ip") || null;
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) || null;

    const { error: insertError } = await client.from("activity_logs").insert({
      actor_id: data.user.id,
      actor_email: data.user.email,
      actor_role: getUserRole(data.user),
      action,
      entity_type: body.entityType ? String(body.entityType).slice(0, 100) : null,
      entity_id: body.entityId ? String(body.entityId).slice(0, 200) : null,
      description,
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
      ip_address: ipAddress,
      user_agent: userAgent,
    });
    if (insertError) throw insertError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Activity could not be recorded." }, { status: 500 });
  }
}

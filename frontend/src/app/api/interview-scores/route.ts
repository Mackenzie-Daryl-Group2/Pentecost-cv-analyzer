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

async function authenticatedReviewer(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const client = adminClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;

  const role = getUserRole(data.user);
  if (!["hr", "registrar", "admin"].includes(role)) return null;
  return { client, user: data.user, role };
}

function criterion(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 25 ? Math.round(number) : null;
}

export async function GET(req: NextRequest) {
  try {
    const reviewer = await authenticatedReviewer(req);
    if (!reviewer) return NextResponse.json({ error: "Reviewer access is required." }, { status: 403 });

    let query = reviewer.client
      .from("interview_panel_scores")
      .select("*")
      .order("updated_at", { ascending: false });

    const applicationId = req.nextUrl.searchParams.get("applicationId");
    if (applicationId) query = query.eq("application_id", applicationId);
    if (reviewer.role === "registrar") query = query.eq("reviewer_id", reviewer.user.id);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ scores: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Interview scores could not be loaded." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const reviewer = await authenticatedReviewer(req);
    if (!reviewer) return NextResponse.json({ error: "Reviewer access is required." }, { status: 403 });

    const body = await req.json();
    const applicationId = String(body.applicationId || "").trim();
    const communication = criterion(body.communication);
    const roleKnowledge = criterion(body.roleKnowledge);
    const experience = criterion(body.experience);
    const cultureFit = criterion(body.cultureFit);

    if (!applicationId || [communication, roleKnowledge, experience, cultureFit].some((value) => value === null)) {
      return NextResponse.json({ error: "Each scoring criterion must be between 0 and 25." }, { status: 400 });
    }

    const totalScore = communication! + roleKnowledge! + experience! + cultureFit!;
    const record = {
      application_id: applicationId,
      reviewer_id: reviewer.user.id,
      reviewer_email: reviewer.user.email,
      reviewer_role: reviewer.role,
      communication,
      role_knowledge: roleKnowledge,
      experience,
      culture_fit: cultureFit,
      total_score: totalScore,
      notes: String(body.notes || "").trim().slice(0, 2000) || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await reviewer.client
      .from("interview_panel_scores")
      .upsert(record, { onConflict: "application_id,reviewer_id" })
      .select("*")
      .single();
    if (error) throw error;

    await reviewer.client
      .from("applications")
      .update({ status: "Interview Scored" })
      .eq("id", applicationId);

    await reviewer.client.from("activity_logs").insert({
      actor_id: reviewer.user.id,
      actor_email: reviewer.user.email,
      actor_role: reviewer.role,
      action: "interview_score_saved",
      entity_type: "application",
      entity_id: applicationId,
      description: `${reviewer.role} saved an interview score of ${totalScore}/100.`,
      metadata: { total_score: totalScore },
    });

    return NextResponse.json({ score: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Interview score could not be saved." }, { status: 500 });
  }
}

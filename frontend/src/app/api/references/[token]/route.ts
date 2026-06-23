import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "../../signup/_lib/server-env";

export const runtime = "nodejs";

function client() {
  const url = getServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase server credentials are not configured.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function requestRecord(token: string) {
  const db = client();
  const { data: reference, error } = await db.from("reference_requests").select("*").eq("token", token).single();
  if (error) throw error;
  const { data: application } = await db.from("applications").select("id,name,full_name,job_id").eq("id", reference.application_id).single();
  const { data: job } = application ? await db.from("jobs").select("title").eq("id", application.job_id).maybeSingle() : { data: null };
  return { db, reference, application, job };
}

export async function GET(_: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const { reference, application, job } = await requestRecord(token);
    return NextResponse.json({
      reference: {
        refereeName: reference.referee_name,
        relationship: reference.relationship,
        status: reference.status,
        dueAt: reference.due_at,
        completedAt: reference.completed_at,
      },
      candidateName: application?.name || application?.full_name || "Candidate",
      jobTitle: job?.title || `Position ${application?.job_id || ""}`,
    });
  } catch {
    return NextResponse.json({ error: "This reference request is invalid or unavailable." }, { status: 404 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const { db, reference } = await requestRecord(token);
    if (reference.status === "Completed") return NextResponse.json({ error: "This reference was already submitted." }, { status: 409 });
    if (reference.due_at && new Date(reference.due_at).getTime() < Date.now()) {
      await db.from("reference_requests").update({ status: "Expired", updated_at: new Date().toISOString() }).eq("id", reference.id);
      return NextResponse.json({ error: "This reference request has expired." }, { status: 410 });
    }
    const body = await req.json();
    const response = {
      known_years: Math.max(0, Math.min(60, Number(body.knownYears || 0))),
      capacity: String(body.capacity || "").trim().slice(0, 300),
      reliability: Math.max(1, Math.min(5, Number(body.reliability || 0))),
      communication: Math.max(1, Math.min(5, Number(body.communication || 0))),
      integrity: Math.max(1, Math.min(5, Number(body.integrity || 0))),
      rehire: String(body.rehire || ""),
      strengths: String(body.strengths || "").trim().slice(0, 2000),
      concerns: String(body.concerns || "").trim().slice(0, 2000),
      declaration: Boolean(body.declaration),
    };
    if (!response.capacity || !response.rehire || !response.declaration) {
      return NextResponse.json({ error: "Complete all required fields and confirm the declaration." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const { error } = await db.from("reference_requests").update({
      response,
      status: "Completed",
      completed_at: now,
      updated_at: now,
    }).eq("id", reference.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Reference response could not be submitted." }, { status: 500 });
  }
}

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

async function contextFor(req: NextRequest, id: string) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const client = adminClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const applicationResponse = await client.from("applications").select("*").eq("id", id).single();
  if (applicationResponse.error) throw applicationResponse.error;
  const role = getUserRole(data.user);
  const ownsApplication = String(applicationResponse.data.email || "").toLowerCase() === String(data.user.email || "").toLowerCase();
  if (!ownsApplication && !["hr", "admin"].includes(role)) return null;
  return { client, user: data.user, role, application: applicationResponse.data, ownsApplication };
}

export async function PATCH(req: NextRequest, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await routeContext.params;
    const context = await contextFor(req, id);
    if (!context) return NextResponse.json({ error: "Application access is required." }, { status: 403 });
    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (context.ownsApplication) {
      if (body.action === "withdraw") {
        if (context.application.onboarding_status) {
          return NextResponse.json({ error: "Contact HR to withdraw after onboarding has started." }, { status: 400 });
        }
        updates.status = "Withdrawn by Applicant";
        updates.withdrawn_at = new Date().toISOString();
        updates.withdrawal_reason = String(body.reason || "").trim().slice(0, 500) || null;
      } else if (body.action === "preferences") {
        updates.talent_pool_consent = Boolean(body.talentPoolConsent);
        updates.talent_pool_added_at = body.talentPoolConsent ? new Date().toISOString() : null;
      } else if (body.action === "deletion-request") {
        updates.data_deletion_requested_at = new Date().toISOString();
      } else if (body.action === "replace-cv" && body.path) {
        if (context.application.interview_scheduled_at) {
          return NextResponse.json({ error: "The CV cannot be replaced after an interview is scheduled." }, { status: 400 });
        }
        updates.cv_path = String(body.path);
        updates.cv_replaced_at = new Date().toISOString();
        updates.status = "CV Updated - HR Review";
      } else if (body.action === "offer-response" && ["accepted", "declined"].includes(body.response)) {
        updates.offer_status = body.response === "accepted" ? "Accepted" : "Declined";
        updates.offer_responded_at = new Date().toISOString();
        if (body.response === "accepted") {
          updates.onboarding_status = "Offer Accepted";
          updates.status = "Awaiting Onboarding";
        }
      }
    }

    if (["hr", "admin"].includes(context.role) && body.action === "talent-pool") {
      updates.talent_pool_consent = Boolean(body.enabled);
      updates.talent_pool_added_at = body.enabled ? new Date().toISOString() : null;
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "No permitted update was supplied." }, { status: 400 });
    }

    const { data, error } = await context.client.from("applications").update(updates).eq("id", id).select("*").single();
    if (error) throw error;
    return NextResponse.json({ application: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Application could not be updated." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await routeContext.params;
    const context = await contextFor(req, id);
    if (!context?.ownsApplication) {
      return NextResponse.json({ error: "Applicant access is required." }, { status: 403 });
    }
    const body = await req.json();
    if (body.action !== "replace-cv-upload") {
      return NextResponse.json({ error: "Unsupported upload action." }, { status: 400 });
    }
    if (context.application.interview_scheduled_at) {
      return NextResponse.json({ error: "The CV cannot be replaced after an interview is scheduled." }, { status: 400 });
    }

    const safeName = String(body.fileName || "cv.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${id}/${Date.now()}-${safeName}`;
    const { data, error } = await context.client.storage.from("cvs").createSignedUploadUrl(path);
    if (error) throw error;
    return NextResponse.json({ path, token: data.token });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "CV upload could not be prepared." }, { status: 500 });
  }
}

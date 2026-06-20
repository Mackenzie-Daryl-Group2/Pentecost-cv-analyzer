import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "../../signup/_lib/server-env";
import { defaultOnboardingDocuments, generateStaffId, parseOnboardingDocuments } from "@/utils/onboarding";
import { getUserRole } from "@/utils/roles";

export const runtime = "nodejs";

function adminClient() {
  const url = getServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase server credentials are not configured.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function authenticatedUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  return error ? null : data.user;
}

async function loadApplication(id: string) {
  const { data, error } = await adminClient().from("applications").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

function canAccess(user: any, application: any) {
  const role = getUserRole(user);
  return role === "hr" || (role === "user" && String(application.email || "").toLowerCase() === String(user.email || "").toLowerCase());
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const { id } = await context.params;
    const application = await loadApplication(id);
    if (!canAccess(user, application)) {
      return NextResponse.json({ error: "You cannot access this onboarding record." }, { status: 403 });
    }

    return NextResponse.json({
      application: {
        ...application,
        onboarding_required_documents: application.onboarding_required_documents?.length
          ? application.onboarding_required_documents
          : defaultOnboardingDocuments,
        onboarding_documents: parseOnboardingDocuments(application.onboarding_documents),
      },
      role: getUserRole(user),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Onboarding record could not be loaded." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const { id } = await context.params;
    const application = await loadApplication(id);
    if (!canAccess(user, application)) {
      return NextResponse.json({ error: "You cannot update this onboarding record." }, { status: 403 });
    }

    const role = getUserRole(user);
    const body = await req.json();
    const updates: Record<string, unknown> = { onboarding_updated_at: new Date().toISOString() };

    if (role === "hr") {
      const allowed = [
        "onboarding_status",
        "onboarding_documents",
        "onboarding_required_documents",
        "onboarding_hr_notes",
        "orientation_details",
        "staff_id",
        "status",
      ];
      allowed.forEach((key) => {
        if (key in body) updates[key] = body[key];
      });

      if (body.onboarding_status === "Completed" && !body.staff_id && !application.staff_id) {
        updates.staff_id = generateStaffId(id);
        updates.status = "Hired / Onboarded";
      }
    } else {
      if (Array.isArray(body.onboarding_documents)) {
        updates.onboarding_documents = body.onboarding_documents;
      }
      if (body.acceptOffer === true) {
        updates.onboarding_status = "Offer Accepted";
        updates.status = "Awaiting Onboarding";
      }
    }

    const { data, error } = await adminClient()
      .from("applications")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    return NextResponse.json({ application: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Onboarding record could not be updated." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const { id } = await context.params;
    const application = await loadApplication(id);
    if (!canAccess(user, application)) {
      return NextResponse.json({ error: "You cannot upload to this onboarding record." }, { status: 403 });
    }

    const body = await req.json();
    if (body.action === "signed-url" && body.path) {
      const { data, error } = await adminClient()
        .storage
        .from("onboarding-documents")
        .createSignedUrl(String(body.path), 300);
      if (error) throw error;
      return NextResponse.json({ signedUrl: data.signedUrl });
    }

    const fileName = String(body.fileName || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${id}/${Date.now()}-${fileName}`;
    const { data, error } = await adminClient().storage.from("onboarding-documents").createSignedUploadUrl(path);
    if (error) throw error;

    return NextResponse.json({ path, token: data.token });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Upload could not be prepared." }, { status: 500 });
  }
}

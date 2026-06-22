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

async function authenticated(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const client = adminClient();
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : { client, user: data.user, role: getUserRole(data.user) };
}

export async function POST(req: NextRequest, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticated(req);
    if (!auth || !["hr", "admin"].includes(auth.role)) {
      return NextResponse.json({ error: "HR access is required." }, { status: 403 });
    }
    const { id } = await routeContext.params;
    const body = await req.json();
    const details = {
      position: String(body.position || "").trim().slice(0, 200),
      salary: String(body.salary || "").trim().slice(0, 100),
      startDate: String(body.startDate || "").trim().slice(0, 40),
      probation: String(body.probation || "Six months").trim().slice(0, 100),
      reportingOfficer: String(body.reportingOfficer || "Head of Department").trim().slice(0, 150),
      responseDeadline: String(body.responseDeadline || "").trim().slice(0, 40),
      additionalTerms: String(body.additionalTerms || "").trim().slice(0, 2000),
    };
    if (!details.position || !details.startDate) {
      return NextResponse.json({ error: "Position and start date are required." }, { status: 400 });
    }

    const { data, error } = await auth.client
      .from("applications")
      .update({
        offer_details: details,
        offer_status: "Generated",
        offer_generated_at: new Date().toISOString(),
        onboarding_status: "Offer Letter Sent",
        status: "Offer Letter Sent",
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ application: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Offer letter could not be generated." }, { status: 500 });
  }
}

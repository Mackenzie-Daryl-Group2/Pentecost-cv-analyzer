import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "../signup/_lib/server-env";
import { getUserRole } from "@/utils/roles";
import { jobs as fallbackJobs } from "@/utils/jobs";

export const runtime = "nodejs";

type JobPayload = {
  id?: number;
  title?: string;
  description?: string;
  requirements?: string;
  salary?: string;
};

function env(name: string) {
  return String(getServerEnv(name) || "").trim();
}

function supabaseAdmin() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceKey) {
    throw new Error("Supabase service role credentials are not configured.");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireStaff(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "Missing authorization token.", status: 401 } as const;

  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) return { error: "Supabase public credentials are not configured.", status: 503 } as const;

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data.user) return { error: "Invalid session.", status: 401 } as const;

  const role = getUserRole(data.user);
  if (role !== "hr" && role !== "admin") {
    return { error: "Only HR and Admin can manage vacancies.", status: 403 } as const;
  }

  return { user: data.user, role } as const;
}

function validateJob(payload: JobPayload) {
  const title = String(payload.title || "").trim();
  const description = String(payload.description || "").trim();
  const requirements = String(payload.requirements || "").trim();
  const salary = String(payload.salary || "").trim();

  if (!title || !description || !requirements || !salary) {
    throw new Error("Job title, description, requirements, and salary are required.");
  }

  return { title, description, requirements, salary };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaff(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const payload = (await req.json()) as JobPayload;
    const job = validateJob(payload);
    const admin = supabaseAdmin();

    const { data: maxRows, error: maxError } = await admin
      .from("jobs")
      .select("id")
      .order("id", { ascending: false })
      .limit(1);

    if (maxError) throw maxError;

    const maxFallbackId = Math.max(0, ...fallbackJobs.map((job) => Number(job.id) || 0));
    const maxRemoteId = Math.max(0, Number(maxRows?.[0]?.id || 0));
    const nextId = Math.max(maxFallbackId, maxRemoteId) + 1;
    const { data, error } = await admin
      .from("jobs")
      .insert({ id: nextId, ...job })
      .select("id,title,description,requirements,salary")
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, job: data });
  } catch (error: any) {
    console.error("Job create failed:", error);
    return NextResponse.json({ error: error.message || "Vacancy could not be published." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireStaff(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const payload = (await req.json()) as JobPayload;
    const id = Number(payload.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "A valid job id is required." }, { status: 400 });
    }

    const job = validateJob(payload);
    const { data, error } = await supabaseAdmin()
      .from("jobs")
      .upsert({ id, ...job }, { onConflict: "id" })
      .select("id,title,description,requirements,salary")
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, job: data });
  } catch (error: any) {
    console.error("Job update failed:", error);
    return NextResponse.json({ error: error.message || "Vacancy could not be updated." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireStaff(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "A valid job id is required." }, { status: 400 });
    }

    const { error } = await supabaseAdmin().from("jobs").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Job delete failed:", error);
    return NextResponse.json({ error: error.message || "Vacancy could not be removed." }, { status: 500 });
  }
}

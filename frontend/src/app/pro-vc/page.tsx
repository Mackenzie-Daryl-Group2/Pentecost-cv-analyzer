"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { getJobById, loadJobs, type Job } from "@/utils/jobs";
import { getRoleHome, getUserRole } from "@/utils/roles";
import UserBadge from "@/components/UserBadge";

interface Application {
  id: number;
  job_id: number;
  name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  status: string;
  similarity: number;
  cv_passed?: boolean | string | null;
  interview_scheduled_at?: string | null;
  interview_meet_link?: string | null;
  interview_notes?: string | null;
  interview_passed?: boolean | string | null;
  hr_report_sent?: boolean | string | null;
}

function truthy(value: unknown) {
  return value === true || ["true", "yes", "1", "passed"].includes(String(value || "").toLowerCase());
}

function candidateName(app: Application) {
  return app.name || app.full_name || "Applicant";
}

function roleTitle(app: Application, jobs: Job[]) {
  return jobs.find((job) => job.id === Number(app.job_id))?.title || getJobById(app.job_id)?.title || `Job ${app.job_id}`;
}

export default function ProVcDashboard() {
  const [apps, setApps] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const router = useRouter();

  async function fetchData() {
    const [applicationsResponse, loadedJobs] = await Promise.all([
      supabase.from("applications").select("*").order("similarity", { ascending: false }),
      loadJobs(supabase),
    ]);

    setApps((applicationsResponse.data || []) as Application[]);
    setJobs(loadedJobs);
    setLoading(false);
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?message=Please+log+in+to+continue");
        return;
      }

      const role = getUserRole(user);
      if (role !== "pro_vc") {
        router.replace(getRoleHome(role));
        return;
      }

      setCurrentUser(user);
      await fetchData();
    };

    init();
  }, [router]);

  const scheduledApps = useMemo(() => apps.filter((app) => Boolean(app.interview_scheduled_at)), [apps]);
  const reportApps = useMemo(() => apps.filter((app) => truthy(app.cv_passed) && truthy(app.interview_passed) && truthy(app.hr_report_sent)), [apps]);

  async function submitRecommendation(appId: number) {
    const { error } = await supabase
      .from("applications")
      .update({ pro_vc_approved: true, status: "Recommended by PRO-VC" })
      .eq("id", appId);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Recommendation submitted to HR.");
      await fetchData();
    }
  }

  return (
    <main className="app-shell">
      <div className="page-container">
        <header className="app-topbar">
          <div>
            <p className="eyebrow">PRO-VC</p>
            <h1 className="page-title">Recommendation Review</h1>
            <p className="page-subtitle">Review HR recommendations, interview schedules, and final candidate records.</p>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <UserBadge user={currentUser} label="PRO-VC account" onUserUpdated={setCurrentUser} />
            <button onClick={async () => { await supabase.auth.signOut(); router.push("/"); }} style={{ background: "rgba(255,0,0,0.1)", color: "#ff8a80", border: "1px solid rgba(255,0,0,0.2)", padding: "10px 16px", borderRadius: "8px", fontWeight: "700" }}>
              Logout
            </button>
          </div>
        </header>

        {message && (
          <div style={{ marginBottom: "22px", padding: "14px 16px", borderRadius: "12px", background: "var(--surface-1)", border: "1px solid var(--line-soft)", color: "var(--text-primary)" }}>
            {message}
          </div>
        )}

        <section className="metric-grid">
          {[
            ["Pending Interviews", scheduledApps.length],
            ["Final Reports", reportApps.length],
            ["Active Vacancies", jobs.length],
          ].map(([label, value]) => (
            <div key={label} className="glass-card metric-card">
              <p>{String(label)}</p>
              <h2>{value}</h2>
            </div>
          ))}
        </section>

        <section className="glass-card" style={{ padding: "28px", borderRadius: "18px", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "18px" }}>Jobs Published by HR</h2>
          {loading ? <p>Loading...</p> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
              {jobs.map((job) => (
                <div key={job.id} style={{ padding: "16px", borderRadius: "12px", background: "rgba(255,255,255,0.04)" }}>
                  <strong>{job.title}</strong>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "6px" }}>{job.description}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass-card" style={{ padding: "28px", borderRadius: "18px", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "18px" }}>Applicants Scheduled for Interview</h2>
          {scheduledApps.length ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {scheduledApps.map((app) => (
                <div key={app.id} style={{ padding: "14px", borderRadius: "12px", background: "rgba(255,255,255,0.04)" }}>
                  <strong>{candidateName(app)} - {roleTitle(app, jobs)}</strong>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "6px" }}>{app.interview_scheduled_at} | {app.interview_notes || "No notes"}</p>
                  {app.interview_meet_link && (
                    <a href={app.interview_meet_link} target="_blank" rel="noreferrer" style={{ color: "var(--accent-neon)", fontSize: "0.82rem", fontWeight: "800", display: "inline-block", marginTop: "8px" }}>
                      Join Google Meet
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>No interview schedule has been added by HR yet.</p>
          )}
        </section>

        <section className="glass-card" style={{ padding: "28px", borderRadius: "18px" }}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "18px" }}>HR Report: Passed CV and Interview</h2>
          {reportApps.length ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {reportApps.map((app) => (
                <div key={app.id} style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) auto", gap: "12px", alignItems: "center", padding: "14px", borderRadius: "12px", background: "rgba(255,255,255,0.04)" }}>
                  <div>
                    <strong>{candidateName(app)} - {roleTitle(app, jobs)}</strong>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "6px" }}>{app.email || app.phone} | Similarity {Number(app.similarity || 0).toFixed(2)} | {app.status}</p>
                  </div>
                  <button onClick={() => submitRecommendation(app.id)} className="premium-button">Submit Recommendation to HR</button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>No final passed candidates report from HR yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}

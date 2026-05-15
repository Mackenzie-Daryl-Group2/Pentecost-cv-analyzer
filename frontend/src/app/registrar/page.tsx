"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { getJobById } from "@/utils/jobs";
import { getRoleHome, getUserRole } from "@/utils/roles";
import UserBadge from "@/components/UserBadge";
import UniversityBrand from "@/components/UniversityBrand";

interface Application {
  id: number;
  job_id: number;
  name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  status: string;
  submitted_at?: string | null;
  interview_scheduled_at?: string | null;
  interview_meet_link?: string | null;
}

export default function RegistrarDashboard() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?message=Please+log+in+to+continue");
        return;
      }

      const role = getUserRole(user);
      if (role !== "registrar") {
        router.replace(getRoleHome(role));
        return;
      }

      setCurrentUser(user);
      const { data } = await supabase
        .from("applications")
        .select("*")
        .order("submitted_at", { ascending: false });

      setApps((data || []) as Application[]);
      setLoading(false);
    };

    init();
  }, [router]);

  return (
    <main className="app-shell">
      <div className="page-container">
        <header className="app-topbar">
          <div className="dashboard-brand-title">
            <UniversityBrand />
            <div>
            <p className="eyebrow">Registrar</p>
            <h1 className="page-title">Application Records</h1>
            <p className="page-subtitle">Track submitted applications, interview schedules, and final recruitment status.</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <UserBadge user={currentUser} label="Registrar account" onUserUpdated={setCurrentUser} />
            <button onClick={async () => { await supabase.auth.signOut(); router.push("/"); }} style={{ background: "rgba(255,0,0,0.1)", color: "#ff8a80", border: "1px solid rgba(255,0,0,0.2)", padding: "10px 16px", borderRadius: "8px", fontWeight: "700" }}>
              Logout
            </button>
          </div>
        </header>

        <section className="glass-card" style={{ padding: "28px", borderRadius: "18px" }}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "18px" }}>Student Applications</h2>
          {loading ? (
            <p>Loading applications...</p>
          ) : apps.length ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--accent-neon)", fontSize: "0.72rem" }}>
                    <th style={{ padding: "12px" }}>CANDIDATE</th>
                    <th style={{ padding: "12px" }}>ROLE</th>
                    <th style={{ padding: "12px" }}>SUBMITTED</th>
                    <th style={{ padding: "12px" }}>INTERVIEW</th>
                    <th style={{ padding: "12px" }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((app) => (
                    <tr key={app.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <td style={{ padding: "12px" }}>
                        <strong>{app.name || app.full_name || "Applicant"}</strong>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>{app.email || app.phone}</p>
                      </td>
                      <td style={{ padding: "12px", color: "var(--text-secondary)" }}>{getJobById(app.job_id)?.title || `Job ${app.job_id}`}</td>
                      <td style={{ padding: "12px", color: "var(--text-secondary)" }}>{app.submitted_at ? new Date(app.submitted_at).toLocaleString() : "Not recorded"}</td>
                      <td style={{ padding: "12px", color: "var(--text-secondary)" }}>
                        {app.interview_scheduled_at ? (
                          <>
                            <span>{new Date(app.interview_scheduled_at).toLocaleString()}</span>
                            {app.interview_meet_link && (
                              <a href={app.interview_meet_link} target="_blank" rel="noreferrer" style={{ color: "var(--accent-neon)", fontWeight: "800", display: "block", marginTop: "6px" }}>
                                Join Google Meet
                              </a>
                            )}
                          </>
                        ) : "Not scheduled"}
                      </td>
                      <td style={{ padding: "12px", fontWeight: "800" }}>{app.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>No applications yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}

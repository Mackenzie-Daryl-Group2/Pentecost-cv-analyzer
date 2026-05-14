"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";
import { getMatchDecision, getMatchStyle } from "@/utils/match";
import { getJobById } from "@/utils/jobs";
import { getRoleHome, getUserRole, isApplicantRole } from "@/utils/roles";
import UserBadge from "@/components/UserBadge";

interface Application {
  id: number;
  job_id: number;
  status: string;
  submitted_at: string;
  similarity: number;
  interview_scheduled_at: string | null;
  interview_meet_link: string | null;
}

export default function MyApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
        return;
      }

      const role = getUserRole(user);
      if (!isApplicantRole(role)) {
        router.replace(getRoleHome(role));
        return;
      }

      setUser(user);

      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('email', user.email || "") // Using exact email to filter securely
        .order('submitted_at', { ascending: false });

      if (data) setApps(data);
      setLoading(false);
    };
    init();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <main style={{ padding: "40px", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Premium Navbar */}
      <div style={{ 
        width: "100%", 
        maxWidth: "1200px", 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "40px",
        padding: "20px 40px",
        background: "var(--topbar-bg)",
        borderRadius: "20px",
        backdropFilter: "blur(10px)",
        border: "1px solid var(--line-soft)"
      }}>
        <div style={{ fontWeight: "800", fontSize: "1.2rem", color: "var(--text-primary)", cursor: "pointer" }} onClick={() => router.push("/jobs")}>
          PENTECOST <span style={{ color: "var(--accent-gold)", fontSize: "0.8rem", verticalAlign: "middle", marginLeft: "8px" }}>UNIVERSITY</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <button onClick={() => router.push("/jobs")} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontWeight: "600" }}>Available Jobs</button>
          <button onClick={() => router.push("/my-applications")} style={{ background: "none", border: "none", color: "var(--text-primary)", fontWeight: "600" }}>My Applications</button>
          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)" }}></div>
          <UserBadge user={user} label="Applicant account" onUserUpdated={setUser} />
          <button onClick={handleLogout} style={{ background: "rgba(255,0,0,0.1)", color: "#ff8a80", border: "1px solid rgba(255,0,0,0.2)", padding: "8px 16px", borderRadius: "8px", fontSize: "0.85rem", fontWeight: "600" }}>Logout</button>
        </div>
      </div>

      <div style={{ maxWidth: "1000px", width: "100%" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "8px" }}>My Applications</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "40px" }}>Track your CV review, interview details, and final decision updates.</p>

        {loading ? (
          <p>Loading history...</p>
        ) : apps.length === 0 ? (
          <div className="glass-card" style={{ padding: "60px", textAlign: "center" }}>
            <p style={{ color: "var(--text-secondary)", marginBottom: "20px" }}>You haven't submitted any applications yet.</p>
            <button className="premium-button" onClick={() => router.push("/jobs")}>Browse Jobs</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {apps.map((app) => {
              const jobTitle = getJobById(app.job_id)?.title || "Unknown role";

              return (
                <div key={app.id} className="glass-card" style={{ padding: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "24px", alignItems: "center" }}>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", color: "var(--text-primary)", marginBottom: "4px" }}>{jobTitle}</h3>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Submitted: {new Date(app.submitted_at).toLocaleDateString()}</p>
                  </div>

                {(() => {
                  const decision = getMatchDecision(app.similarity);
                  return (
                    <div style={{ textAlign: "left" }}>
                      <p style={{ fontSize: "0.75rem", color: "var(--accent-neon)", fontWeight: "700", marginBottom: "8px" }}>INITIAL CV REVIEW</p>
                      <span style={{ ...getMatchStyle(decision.tone), display: "inline-block", padding: "8px 12px", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "800" }}>
                        {decision.label}
                      </span>
                      <p style={{ color: "var(--text-secondary)", fontSize: "0.78rem", lineHeight: "1.5", marginTop: "8px" }}>{decision.detail}</p>
                    </div>
                  );
                })()}

                <div style={{ textAlign: "right" }}>
                  <span style={{ 
                    padding: "6px 14px", 
                    borderRadius: "999px", 
                    fontSize: "0.75rem", 
                    fontWeight: "700",
                    background: app.status.includes("Scheduled") || app.status.includes("screening") || app.status.includes("alignment") ? "var(--success-bg)" : "rgba(255, 255, 255, 0.05)",
                    color: app.status.includes("Scheduled") || app.status.includes("screening") || app.status.includes("alignment") ? "var(--accent-neon)" : "var(--text-primary)",
                    border: "1px solid rgba(255,255,255,0.1)"
                  }}>
                    {app.status.toUpperCase()}
                  </span>
                  
                  {app.interview_scheduled_at && (
                    <div style={{ marginTop: "12px", textAlign: "right" }}>
                      <p style={{ fontSize: "0.8rem", color: "var(--text-primary)", fontWeight: "600" }}>Interview Scheduled</p>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{new Date(app.interview_scheduled_at).toLocaleString()}</p>
                      {app.interview_meet_link ? (
                        <a href={app.interview_meet_link} target="_blank" rel="noreferrer" style={{ fontSize: "0.75rem", color: "var(--accent-neon)", textDecoration: "underline" }}>Join Meeting</a>
                      ) : (
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Meeting link pending</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

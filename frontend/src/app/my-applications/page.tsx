"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";

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
      setUser(user);

      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('full_name', user.user_metadata?.full_name || "") // Simplified for demo
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
        background: "rgba(255,255,255,0.03)",
        borderRadius: "20px",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.05)"
      }}>
        <div style={{ fontWeight: "800", fontSize: "1.2rem", color: "white", cursor: "pointer" }} onClick={() => router.push("/jobs")}>
          PENTECOST <span style={{ color: "var(--accent-neon)", fontSize: "0.8rem", verticalAlign: "middle", marginLeft: "8px" }}>RECRUITER</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <button onClick={() => router.push("/jobs")} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontWeight: "600" }}>Available Jobs</button>
          <button onClick={() => router.push("/my-applications")} style={{ background: "none", border: "none", color: "white", fontWeight: "600" }}>My Applications</button>
          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)" }}></div>
          <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>{user?.email}</span>
          <button onClick={handleLogout} style={{ background: "rgba(255,0,0,0.1)", color: "#ff8a80", border: "1px solid rgba(255,0,0,0.2)", padding: "8px 16px", borderRadius: "8px", fontSize: "0.85rem", fontWeight: "600" }}>Logout</button>
        </div>
      </div>

      <div style={{ maxWidth: "1000px", width: "100%" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "8px" }}>My Applications</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "40px" }}>Track your application progress and interview schedules.</p>

        {loading ? (
          <p>Loading history...</p>
        ) : apps.length === 0 ? (
          <div className="glass-card" style={{ padding: "60px", textAlign: "center" }}>
            <p style={{ color: "var(--text-secondary)", marginBottom: "20px" }}>You haven't submitted any applications yet.</p>
            <button className="premium-button" onClick={() => router.push("/jobs")}>Browse Jobs</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {apps.map((app) => (
              <div key={app.id} className="glass-card" style={{ padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: "1.1rem", color: "white", marginBottom: "4px" }}>Job #{app.job_id}</h3>
                  <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>Submitted: {new Date(app.submitted_at).toLocaleDateString()}</p>
                </div>
                
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "0.75rem", color: "var(--accent-neon)", fontWeight: "700", marginBottom: "4px" }}>AI SCORE</p>
                  <p style={{ fontSize: "1.2rem", color: "white", fontWeight: "800" }}>{Math.round(app.similarity * 100)}%</p>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ 
                    padding: "6px 14px", 
                    borderRadius: "999px", 
                    fontSize: "0.75rem", 
                    fontWeight: "700",
                    background: app.status.includes("Passed") ? "rgba(46, 139, 87, 0.2)" : "rgba(255, 255, 255, 0.05)",
                    color: app.status.includes("Passed") ? "var(--accent-neon)" : "white",
                    border: "1px solid rgba(255,255,255,0.1)"
                  }}>
                    {app.status.toUpperCase()}
                  </span>
                  
                  {app.interview_scheduled_at && (
                    <div style={{ marginTop: "12px", textAlign: "right" }}>
                      <p style={{ fontSize: "0.8rem", color: "white", fontWeight: "600" }}>Interview Scheduled</p>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{new Date(app.interview_scheduled_at).toLocaleString()}</p>
                      <a href={app.interview_meet_link!} target="_blank" style={{ fontSize: "0.75rem", color: "var(--accent-neon)", textDecoration: "underline" }}>Join Meeting</a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

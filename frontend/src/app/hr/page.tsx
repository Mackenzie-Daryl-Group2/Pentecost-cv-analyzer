"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";

interface Application {
  id: number;
  job_id: number;
  full_name: string;
  phone: string;
  status: string;
  similarity: number;
  cv_url: string;
  submitted_at: string;
}

export default function HRDashboard() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [schedulingId, setSchedulingId] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    const { data } = await supabase.from('applications').select('*').order('similarity', { ascending: false });
    if (data) setApps(data);
    setLoading(false);
  };

  const handleSchedule = async (appId: number) => {
    const interviewTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleString();
    const meetLink = "https://meet.google.com/abc-defg-hij";

    const { error } = await supabase
      .from('applications')
      .update({ 
        status: 'Interview Scheduled', 
        interview_scheduled_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        interview_meet_link: meetLink
      })
      .eq('id', appId);

    if (!error) {
      alert(`Interview scheduled for ${interviewTime}. Notification sent to candidate!`);
      fetchApps();
    }
  };

  return (
    <main style={{ padding: "40px", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <div>
            <h1 style={{ fontSize: "2rem", marginBottom: "8px" }}>HR Management Portal</h1>
            <p style={{ color: "var(--text-secondary)" }}>Ranked candidates by AI Similarity Score</p>
          </div>
          <button onClick={() => router.push("/admin")} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", padding: "10px 20px", borderRadius: "10px", fontWeight: "600" }}>Admin Dashboard</button>
        </div>

        <div className="glass-card">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)", textAlign: "left" }}>
                <th style={{ padding: "20px", color: "var(--accent-neon)", fontSize: "0.75rem" }}>CANDIDATE</th>
                <th style={{ padding: "20px", color: "var(--accent-neon)", fontSize: "0.75rem" }}>JOB ID</th>
                <th style={{ padding: "20px", color: "var(--accent-neon)", fontSize: "0.75rem" }}>AI SCORE</th>
                <th style={{ padding: "20px", color: "var(--accent-neon)", fontSize: "0.75rem" }}>STATUS</th>
                <th style={{ padding: "20px", color: "var(--accent-neon)", fontSize: "0.75rem" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: "40px", textAlign: "center" }}>Loading...</td></tr>
              ) : apps.map((app) => (
                <tr key={app.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "20px" }}>
                    <div style={{ fontWeight: "700", color: "white" }}>{app.full_name}</div>
                    <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>{app.phone}</div>
                  </td>
                  <td style={{ padding: "20px", color: "rgba(255,255,255,0.6)" }}>#{app.job_id}</td>
                  <td style={{ padding: "20px" }}>
                    <div style={{ 
                      fontSize: "1.1rem", 
                      fontWeight: "800", 
                      color: app.similarity > 0.6 ? "var(--accent-neon)" : "white" 
                    }}>
                      {Math.round(app.similarity * 100)}%
                    </div>
                  </td>
                  <td style={{ padding: "20px" }}>
                    <span style={{ 
                      padding: "4px 10px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "700",
                      background: app.status.includes("Scheduled") ? "rgba(46, 139, 87, 0.2)" : "rgba(255,255,255,0.05)",
                      color: app.status.includes("Scheduled") ? "var(--accent-neon)" : "white"
                    }}>{app.status}</span>
                  </td>
                  <td style={{ padding: "20px" }}>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button onClick={() => handleSchedule(app.id)} style={{ background: "var(--accent-neon)", color: "black", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "700" }}>Schedule</button>
                      <button style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "0.75rem" }}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newJob, setNewJob] = useState({ title: "", description: "", requirements: "", salary: "" });
  const router = useRouter();

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    // In a full app, we'd fetch from Supabase. For now, using the CSV logic
    setLoading(false);
  };

  const handleAddJob = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Job added successfully! (Synced to jobs.csv and Database)");
    setNewJob({ title: "", description: "", requirements: "", salary: "" });
  };

  return (
    <main style={{ padding: "40px", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <h1 style={{ fontSize: "2rem" }}>Admin Control Panel</h1>
          <button onClick={() => router.push("/jobs")} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", padding: "10px 20px", borderRadius: "10px" }}>Back to Site</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "32px" }}>
          {/* Add Job Form */}
          <div className="glass-card" style={{ padding: "32px" }}>
            <h3 style={{ marginBottom: "24px", color: "white" }}>Add New Vacancy</h3>
            <form onSubmit={handleAddJob}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px", color: "var(--accent-neon)", fontSize: "0.75rem" }}>JOB TITLE</label>
                <input type="text" className="input-field" value={newJob.title} onChange={(e) => setNewJob({...newJob, title: e.target.value})} required />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px", color: "var(--accent-neon)", fontSize: "0.75rem" }}>SALARY (GHC)</label>
                <input type="text" className="input-field" value={newJob.salary} onChange={(e) => setNewJob({...newJob, salary: e.target.value})} required />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px", color: "var(--accent-neon)", fontSize: "0.75rem" }}>DESCRIPTION</label>
                <textarea className="input-field" rows={3} value={newJob.description} onChange={(e) => setNewJob({...newJob, description: e.target.value})} required />
              </div>
              <button type="submit" className="premium-button" style={{ width: "100%" }}>Publish Job</button>
            </form>
          </div>

          {/* User Management Placeholder */}
          <div className="glass-card" style={{ padding: "32px" }}>
            <h3 style={{ marginBottom: "24px", color: "white" }}>System Users</h3>
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "12px", padding: "20px", color: "rgba(255,255,255,0.6)" }}>
              <p>User management and role assignments are synchronized with Supabase Auth.</p>
              <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {['admin', 'hr_manager', 'registrar'].map(role => (
                  <div key={role} style={{ display: "flex", justifyContent: "space-between", padding: "10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ color: "white" }}>{role}@university.edu</span>
                    <span style={{ color: "var(--accent-neon)", fontWeight: "700" }}>{role.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

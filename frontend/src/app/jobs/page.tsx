"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";
import { loadJobs, type Job } from "@/utils/jobs";
import { getRoleHome, getUserRole, isApplicantRole } from "@/utils/roles";
import UserBadge from "@/components/UserBadge";
import UniversityBrand from "@/components/UniversityBrand";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const role = getUserRole(user);
        if (!isApplicantRole(role)) {
          router.replace(getRoleHome(role));
          return;
        }

        setUser(user);
      }

      setJobs(await loadJobs(supabase));
      setLoading(false);
    };
    init();
  }, [router]);

  const handleApply = (jobId: number) => {
    if (!user) {
      const returnTo = `/apply?jobId=${jobId}`;
      router.push(`/login?message=${encodeURIComponent("Please create an account or sign in to apply for this job.")}&next=${encodeURIComponent(returnTo)}`);
      return;
    }

    router.push(`/apply?jobId=${jobId}`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <main style={{ padding: "40px", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center" }}>
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
        <UniversityBrand />
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <button onClick={() => router.push("/jobs")} style={{ background: "none", border: "none", color: "var(--text-primary)", fontWeight: "600" }}>Jobs</button>
          {user ? (
            <>
              <button onClick={() => router.push("/my-applications")} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontWeight: "600" }}>Applications</button>
              <UserBadge user={user} label="Applicant account" onUserUpdated={setUser} />
              <button onClick={handleLogout} style={{ background: "rgba(255,0,0,0.1)", color: "#ff8a80", border: "1px solid rgba(255,0,0,0.2)", padding: "8px 16px", borderRadius: "8px", fontSize: "0.85rem", fontWeight: "600" }}>Logout</button>
            </>
          ) : (
            <>
              <button onClick={() => router.push("/login")} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontWeight: "600" }}>Sign In</button>
              <button className="premium-button" onClick={() => router.push("/signup")} style={{ padding: "10px 18px" }}>Create Account</button>
            </>
          )}
        </div>
      </div>

      <div style={{ maxWidth: "1200px", width: "100%" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "8px" }}>Open Roles</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "40px" }}>Browse current vacancies and begin a tracked application.</p>

        {loading ? (
          <p>Loading jobs...</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "24px" }}>
            {jobs.map((job) => (
              <div key={job.id} className="glass-card" style={{ padding: "32px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontSize: "1.25rem", color: "var(--text-primary)", marginBottom: "16px" }}>{job.title}</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "20px" }}>{job.description}</p>
                  <div style={{ marginBottom: "24px" }}>
                    <p style={{ fontSize: "0.75rem", color: "var(--accent-neon)", fontWeight: "700", marginBottom: "8px" }}>REQUIREMENTS</p>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{job.requirements}</p>
                  </div>
                </div>
                <button className="premium-button" style={{ width: "100%" }} onClick={() => handleApply(job.id)}>Apply Now</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

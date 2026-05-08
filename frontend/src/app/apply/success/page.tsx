"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function ApplySuccessPage() {
  const router = useRouter();

  return (
    <main style={{ padding: "40px", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <div className="glass-card" style={{ padding: "60px", maxWidth: "500px" }}>
        <div style={{ fontSize: "4rem", marginBottom: "24px" }}>🎉</div>
        <h1 style={{ fontSize: "2rem", marginBottom: "16px", color: "white" }}>Application Received!</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "32px", lineHeight: "1.6" }}>
          Thank you for applying to Pentecost University. We have sent a confirmation email to your registered address. 
          Our AI has screened your CV, and your status has been updated.
        </p>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button className="premium-button" onClick={() => router.push("/my-applications")} style={{ width: "100%" }}>
            View My Status
          </button>
          <button onClick={() => router.push("/jobs")} style={{ background: "none", border: "none", color: "var(--accent-neon)", fontWeight: "600", cursor: "pointer" }}>
            Browse More Jobs
          </button>
        </div>
      </div>
    </main>
  );
}

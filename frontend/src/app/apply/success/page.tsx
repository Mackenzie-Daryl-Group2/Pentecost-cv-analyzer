"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ApplySuccessPage() {
  const router = useRouter();
  const [emailStatus, setEmailStatus] = useState("sent");
  const [decision, setDecision] = useState("Application received");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmailStatus(params.get("email") || "sent");
    setDecision(params.get("decision") || "Application received");
  }, []);

  const emailMessage = emailStatus === "sent"
    ? "Application received. A confirmation email was delivered to your registered address."
    : emailStatus === "failed"
      ? "Application received, but the confirmation email could not be delivered. Please contact the recruitment office if you need a receipt."
      : "Application received. No confirmation email was delivered because no email address was available.";

  return (
    <main style={{ padding: "40px", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <div className="glass-card" style={{ padding: "56px", maxWidth: "560px" }}>
        <div style={{ width: "72px", height: "72px", borderRadius: "50%", margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--success-bg)", border: "1px solid var(--success-border)", color: "var(--accent-neon)", fontSize: "2rem", fontWeight: "900" }}>
          ✓
        </div>
        <h1 style={{ fontSize: "2rem", marginBottom: "16px", color: "var(--text-primary)" }}>Application Received!</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "20px", lineHeight: "1.6" }}>
          Thank you for applying to Pentecost University. Your application has been recorded and your initial CV review is complete.
        </p>

        <div style={{ padding: "18px", borderRadius: "14px", background: "var(--surface-1)", border: "1px solid var(--line-soft)", marginBottom: "18px" }}>
          <p style={{ color: "var(--accent-neon)", fontSize: "0.75rem", fontWeight: "800", marginBottom: "6px" }}>INITIAL SCREENING STATEMENT</p>
          <p style={{ color: "var(--text-primary)", fontWeight: "800" }}>{decision}</p>
        </div>

        <div style={{ padding: "14px", borderRadius: "12px", background: emailStatus === "sent" ? "var(--success-bg)" : "rgba(255,193,7,0.12)", border: emailStatus === "sent" ? "1px solid var(--success-border)" : "1px solid rgba(255,193,7,0.22)", marginBottom: "32px" }}>
          <p style={{ color: emailStatus === "sent" ? "var(--accent-neon)" : "#ffd166", fontSize: "0.9rem", lineHeight: "1.5" }}>{emailMessage}</p>
        </div>

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

"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";
import { getMatchDecision, getMatchStyle } from "@/utils/match";
import UserBadge from "@/components/UserBadge";
import UniversityBrand from "@/components/UniversityBrand";

export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<{ similarity: number; status: string } | null>(null);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
      } else {
        setUser(user);
      }
    };
    getUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !jobDescription) return;

    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append("cv_file", file);
    formData.append("job_description", jobDescription);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Analysis failed", error);
    } finally {
      setIsAnalyzing(false);
    }
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
        marginBottom: "60px",
        padding: "20px 40px",
        background: "var(--topbar-bg)",
        borderRadius: "20px",
        backdropFilter: "blur(10px)",
        border: "1px solid var(--line-soft)"
      }}>
        <UniversityBrand />
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <UserBadge user={user} label="Account" onUserUpdated={setUser} />
          <button 
            onClick={handleLogout}
            style={{ 
              background: "rgba(255,0,0,0.1)", 
              color: "#ff8a80", 
              border: "1px solid rgba(255,0,0,0.2)",
              padding: "8px 16px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: "600"
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{ maxWidth: "800px", width: "100%" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "16px", textAlign: "center" }}>CV Match Review</h1>
        <p style={{ color: "var(--text-secondary)", textAlign: "center", marginBottom: "40px" }}>
          Upload a CV and compare it with the job requirements using the same matching signal used in applications.
        </p>

        <div className="glass-card" style={{ padding: "40px" }}>
          <form onSubmit={handleUpload}>
            <div style={{ marginBottom: "32px" }}>
              <label style={{ display: "block", marginBottom: "12px", color: "var(--accent-neon)", fontWeight: "600" }}>JOB DESCRIPTION</label>
              <textarea 
                className="input-field" 
                rows={6} 
                placeholder="Paste the job requirements here..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                style={{ resize: "none" }}
              />
            </div>

            <div style={{ marginBottom: "40px" }}>
              <label style={{ display: "block", marginBottom: "12px", color: "var(--accent-neon)", fontWeight: "600" }}>UPLOAD CV (PDF)</label>
              <div 
                style={{ 
                  border: "2px dashed var(--success-border)", 
                  borderRadius: "16px", 
                  padding: "40px", 
                  textAlign: "center",
                  background: "rgba(255,255,255,0.02)",
                  cursor: "pointer",
                  transition: "all 0.3s ease"
                }}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <input 
                  id="file-input"
                  type="file" 
                  accept=".pdf" 
                  style={{ display: "none" }} 
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <div style={{ fontSize: "2rem", marginBottom: "12px" }}>📄</div>
                <p style={{ fontWeight: "600", marginBottom: "4px" }}>
                  {file ? file.name : "Click to upload or drag and drop"}
                </p>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>PDF files only (max 5MB)</p>
              </div>
            </div>

            <button 
              type="submit" 
              className="premium-button" 
              disabled={isAnalyzing || !file || !jobDescription}
              style={{ width: "100%", height: "56px", fontSize: "1.1rem", opacity: (isAnalyzing || !file || !jobDescription) ? 0.6 : 1 }}
            >
              {isAnalyzing ? "Processing match..." : "Run Review"}
            </button>
          </form>

          {result && (() => {
            const decision = getMatchDecision(result.similarity);
            return (
              <div style={{ marginTop: "40px", padding: "24px", borderRadius: "16px", background: "var(--success-soft-bg)", border: "1px solid var(--success-border)" }}>
                <h3 style={{ marginBottom: "16px", color: "var(--text-primary)" }}>Analysis Result</h3>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "center", gap: "20px" }}>
                  <div style={{ width: "64px", height: "64px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--success-bg)", border: "1px solid var(--success-border)", color: "var(--accent-neon)", fontSize: "1.6rem", fontWeight: "900" }}>
                    ✓
                  </div>
                  <div>
                    <span style={{ ...getMatchStyle(decision.tone), display: "inline-block", padding: "8px 12px", borderRadius: "999px", fontSize: "0.82rem", fontWeight: "800", marginBottom: "10px" }}>
                      {decision.label}
                    </span>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.6" }}>
                      {decision.detail}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </main>
  );
}

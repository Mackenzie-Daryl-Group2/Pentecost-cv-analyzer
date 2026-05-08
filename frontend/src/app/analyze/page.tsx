"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";

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
        background: "rgba(255,255,255,0.03)",
        borderRadius: "20px",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.05)"
      }}>
        <div style={{ fontWeight: "800", fontSize: "1.2rem", color: "white" }}>
          PENTECOST <span style={{ color: "var(--accent-neon)", fontSize: "0.8rem", verticalAlign: "middle", marginLeft: "8px" }}>RECRUITER</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>{user?.email}</span>
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
        <h1 style={{ fontSize: "2.5rem", marginBottom: "16px", textAlign: "center" }}>AI CV Analyzer</h1>
        <p style={{ color: "var(--text-secondary)", textAlign: "center", marginBottom: "40px" }}>
          Upload your CV and compare it with the job requirements using our advanced neural matching engine.
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
                  border: "2px dashed rgba(46, 139, 87, 0.3)", 
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
                <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)" }}>PDF files only (max 5MB)</p>
              </div>
            </div>

            <button 
              type="submit" 
              className="premium-button" 
              disabled={isAnalyzing || !file || !jobDescription}
              style={{ width: "100%", height: "56px", fontSize: "1.1rem", opacity: (isAnalyzing || !file || !jobDescription) ? 0.6 : 1 }}
            >
              {isAnalyzing ? "Processing with AI..." : "Run Analysis"}
            </button>
          </form>

          {result && (
            <div style={{ marginTop: "40px", padding: "24px", borderRadius: "16px", background: "rgba(46, 139, 87, 0.1)", border: "1px solid rgba(46, 139, 87, 0.3)" }}>
              <h3 style={{ marginBottom: "16px", color: "white" }}>Analysis Result</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                <div style={{ 
                  width: "80px", 
                  height: "80px", 
                  borderRadius: "50%", 
                  border: "4px solid var(--accent-neon)", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  fontWeight: "800",
                  color: "var(--accent-neon)"
                }}>
                  {Math.round(result.similarity * 100)}%
                </div>
                <div>
                  <p style={{ fontWeight: "700", color: "white", fontSize: "1.1rem" }}>
                    {result.similarity > 0.7 ? "High Match" : result.similarity > 0.4 ? "Potential Match" : "Low Match"}
                  </p>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                    Your CV has a {Math.round(result.similarity * 100)}% similarity with the job description.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Check for success message in URL
    const searchParams = new URLSearchParams(window.location.search);
    const msg = searchParams.get("message");
    if (msg) setSuccessMessage(msg);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccessMessage("");
    try {
      let data, error;
      
      // If input starts with a plus, treat as phone number. Otherwise, treat as email/username.
      if (email.startsWith('+')) {
        const res = await supabase.auth.signInWithPassword({
          phone: email,
          password,
        });
        data = res.data;
        error = res.error;
      } else {
        const loginIdentifier = email.includes("@") ? email : `${email}@university.edu`; 
        const res = await supabase.auth.signInWithPassword({
          email: loginIdentifier,
          password,
        });
        data = res.data;
        error = res.error;
      }

      if (error) throw error;

      const userRole = data.user?.user_metadata?.role || "user";
      if (userRole === "hr" || userRole === "admin") {
        router.push("/hr");
      } else {
        router.push("/jobs");
      }
    } catch (error: any) {
      setMessage("Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "20px" }}>
      <div className="glass-card" style={{ width: "100%", maxWidth: "450px", padding: "48px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ fontSize: "2rem", marginBottom: "8px", color: "white" }}>Welcome Back</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>Login to access your dashboard</p>
        </div>

        {successMessage && (
          <div style={{ marginBottom: "20px", padding: "12px", borderRadius: "8px", background: "rgba(46, 139, 87, 0.2)", color: "#81c784", fontSize: "0.85rem", textAlign: "center" }}>
            {successMessage}
          </div>
        )}

        {message && (
          <div style={{ marginBottom: "20px", padding: "12px", borderRadius: "8px", background: "rgba(255, 0, 0, 0.1)", color: "#ff8a80", fontSize: "0.85rem", textAlign: "center" }}>
            {message}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "#a5d6a7", fontWeight: "600" }}>EMAIL OR USERNAME</label>
            <input type="text" className="input-field" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div style={{ marginBottom: "32px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "#a5d6a7", fontWeight: "600" }}>PASSWORD</label>
            <input type="password" className="input-field" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <button type="submit" className="premium-button" style={{ width: "100%", height: "50px" }} disabled={loading}>
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop: "24px", textAlign: "center" }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "0.85rem", cursor: "pointer" }}>
            ← Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}

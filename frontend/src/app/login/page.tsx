"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";
import { getRoleHome, getUserRole } from "@/utils/roles";
import UniversityBrand from "@/components/UniversityBrand";

type AuthMode = "login" | "forgot" | "reset";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [confirmResetPassword, setConfirmResetPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const router = useRouter();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const msg = searchParams.get("message");

    if (msg) setSuccessMessage(msg);
  }, []);

  const loginHint = useMemo(() => {
    if (!email.trim()) return "Use your email address, assigned username, or phone number.";
    if (email.trim().startsWith("+")) return "Phone login selected. Include your country code.";
    if (email.includes("@")) return "Email login selected.";
    return "Username login selected. The system will find the email linked to that username.";
  }, [email]);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  function openForgotPassword() {
    setAuthMode("forgot");
    setMessage("");
    setSuccessMessage("");
    setResetEmail(email.includes("@") ? email.trim() : "");
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccessMessage("");

    try {
      let data, error;
      const identifier = email.trim();

      if (identifier.startsWith("+")) {
        const res = await supabase.auth.signInWithPassword({
          phone: identifier,
          password,
        });
        data = res.data;
        error = res.error;
      } else {
        let loginIdentifier = identifier;
        if (!identifier.includes("@")) {
          const resolveResponse = await fetch("/api/auth/resolve-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier }),
          });
          const resolveData = await resolveResponse.json().catch(() => ({}));
          if (!resolveResponse.ok || !resolveData.email) {
            throw new Error(resolveData.error || "Invalid username or password");
          }
          loginIdentifier = resolveData.email;
        }

        const res = await supabase.auth.signInWithPassword({
          email: loginIdentifier,
          password,
        });
        data = res.data;
        error = res.error;
      }

      if (error) throw error;

      router.push(getRoleHome(getUserRole(data.user)));
    } catch (error: any) {
      setMessage(error.message || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const cleanEmail = resetEmail.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes("@")) {
        throw new Error("Enter the email address linked to your account.");
      }

      const response = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.error || "Password reset code could not be sent.");

      setResetEmail(cleanEmail);
      setResetCode("");
      setResetPassword("");
      setConfirmResetPassword("");
      setSuccessMessage("Password reset code sent. Check your email and enter the code below.");
      setAuthMode("reset");
    } catch (error: any) {
      setMessage(error.message || "Password reset code could not be sent.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const cleanEmail = resetEmail.trim().toLowerCase();
      const cleanCode = resetCode.trim();

      if (!cleanEmail || !cleanEmail.includes("@")) {
        throw new Error("Enter the email address linked to your account.");
      }

      if (!/^\d{6}$/.test(cleanCode)) {
        throw new Error("Enter the 6-digit reset code.");
      }

      if (resetPassword.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      if (resetPassword !== confirmResetPassword) {
        throw new Error("Passwords do not match.");
      }

      const response = await fetch("/api/password-reset/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          code: cleanCode,
          password: resetPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.error || "Password could not be reset.");

      await supabase.auth.signOut();
      setResetEmail("");
      setResetCode("");
      setResetPassword("");
      setConfirmResetPassword("");
      setPassword("");
      setAuthMode("login");
      setSuccessMessage(
        data.confirmationEmailSent
          ? "Password updated successfully. A confirmation email has been sent. Sign in with your new password."
          : "Password updated successfully. Sign in with your new password."
      );
    } catch (error: any) {
      setMessage(error.message || "Password could not be reset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", padding: "32px", display: "grid", placeItems: "center" }}>
      <div style={{ width: "100%", maxWidth: "980px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "28px", alignItems: "stretch" }}>
        <section className="glass-card" style={{ padding: "42px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "520px" }}>
          <div>
            <div style={{ marginBottom: "18px" }}>
              <UniversityBrand />
            </div>
            <h1 style={{ fontSize: "2.8rem", lineHeight: "1.05", color: "var(--text-primary)", marginBottom: "18px" }}>
              Continue your recruitment workflow.
            </h1>
            <p style={{ color: "var(--text-secondary)", lineHeight: "1.7", maxWidth: "440px" }}>
              Sign in to browse vacancies, submit documents, and track updates from the recruitment team.
            </p>
          </div>

          <div style={{ display: "grid", gap: "14px" }}>
            {["Secure applicant dashboard", "Live application tracking", "Interview updates by email and calendar", "Password recovery by email"].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--text-primary)" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--accent-neon)", boxShadow: "0 0 18px var(--primary-button-shadow)" }} />
                <span style={{ fontWeight: "650" }}>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card" style={{ padding: "44px" }}>
          <div style={{ marginBottom: "30px" }}>
            <p style={{ color: "var(--accent-neon)", fontSize: "0.75rem", fontWeight: "800", marginBottom: "8px" }}>SECURE ACCESS</p>
            <h2 style={{ fontSize: "2rem", marginBottom: "8px", color: "var(--text-primary)" }}>
              {authMode === "forgot" ? "Get Reset Code" : authMode === "reset" ? "Enter Reset Code" : "Welcome Back"}
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              {authMode === "forgot"
                ? "Enter your account email and we will send a 6-digit reset code."
                : authMode === "reset"
                  ? "Enter the code from your email and create a new password."
                  : "Enter your credentials to access your dashboard."}
            </p>
          </div>

          {successMessage && (
            <div style={{ marginBottom: "20px", padding: "14px", borderRadius: "12px", background: "var(--success-bg)", color: "var(--accent-neon)", fontSize: "0.9rem", border: "1px solid var(--success-border)" }}>
              {successMessage}
            </div>
          )}

          {message && (
            <div style={{ marginBottom: "20px", padding: "14px", borderRadius: "12px", background: "rgba(255, 0, 0, 0.1)", color: "#ff8a80", fontSize: "0.9rem", border: "1px solid rgba(255,0,0,0.18)" }}>
              {message}
            </div>
          )}

          {authMode === "login" && (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "var(--accent-neon)", fontWeight: "700" }}>EMAIL, USERNAME, OR PHONE</label>
                <input type="text" className="input-field" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <p style={{ marginTop: "8px", color: "var(--text-secondary)", fontSize: "0.78rem" }}>{loginHint}</p>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "var(--accent-neon)", fontWeight: "700" }}>PASSWORD</label>
                <div style={{ position: "relative" }}>
                  <input type={showPassword ? "text" : "password"} className="input-field" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ paddingRight: "92px" }} />
                  <button type="button" onClick={() => setShowPassword((current) => !current)} style={{ position: "absolute", right: "8px", top: "8px", bottom: "8px", padding: "0 14px", borderRadius: "8px", border: "1px solid var(--line-soft)", background: "var(--surface-1)", color: "var(--text-primary)", fontWeight: "700", fontSize: "0.78rem" }}>
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button type="button" onClick={openForgotPassword} style={{ background: "none", border: "none", color: "var(--accent-neon)", fontSize: "0.82rem", fontWeight: "800", marginBottom: "24px" }}>
                Forgot password?
              </button>

              <button type="submit" className="premium-button" style={{ width: "100%", height: "52px", opacity: canSubmit ? 1 : 0.62 }} disabled={!canSubmit}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}

          {authMode === "forgot" && (
            <form onSubmit={handleForgotPassword}>
              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "var(--accent-neon)", fontWeight: "700" }}>ACCOUNT EMAIL</label>
                <input type="email" className="input-field" placeholder="name@example.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
                <p style={{ marginTop: "8px", color: "var(--text-secondary)", fontSize: "0.78rem" }}>Use the email address connected to your account.</p>
              </div>

              <button type="submit" className="premium-button" style={{ width: "100%", height: "52px" }} disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
              <button type="button" onClick={() => setAuthMode("login")} style={{ width: "100%", marginTop: "18px", background: "none", border: "none", color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: "700" }}>
                Back to Sign In
              </button>
            </form>
          )}

          {authMode === "reset" && (
            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "var(--accent-neon)", fontWeight: "700" }}>ACCOUNT EMAIL</label>
                <input type="email" className="input-field" placeholder="name@example.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
              </div>

              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "var(--accent-neon)", fontWeight: "700" }}>RESET CODE</label>
                <input type="text" className="input-field" style={{ textAlign: "center", fontSize: "1.25rem", letterSpacing: "8px" }} placeholder="000000" value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))} maxLength={6} required />
              </div>

              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "var(--accent-neon)", fontWeight: "700" }}>NEW PASSWORD</label>
                <input type="password" className="input-field" placeholder="New password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required minLength={6} />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "var(--accent-neon)", fontWeight: "700" }}>CONFIRM PASSWORD</label>
                <input type="password" className="input-field" placeholder="Confirm new password" value={confirmResetPassword} onChange={(e) => setConfirmResetPassword(e.target.value)} required minLength={6} />
              </div>

              <button type="submit" className="premium-button" style={{ width: "100%", height: "52px" }} disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </button>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginTop: "18px" }}>
                <button type="button" onClick={() => setAuthMode("forgot")} style={{ background: "none", border: "none", color: "var(--accent-neon)", fontSize: "0.85rem", fontWeight: "800" }}>
                  Request New Code
                </button>
                <button type="button" onClick={() => setAuthMode("login")} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: "700" }}>
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          <div style={{ marginTop: "26px", paddingTop: "22px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center" }}>
            <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "0.85rem", cursor: "pointer" }}>
              Back to Home
            </button>
            <button onClick={() => router.push("/signup")} style={{ background: "none", border: "none", color: "var(--accent-neon)", fontSize: "0.85rem", cursor: "pointer", fontWeight: "800" }}>
              Create Account
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

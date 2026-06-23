"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";
import UniversityBrand from "@/components/UniversityBrand";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [countryCode, setCountryCode] = useState("+233");
  const [phone, setPhone] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [returnTo, setReturnTo] = useState("");
  const router = useRouter();

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) setReturnTo(next);
  }, []);

  const handleRequestAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setOtpCode("");
    const fullPhone = `${countryCode}${phone.replace(/\D/g, "")}`;
    try {
      const verificationResponse = await fetch("/api/signup/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          password,
          phone: fullPhone,
        }),
      });
      const verificationData = await verificationResponse.json().catch(() => ({}));
      if (!verificationResponse.ok) {
        throw new Error(verificationData.error || "Verification code could not be sent");
      }
      
      setShowOtp(true);
      setMessage(`Verification code sent to ${email}.`);
    } catch (error: any) {
      setMessage(error.message || "Account creation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const verifyResponse = await fetch("/api/signup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          token: otpCode,
        }),
      });
      const verifyData = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || "Invalid verification code");
      }

      // Send Welcome Confirmation Email
      const emailResponse = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: 'Account Created Successfully!',
          html: `
            <h2>Welcome to Pentecost Recruitment!</h2>
            <p>Hi ${username},</p>
            <p>Your account has been successfully verified and created. You can now log in to the platform to view and apply for jobs.</p>
            <p>Thank you!</p>
          `
        })
      }).catch(() => null);

      await supabase.auth.signOut();
      const loginMessage = emailResponse?.ok
        ? "Account created successfully. Please log in."
        : "Account created successfully, but the welcome email could not be sent. Please log in.";
      router.push(`/login?message=${encodeURIComponent(loginMessage)}${returnTo ? `&next=${encodeURIComponent(returnTo)}` : ""}`);
    } catch (error: any) {
      setMessage(error.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ 
      display: "flex", 
      minHeight: "100vh", 
      background: "var(--bg-gradient)", 
      fontFamily: "'Inter', sans-serif",
      color: "var(--text-primary)"
    }}>
      {/* Left Side - Value Proposition */}
      <div style={{
        flex: 1,
        display: "none",
        flexDirection: "column",
        justifyContent: "center",
        padding: "60px",
        background: "linear-gradient(135deg, var(--success-soft-bg), rgba(0,0,0,0))",
        borderRight: "1px solid rgba(255,255,255,0.05)",
      }} className="desktop-only">
        <h1 style={{ fontSize: "3rem", fontWeight: "800", marginBottom: "24px", lineHeight: "1.1", letterSpacing: 0 }}>
          Your Next Role <br/>
          <span style={{ color: "var(--accent-neon)" }}>Opportunity Awaits.</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem", marginBottom: "40px", maxWidth: "400px", lineHeight: "1.6" }}>
          Create an account to access vacancies, submit your CV, and track your application from review to interview.
        </p>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ background: "var(--success-bg)", padding: "10px", borderRadius: "8px", color: "var(--accent-neon)" }}>⚡</div>
            <span style={{ fontWeight: "600", color: "var(--text-primary)" }}>Structured CV Review</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ background: "var(--success-bg)", padding: "10px", borderRadius: "8px", color: "var(--accent-neon)" }}>🎯</div>
            <span style={{ fontWeight: "600", color: "var(--text-primary)" }}>Role Match Signals</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ background: "var(--success-bg)", padding: "10px", borderRadius: "8px", color: "var(--accent-neon)" }}>📅</div>
            <span style={{ fontWeight: "600", color: "var(--text-primary)" }}>Automated Interview Scheduling</span>
          </div>
        </div>
        
        <style dangerouslySetInnerHTML={{__html: `
          @media (min-width: 900px) { .desktop-only { display: flex !important; } }
        `}} />
      </div>

      {/* Right Side - Form */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px"
      }}>
        <div style={{ width: "100%", maxWidth: "450px" }}>
          <div style={{ marginBottom: "40px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "18px" }}>
              <UniversityBrand compact />
            </div>
            <h2 style={{ fontSize: "2rem", fontWeight: "700", marginBottom: "8px" }}>Create Account</h2>
            <p style={{ color: "var(--text-secondary)" }}>Join the Pentecost Recruitment Platform</p>
          </div>

          {message && (
            <div style={{ marginBottom: "24px", padding: "16px", borderRadius: "12px", background: message.includes("sent") ? "var(--success-bg)" : "rgba(255, 0, 0, 0.1)", color: message.includes("sent") ? "var(--accent-neon)" : "#ff8a80", fontSize: "0.9rem", textAlign: "center", border: message.includes("sent") ? "1px solid var(--success-border)" : "none" }}>
              {message}
            </div>
          )}

          <div className="glass-card" style={{ padding: "40px" }}>
            <form onSubmit={showOtp ? handleVerifyOtp : handleRequestAccount}>
              {!showOtp ? (
                <>
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "var(--accent-neon)", fontWeight: "700" }}>USERNAME</label>
                    <input type="text" className="input-field" placeholder="e.g. john_doe" value={username} onChange={(e) => setUsername(e.target.value)} required />
                  </div>
                  
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "var(--accent-neon)", fontWeight: "700" }}>PHONE NUMBER</label>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <select className="input-field" style={{ width: "110px" }} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                        <option value="+233">🇬🇭 +233</option>
                        <option value="+234">🇳🇬 +234</option>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+44">🇬🇧 +44</option>
                      </select>
                      <input type="tel" className="input-field" style={{ flex: 1 }} placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                    </div>
                  </div>

                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "var(--accent-neon)", fontWeight: "700" }}>EMAIL ADDRESS</label>
                    <input type="email" className="input-field" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>

                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "var(--accent-neon)", fontWeight: "700" }}>VERIFY VIA</label>
                    <select className="input-field" value="Email" disabled aria-label="Verification method">
                      <option value="Email">Email</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: "32px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "var(--accent-neon)", fontWeight: "700" }}>CREATE PASSWORD</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        className="input-field"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        style={{ paddingRight: "92px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        style={{
                          position: "absolute",
                          right: "10px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "var(--surface-2)",
                          border: "1px solid var(--line-soft)",
                          borderRadius: "8px",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                          fontSize: "0.78rem",
                          fontWeight: "800",
                          padding: "7px 10px",
                        }}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <button type="submit" style={{ width: "100%", padding: "16px", background: "var(--primary-button-bg)", color: "white", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "1rem", cursor: "pointer", transition: "opacity 0.2s" }} disabled={loading}>
                    {loading ? "Processing..." : "Create Account"}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: "32px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "var(--accent-neon)", fontWeight: "700", textAlign: "center" }}>ENTER VERIFICATION CODE</label>
                    <input type="text" className="input-field" style={{ textAlign: "center", fontSize: "1.5rem", letterSpacing: "8px" }} placeholder="000000" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))} maxLength={6} required />
                  </div>
                  <button type="submit" style={{ width: "100%", padding: "16px", background: "var(--primary-button-bg)", color: "white", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "1rem", cursor: "pointer" }} disabled={loading}>
                    {loading ? "Verifying..." : "Confirm & Access"}
                  </button>
                  <button type="button" onClick={() => setShowOtp(false)} style={{ width: "100%", background: "none", border: "none", color: "var(--text-secondary)", marginTop: "20px", fontSize: "0.9rem", cursor: "pointer" }}>
                    ← Back to edit details
                  </button>
                </>
              )}
            </form>
          </div>

          {!showOtp && (
            <div style={{ marginTop: "32px", textAlign: "center" }}>
              <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "0.9rem", cursor: "pointer" }}>
                ← Return to Home
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

"use client";

import React, { useState } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [countryCode, setCountryCode] = useState("+233");
  const [phone, setPhone] = useState("");
  const [verificationMethod, setVerificationMethod] = useState("Email");
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleRequestAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const fullPhone = `${countryCode}${phone}`;
    try {
      let authError;
      
      if (verificationMethod === "Email") {
        const { error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: { data: { username, phone: fullPhone, full_name: username } }
        });
        authError = error;
      } else {
        const { error } = await supabase.auth.signUp({
          phone: fullPhone,
          password: password,
          options: { data: { username, email, full_name: username } }
        });
        authError = error;
      }

      if (authError) throw authError;
      
      setShowOtp(true);
      setMessage(`Verification code sent via ${verificationMethod}!`);
    } catch (error: any) {
      setMessage(error.message || "Account creation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const fullPhone = `${countryCode}${phone}`;
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: verificationMethod === "Email" ? email : undefined,
        phone: verificationMethod === "SMS" ? fullPhone : undefined,
        token: otpCode,
        type: verificationMethod === "Email" ? 'signup' : 'sms',
      });
      if (error) throw error;

      // Send Welcome Confirmation Email
      await fetch('/api/send-email', {
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
      });

      await supabase.auth.signOut();
      router.push("/login?message=Account+created+successfully.+Please+log+in.");
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
      background: "#020504", 
      fontFamily: "'Inter', sans-serif",
      color: "white"
    }}>
      {/* Left Side - Value Proposition */}
      <div style={{
        flex: 1,
        display: "none",
        flexDirection: "column",
        justifyContent: "center",
        padding: "60px",
        background: "linear-gradient(135deg, rgba(46,139,87,0.1), rgba(0,0,0,0))",
        borderRight: "1px solid rgba(255,255,255,0.05)",
      }} className="desktop-only">
        <h1 style={{ fontSize: "3rem", fontWeight: "800", marginBottom: "24px", lineHeight: "1.1", letterSpacing: "-1px" }}>
          Your Next Big <br/>
          <span style={{ color: "#81c784" }}>Opportunity Awaits.</span>
        </h1>
        <p style={{ color: "#b0c4b8", fontSize: "1.1rem", marginBottom: "40px", maxWidth: "400px", lineHeight: "1.6" }}>
          Create an account to access exclusive job postings, get matched instantly by our AI, and track your application status in real-time.
        </p>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ background: "rgba(46,139,87,0.2)", padding: "10px", borderRadius: "8px", color: "#81c784" }}>⚡</div>
            <span style={{ fontWeight: "600", color: "#e0e0e0" }}>Instant AI Resume Analysis</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ background: "rgba(46,139,87,0.2)", padding: "10px", borderRadius: "8px", color: "#81c784" }}>🎯</div>
            <span style={{ fontWeight: "600", color: "#e0e0e0" }}>Smart Job Matching</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ background: "rgba(46,139,87,0.2)", padding: "10px", borderRadius: "8px", color: "#81c784" }}>📅</div>
            <span style={{ fontWeight: "600", color: "#e0e0e0" }}>Automated Interview Scheduling</span>
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
            <h2 style={{ fontSize: "2rem", fontWeight: "700", marginBottom: "8px" }}>Create Account</h2>
            <p style={{ color: "#b0c4b8" }}>Join the Pentecost Recruitment Platform</p>
          </div>

          {message && (
            <div style={{ marginBottom: "24px", padding: "16px", borderRadius: "12px", background: message.includes("sent") ? "rgba(46, 139, 87, 0.15)" : "rgba(255, 0, 0, 0.1)", color: message.includes("sent") ? "#81c784" : "#ff8a80", fontSize: "0.9rem", textAlign: "center", border: message.includes("sent") ? "1px solid rgba(46,139,87,0.3)" : "none" }}>
              {message}
            </div>
          )}

          <div className="glass-card" style={{ padding: "40px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px" }}>
            <form onSubmit={showOtp ? handleVerifyOtp : handleRequestAccount}>
              {!showOtp ? (
                <>
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "#81c784", fontWeight: "700" }}>USERNAME</label>
                    <input type="text" style={{ width: "100%", padding: "14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", outline: "none" }} placeholder="e.g. john_doe" value={username} onChange={(e) => setUsername(e.target.value)} required />
                  </div>
                  
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "#81c784", fontWeight: "700" }}>PHONE NUMBER</label>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <select style={{ width: "110px", padding: "14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", outline: "none" }} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                        <option value="+233">🇬🇭 +233</option>
                        <option value="+234">🇳🇬 +234</option>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+44">🇬🇧 +44</option>
                      </select>
                      <input type="tel" style={{ flex: 1, padding: "14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", outline: "none" }} placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                    </div>
                  </div>

                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "#81c784", fontWeight: "700" }}>EMAIL ADDRESS</label>
                    <input type="email" style={{ width: "100%", padding: "14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", outline: "none" }} placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>

                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "#81c784", fontWeight: "700" }}>VERIFY VIA</label>
                    <select style={{ width: "100%", padding: "14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", outline: "none", cursor: "pointer" }} value={verificationMethod} onChange={(e) => setVerificationMethod(e.target.value)}>
                      <option value="Email">Email</option>
                      <option value="SMS">SMS (Twilio)</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: "32px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "#81c784", fontWeight: "700" }}>CREATE PASSWORD</label>
                    <input type="password" style={{ width: "100%", padding: "14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", outline: "none" }} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                  </div>

                  <button type="submit" style={{ width: "100%", padding: "16px", background: "linear-gradient(135deg, #2E8B57, #1b5e20)", color: "white", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "1rem", cursor: "pointer", transition: "opacity 0.2s" }} disabled={loading}>
                    {loading ? "Processing..." : "Create Account"}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: "32px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "#81c784", fontWeight: "700", textAlign: "center" }}>ENTER VERIFICATION CODE</label>
                    <input type="text" style={{ width: "100%", padding: "16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px", color: "white", outline: "none", textAlign: "center", fontSize: "1.5rem", letterSpacing: "8px" }} placeholder="000000" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} maxLength={6} required />
                  </div>
                  <button type="submit" style={{ width: "100%", padding: "16px", background: "linear-gradient(135deg, #2E8B57, #1b5e20)", color: "white", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "1rem", cursor: "pointer" }} disabled={loading}>
                    {loading ? "Verifying..." : "Confirm & Access"}
                  </button>
                  <button type="button" onClick={() => setShowOtp(false)} style={{ width: "100%", background: "none", border: "none", color: "#b0c4b8", marginTop: "20px", fontSize: "0.9rem", cursor: "pointer" }}>
                    ← Back to edit details
                  </button>
                </>
              )}
            </form>
          </div>

          {!showOtp && (
            <div style={{ marginTop: "32px", textAlign: "center" }}>
              <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: "#b0c4b8", fontSize: "0.9rem", cursor: "pointer" }}>
                ← Return to Home
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}


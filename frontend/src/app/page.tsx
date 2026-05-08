"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [verificationMethod, setVerificationMethod] = useState("Email");
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.push("/jobs");
      }
    };
    checkUser();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      // Step 1: Login with Username/Password
      // Note: Supabase uses email. We'll handle 'username' as the email prefix or lookup.
      // For this implementation, I'll treat the input as the primary identifier.
      const loginIdentifier = email.includes("@") ? email : `${email}@university.edu`; // Fallback to university domain
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginIdentifier,
        password,
      });
      if (error) throw error;

      // Step 2: Role-based Redirection
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

  const handleRequestAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      // In Supabase, we use OTP for verification
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        phone: verificationMethod === "SMS" ? phone : undefined,
        options: {
          shouldCreateUser: true,
          data: {
            username,
            phone,
            full_name: username, // Fallback
          }
        }
      });
      if (error) throw error;
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
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'signup',
      });
      if (error) throw error;
      router.push("/jobs");
    } catch (error: any) {
      setMessage(error.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "20px" }}>
      <div className="glass-card" style={{ width: "100%", maxWidth: "450px", padding: "48px", textAlign: "center" }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "2.5rem", marginBottom: "8px", background: "linear-gradient(to right, #ffffff, #a5d6a7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Pentecost
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", fontWeight: "500" }}>AI RECRUITMENT PLATFORM</p>
        </div>

        {!showOtp && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "32px", background: "rgba(255,255,255,0.03)", padding: "4px", borderRadius: "12px" }}>
            <button 
              type="button" onClick={() => setIsLogin(true)}
              style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: isLogin ? "rgba(46, 139, 87, 0.2)" : "transparent", color: isLogin ? "white" : "var(--text-secondary)", fontWeight: "600" }}
            >
              Login
            </button>
            <button 
              type="button" onClick={() => setIsLogin(false)}
              style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: !isLogin ? "rgba(46, 139, 87, 0.2)" : "transparent", color: !isLogin ? "white" : "var(--text-secondary)", fontWeight: "600" }}
            >
              Create Account
            </button>
          </div>
        )}

        {message && (
          <div style={{ marginBottom: "20px", padding: "12px", borderRadius: "8px", background: message.includes("sent") ? "rgba(46, 139, 87, 0.2)" : "rgba(255, 0, 0, 0.1)", color: message.includes("sent") ? "#81c784" : "#ff8a80", fontSize: "0.85rem" }}>
            {message}
          </div>
        )}

        <form onSubmit={showOtp ? handleVerifyOtp : (isLogin ? handleLogin : handleRequestAccount)} style={{ textAlign: "left" }}>
          {!showOtp ? (
            <>
              {!isLogin && (
                <>
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "#a5d6a7", fontWeight: "600" }}>USERNAME</label>
                    <input type="text" className="input-field" placeholder="Enter username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                  </div>
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "#a5d6a7", fontWeight: "600" }}>PHONE NUMBER</label>
                    <input type="tel" className="input-field" placeholder="+233..." value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </div>
                </>
              )}

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "#a5d6a7", fontWeight: "600" }}>{isLogin ? "EMAIL OR USERNAME" : "EMAIL ADDRESS"}</label>
                <input type="email" className="input-field" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "#a5d6a7", fontWeight: "600" }}>PASSWORD</label>
                <input type="password" className="input-field" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>

              {!isLogin && (
                <div style={{ marginBottom: "32px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", color: "#a5d6a7", fontWeight: "600" }}>VERIFY VIA</label>
                  <select className="input-field" value={verificationMethod} onChange={(e) => setVerificationMethod(e.target.value)} style={{ appearance: "none" }}>
                    <option value="Email">Email</option>
                    <option value="SMS">SMS (Twilio)</option>
                  </select>
                </div>
              )}

              <button type="submit" className="premium-button" style={{ width: "100%", height: "50px" }} disabled={loading}>
                {loading ? "Processing..." : (isLogin ? "Sign In" : "Create Account")}
              </button>
            </>
          ) : (
            <>
              <div style={{ marginBottom: "32px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "#a5d6a7", fontWeight: "600" }}>VERIFICATION CODE</label>
                <input type="text" className="input-field" placeholder="Enter code" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} maxLength={6} required />
              </div>
              <button type="submit" className="premium-button" style={{ width: "100%", height: "50px" }} disabled={loading}>
                {loading ? "Verifying..." : "Confirm & Access"}
              </button>
              <button type="button" onClick={() => setShowOtp(false)} style={{ width: "100%", background: "none", border: "none", color: "var(--text-secondary)", marginTop: "16px", fontSize: "0.85rem" }}>
                Back to registration
              </button>
            </>
          )}
        </form>
      </div>
    </main>
  );
}



"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";

export default function LandingPage() {
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

  return (
    <main style={{ 
      minHeight: "100vh",
      background: "#020504",
      color: "#e0e0e0",
      fontFamily: "'Inter', sans-serif",
      overflow: "hidden",
      position: "relative"
    }}>
      {/* Dynamic Background Gradients */}
      <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "50vw", height: "50vw", background: "radial-gradient(circle, rgba(46,139,87,0.15) 0%, transparent 70%)", filter: "blur(60px)", zIndex: 0 }}></div>
      <div style={{ position: "absolute", bottom: "-20%", right: "-10%", width: "60vw", height: "60vw", background: "radial-gradient(circle, rgba(129,199,132,0.1) 0%, transparent 70%)", filter: "blur(80px)", zIndex: 0 }}></div>

      {/* Navigation */}
      <nav style={{ position: "relative", zIndex: 10, display: "flex", justifyContent: "space-between", padding: "30px 5%", alignItems: "center" }}>
        <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "white", letterSpacing: "-0.5px" }}>
          PENTECOST <span style={{ color: "#81c784" }}>AI</span>
        </div>
        <div style={{ display: "flex", gap: "20px" }}>
          <button onClick={() => router.push("/login")} style={{ background: "transparent", border: "none", color: "#b0c4b8", fontWeight: "600", fontSize: "1rem", cursor: "pointer" }}>Sign In</button>
          <button onClick={() => router.push("/signup")} style={{ background: "rgba(46,139,87,0.2)", border: "1px solid rgba(46,139,87,0.4)", color: "#81c784", padding: "8px 20px", borderRadius: "99px", fontWeight: "600", fontSize: "0.9rem", cursor: "pointer" }}>Get Started</button>
        </div>
      </nav>

      {/* Hero Section */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", padding: "0 5%", textAlign: "center" }}>
        
        {/* Floating Badges for Engagement */}
        <div style={{ position: "absolute", top: "15%", left: "15%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "12px 24px", borderRadius: "99px", backdropFilter: "blur(10px)", transform: "rotate(-5deg)", animation: "float 6s ease-in-out infinite" }}>
          <span style={{ color: "#81c784", fontWeight: "700", marginRight: "8px" }}>✓</span> AI Screened
        </div>
        <div style={{ position: "absolute", bottom: "25%", right: "15%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "12px 24px", borderRadius: "99px", backdropFilter: "blur(10px)", transform: "rotate(5deg)", animation: "float 8s ease-in-out infinite reverse" }}>
          <span style={{ color: "#ffd54f", fontWeight: "700", marginRight: "8px" }}>⚡</span> 98% Match Rate
        </div>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes float {
            0% { transform: translateY(0px) rotate(-5deg); }
            50% { transform: translateY(-20px) rotate(-2deg); }
            100% { transform: translateY(0px) rotate(-5deg); }
          }
        `}} />

        <h1 style={{ 
          fontSize: "clamp(3rem, 6vw, 5.5rem)", 
          fontWeight: "800", 
          lineHeight: "1.1", 
          marginBottom: "24px",
          color: "white",
          maxWidth: "900px",
          letterSpacing: "-1.5px"
        }}>
          Recruit Smarter with <br/>
          <span style={{ background: "linear-gradient(135deg, #81c784, #2E8B57)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Intelligent AI Matching
          </span>
        </h1>
        
        <p style={{ 
          fontSize: "clamp(1.1rem, 2vw, 1.3rem)", 
          color: "#b0c4b8", 
          maxWidth: "600px", 
          marginBottom: "48px",
          lineHeight: "1.6"
        }}>
          Pentecost University's automated CV analyzer instantly screens candidates, ranks resumes, and schedules interviews seamlessly.
        </p>

        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", justifyContent: "center" }}>
          <button 
            onClick={() => router.push("/jobs")}
            style={{ 
              padding: "16px 36px", 
              fontSize: "1.1rem", 
              fontWeight: "700", 
              background: "linear-gradient(135deg, #2E8B57, #1b5e20)", 
              color: "white", 
              border: "none", 
              borderRadius: "12px", 
              cursor: "pointer",
              boxShadow: "0 8px 32px rgba(46,139,87,0.4)",
              transition: "transform 0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = "translateY(-3px)"}
            onMouseOut={(e) => e.currentTarget.style.transform = "translateY(0)"}
          >
            View Open Jobs
          </button>
          
          <button 
            onClick={() => router.push("/login")}
            style={{ 
              padding: "16px 36px", 
              fontSize: "1.1rem", 
              fontWeight: "600", 
              background: "rgba(255,255,255,0.03)", 
              color: "white", 
              border: "1px solid rgba(255,255,255,0.1)", 
              borderRadius: "12px", 
              cursor: "pointer",
              backdropFilter: "blur(10px)",
              transition: "background 0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
            onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
          >
            Stakeholder Login
          </button>
        </div>
      </div>
    </main>
  );
}



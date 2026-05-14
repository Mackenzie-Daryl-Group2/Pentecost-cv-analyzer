"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { getRoleHome, getUserRole } from "@/utils/roles";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.push(getRoleHome(getUserRole(data.session.user)));
      }
    };
    checkUser();
  }, [router]);

  return (
    <main style={{
      minHeight: "100vh",
      color: "var(--text-primary)",
      background: "var(--landing-background)",
      fontFamily: "'Inter', sans-serif",
    }}>
      <nav className="app-topbar" style={{ maxWidth: "1180px", margin: "0 auto", borderTop: "none", borderLeft: "none", borderRight: "none", background: "var(--landing-nav-bg)" }}>
        <div className="brand-mark" style={{ fontSize: "1.1rem" }}>
          PENTECOST <span>UNIVERSITY</span>
        </div>
        <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
          <button className="quiet-link-button" onClick={() => router.push("/login")}>Sign In</button>
          <button className="premium-button" onClick={() => router.push("/signup")} style={{ padding: "10px 18px" }}>Create Account</button>
        </div>
      </nav>

      <section style={{
        minHeight: "calc(100vh - 76px)",
        display: "grid",
        alignItems: "center",
        justifyItems: "center",
        padding: "44px 24px 84px",
        textAlign: "center",
      }}>
        <div style={{ width: "100%", maxWidth: "840px", margin: "0 auto" }}>
          <div style={{ maxWidth: "840px", margin: "0 auto 34px" }}>
            <p className="eyebrow">Pentecost University Recruitment</p>
            <h1 style={{ fontSize: "4.2rem", lineHeight: "1.04", marginBottom: "22px" }}>
              A clearer way to manage hiring from CV review to onboarding.
            </h1>
            <p className="page-subtitle" style={{ fontSize: "1.08rem", maxWidth: "680px", margin: "0 auto" }}>
              A secure recruitment portal for discovering open roles, submitting applications, coordinating interviews, and keeping every hiring decision easy to track.
            </p>
          </div>

          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", justifyContent: "center" }}>
            <button className="premium-button" onClick={() => router.push("/jobs")} style={{ padding: "14px 24px" }}>
              View Open Roles
            </button>
          </div>
        </div>
      </section>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 760px) {
          h1 { font-size: 2.45rem !important; }
        }
      ` }} />
    </main>
  );
}

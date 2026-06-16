"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { getRoleHome, getUserRole } from "@/utils/roles";
import UniversityBrand from "@/components/UniversityBrand";

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
    <main className="landing-page">
      <nav className="app-topbar landing-nav">
        <UniversityBrand />
        <div className="landing-nav-actions">
          <button className="quiet-link-button" onClick={() => router.push("/login")}>Sign In</button>
          <button className="premium-button" onClick={() => router.push("/signup")}>Create Account</button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <p className="landing-kicker">Pentecost University Recruitment</p>
          <h1>Find your place in a purpose-led university community.</h1>
          <p className="landing-copy">
            Explore current vacancies, submit your application securely, and follow each stage of the recruitment process from one focused portal.
          </p>

          <div className="landing-actions">
            <button className="home-open-roles-button" onClick={() => router.push("/jobs")}>
              <span>View Open Roles</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>
            <button className="landing-secondary-action" onClick={() => router.push("/signup")}>
              Create Applicant Account
            </button>
          </div>

          <div className="landing-proof" aria-label="Recruitment portal highlights">
            <div>
              <strong>Open roles</strong>
              <span>Browse vacancies before applying</span>
            </div>
            <div>
              <strong>Application tracking</strong>
              <span>Follow review, interview, and onboarding progress</span>
            </div>
            <div>
              <strong>Secure access</strong>
              <span>Applicant and staff dashboards stay separated by role</span>
            </div>
          </div>
        </div>

        <div className="landing-status-panel" aria-label="Recruitment portal summary">
          <div>
            <p className="eyebrow">Portal Focus</p>
            <h2>Recruitment made organized</h2>
            <p>
              Designed for applicants, HR, and university stakeholders to keep decisions visible without crowding the process.
            </p>
          </div>
          <div className="landing-status-list">
            <span>CV review</span>
            <span>Interview coordination</span>
            <span>Final approvals</span>
            <span>Onboarding updates</span>
          </div>
        </div>
      </section>
    </main>
  );
}

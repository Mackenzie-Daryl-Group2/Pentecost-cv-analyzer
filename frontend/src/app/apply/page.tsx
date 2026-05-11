"use client";

import React, { useState, useEffect, Suspense } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter, useSearchParams } from "next/navigation";

function ApplyForm() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("+233");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();

  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    setJobId(searchParams.get("jobId"));
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?message=Please+log+in+to+apply");
      } else {
        setFullName(user.user_metadata?.full_name || "");
        setUserEmail(user.email || "");
      }
    };
    checkUser();
  }, [searchParams, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cvFile || !photoFile || !jobId) return;

    setIsSubmitting(true);
    setMessage("");

    try {
      // 1. Upload CV
      const cvName = `${Date.now()}_cv.pdf`;
      const { error: cvErr } = await supabase.storage.from('cvs').upload(cvName, cvFile);
      if (cvErr) throw cvErr;

      // 2. Upload Photo
      const photoName = `${Date.now()}_photo.jpg`;
      const { error: photoErr } = await supabase.storage.from('images').upload(photoName, photoFile);
      if (photoErr) throw photoErr;

      // 3. AI Screening
      const formData = new FormData();
      formData.append("cv_file", cvFile);
      formData.append("job_description", "Requirements for Job #" + jobId); 
      const analysisResponse = await fetch("/api/analyze", { method: "POST", body: formData });
      const analysisData = await analysisResponse.json();
      const score = analysisData.similarity || 0;
      const isPassed = score >= 0.55;

      // 4. Save to Database using the exact columns from the original database schema
      const { error: dbError } = await supabase.from('applications').insert({
        job_id: parseInt(jobId),
        name: fullName,
        email: userEmail,
        phone: `${countryCode}${phone}`,
        cv_path: cvName,
        image_path: photoName,
        similarity: score,
        cv_passed: isPassed,
        status: isPassed ? 'CV Passed' : 'CV Not Passed',
        submitted_at: new Date().toISOString(),
        interview_scheduled_at: isPassed ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() : null,
        interview_meet_link: isPassed ? "https://meet.google.com/xyz-abcd-efg" : null
      });

      if (dbError) throw dbError;

      // 5. Trigger Email
      if (userEmail) {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: userEmail,
            subject: `Application Received: Job #${jobId}`,
            html: `
              <h2>Application Received!</h2>
              <p>Hi ${fullName},</p>
              <p>We have successfully received your application for Job #${jobId}.</p>
              <p>Our AI system has begun screening your CV. You can check the status of your application at any time in the <strong>My Applications</strong> section of your dashboard.</p>
              <br/>
              <p>Best Regards,</p>
              <p>Pentecost Recruitment Team</p>
            `
          })
        });
      }

      router.push("/apply/success");
    } catch (error: any) {
      setMessage(error.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: "48px", maxWidth: "700px", width: "100%" }}>
      <h2 style={{ marginBottom: "8px", color: "white" }}>Submit Application</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: "32px" }}>Complete your profile for Job #{jobId}.</p>

      {message && (
        <div style={{ marginBottom: "24px", padding: "16px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", color: "white" }}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", marginBottom: "8px", color: "var(--accent-neon)", fontSize: "0.8rem", fontWeight: "700" }}>FULL NAME</label>
          <input type="text" className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", marginBottom: "8px", color: "var(--accent-neon)", fontSize: "0.8rem", fontWeight: "700" }}>PHONE NUMBER</label>
          <div style={{ display: "flex", gap: "10px" }}>
            <select className="input-field" style={{ width: "100px" }} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
              <option value="+233">🇬🇭 +233</option>
              <option value="+234">🇳🇬 +234</option>
              <option value="+1">🇺🇸 +1</option>
              <option value="+44">🇬🇧 +44</option>
            </select>
            <input type="tel" className="input-field" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "32px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", color: "var(--accent-neon)", fontSize: "0.8rem", fontWeight: "700" }}>PASSPORT PHOTO</label>
            <input type="file" accept="image/*" className="input-field" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} required />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "8px", color: "var(--accent-neon)", fontSize: "0.8rem", fontWeight: "700" }}>CV (PDF)</label>
            <input type="file" accept=".pdf" className="input-field" onChange={(e) => setCvFile(e.target.files?.[0] || null)} required />
          </div>
        </div>

        <button type="submit" className="premium-button" style={{ width: "100%", height: "56px" }} disabled={isSubmitting}>
          {isSubmitting ? "Processing..." : "Submit Application"}
        </button>
      </form>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <main style={{ padding: "40px", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <Suspense fallback={<div>Loading...</div>}><ApplyForm /></Suspense>
    </main>
  );
}

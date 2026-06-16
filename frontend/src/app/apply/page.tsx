"use client";

import React, { useState, useEffect, Suspense } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { loadJobById, loadJobs, type Job } from "@/utils/jobs";
import { getMatchDecision } from "@/utils/match";
import { getRoleHome, getUserRole, isApplicantRole } from "@/utils/roles";

type SubmitStep = "idle" | "uploading" | "analyzing" | "saving" | "emailing";

function ApplyForm() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("+233");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [submitStep, setSubmitStep] = useState<SubmitStep>("idle");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();

  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const requestedJobId = searchParams.get("jobId");
    setJobId(requestedJobId);

    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?message=Please+log+in+to+apply");
        return;
      } else {
        const role = getUserRole(user);
        if (!isApplicantRole(role)) {
          router.replace(getRoleHome(role));
          return;
        }

        setFullName(user.user_metadata?.full_name || "");
        setUserEmail(user.email || user.user_metadata?.email || "");
      }

      const [jobs, job] = await Promise.all([
        loadJobs(supabase),
        loadJobById(supabase, requestedJobId),
      ]);
      setAvailableJobs(jobs);
      setSelectedJob(job);
      setJobsLoading(false);
    };
    checkUser();
  }, [searchParams, router]);

  function handleJobChange(nextJobId: string) {
    const nextJob = availableJobs.find((job) => String(job.id) === nextJobId) || null;
    setJobId(nextJobId || null);
    setSelectedJob(nextJob);
    setMessage("");
    if (nextJob) {
      router.replace(`/apply?jobId=${nextJob.id}`);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missingItems = [
      !jobId ? "a job vacancy" : "",
      jobId && !selectedJob ? "a valid job vacancy" : "",
      !photoFile ? "a passport photo" : "",
      !cvFile ? "your CV PDF" : "",
    ].filter(Boolean);

    if (missingItems.length) {
      setMessage(`Please choose ${missingItems.join(", ")} before submitting.`);
      return;
    }
    if (!cvFile || !photoFile || !jobId || !selectedJob) return;

    setIsSubmitting(true);
    setMessage("");
    setSubmitStep("uploading");

    try {
      // 1. Upload CV
      const cvName = `${Date.now()}_cv.pdf`;
      const { error: cvErr } = await supabase.storage.from('cvs').upload(cvName, cvFile);
      if (cvErr) throw cvErr;

      // 2. Upload Photo
      const photoExtension = photoFile.name.split(".").pop() || "jpg";
      const photoName = `${Date.now()}_photo.${photoExtension}`;
      const { error: photoErr } = await supabase.storage.from('images').upload(photoName, photoFile);
      if (photoErr) throw photoErr;

      // 3. AI Screening
      setSubmitStep("analyzing");
      const formData = new FormData();
      formData.append("cv_file", cvFile);
      formData.append("job_description", `${selectedJob.title}. ${selectedJob.description}. Requirements: ${selectedJob.requirements}`);
      const analysisResponse = await fetch("/api/analyze", { method: "POST", body: formData });
      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "CV analysis failed");
      }
      const analysisData = await analysisResponse.json();
      const score = analysisData.similarity || 0;
      const decision = getMatchDecision(score);

      // 4. Save to Database using the exact columns from the original database schema
      setSubmitStep("saving");
      const { error: dbError } = await supabase.from('applications').insert({
        job_id: parseInt(jobId),
        name: fullName,
        email: userEmail,
        phone: `${countryCode}${phone}`,
        cv_path: cvName,
        image_path: photoName,
        similarity: score,
        cv_passed: decision.passed,
        status: decision.label,
        submitted_at: new Date().toISOString(),
        interview_scheduled_at: null,
        interview_meet_link: null
      });

      if (dbError) throw dbError;

      // 5. Trigger Email
      setSubmitStep("emailing");
      let emailStatus = "skipped";
      if (userEmail) {
        const emailResponse = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: userEmail,
            subject: `Application Received: ${selectedJob.title}`,
            html: `
              <h2>Application Received!</h2>
              <p>Hi ${fullName},</p>
              <p>We have successfully received your application for <strong>${selectedJob.title}</strong>.</p>
              <p>Your initial CV screening result is: <strong>${decision.label}</strong>.</p>
              <p>${decision.detail}</p>
              <p>You can check your application progress at any time in the <strong>My Applications</strong> section of your dashboard.</p>
              <br/>
              <p>Best Regards,</p>
              <p>Pentecost Recruitment Team</p>
            `
          })
        }).catch(() => null);
        emailStatus = emailResponse?.ok ? "sent" : "failed";
      }

      router.push(`/apply/success?email=${emailStatus}&decision=${encodeURIComponent(decision.label)}`);
    } catch (error: any) {
      setMessage(error.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
      setSubmitStep("idle");
    }
  };

  const stepLabels: Record<SubmitStep, string> = {
    idle: "Ready",
    uploading: "Uploading documents",
    analyzing: "Reviewing CV against requirements",
    saving: "Saving application",
    emailing: "Sending confirmation email",
  };

  return (
    <div className="glass-card" style={{ padding: "40px", maxWidth: "820px", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "24px", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <p style={{ color: "var(--accent-neon)", fontSize: "0.75rem", fontWeight: "800", marginBottom: "8px" }}>APPLICATION FORM</p>
          <h2 style={{ marginBottom: "8px", color: "var(--text-primary)" }}>{selectedJob ? selectedJob.title : "Submit Application"}</h2>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
            {selectedJob ? selectedJob.description : "Complete your profile and upload your documents."}
          </p>
        </div>
        <button type="button" onClick={() => router.push("/jobs")} style={{ background: "var(--surface-1)", border: "1px solid var(--line-soft)", color: "var(--text-primary)", padding: "10px 14px", borderRadius: "10px", fontWeight: "700" }}>
          Change Job
        </button>
      </div>

      {selectedJob && (
        <div style={{ marginBottom: "28px", padding: "18px", borderRadius: "14px", background: "var(--success-soft-bg)", border: "1px solid var(--success-border)" }}>
          <p style={{ color: "var(--accent-neon)", fontSize: "0.75rem", fontWeight: "800", marginBottom: "6px" }}>REQUIREMENTS USED FOR CV REVIEW</p>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>{selectedJob.requirements}</p>
        </div>
      )}

      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "block", marginBottom: "8px", color: "var(--accent-neon)", fontSize: "0.8rem", fontWeight: "700" }}>SELECT JOB VACANCY</label>
        <select
          className="input-field"
          value={jobId || ""}
          onChange={(event) => handleJobChange(event.target.value)}
          disabled={jobsLoading || !availableJobs.length}
          required
        >
          <option value="">{jobsLoading ? "Loading vacancies..." : "Choose a vacancy"}</option>
          {availableJobs.map((job) => (
            <option key={job.id} value={job.id}>{job.title}</option>
          ))}
        </select>
        {!jobsLoading && !availableJobs.length && (
          <p style={{ marginTop: "8px", color: "#ff8a80", fontSize: "0.82rem" }}>No vacancies could be loaded. Please contact HR.</p>
        )}
      </div>

      {message && (
        <div style={{ marginBottom: "24px", padding: "16px", borderRadius: "12px", background: "var(--surface-1)", color: "var(--text-primary)", border: "1px solid var(--line-soft)" }}>
          {message}
        </div>
      )}

      {isSubmitting && (
        <div style={{ marginBottom: "24px", padding: "16px", borderRadius: "12px", background: "var(--success-bg)", border: "1px solid var(--success-border)" }}>
          <p style={{ color: "var(--text-primary)", fontWeight: "800", marginBottom: "6px" }}>{stepLabels[submitStep]}</p>
          <div style={{ height: "8px", borderRadius: "999px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: submitStep === "uploading" ? "25%" : submitStep === "analyzing" ? "50%" : submitStep === "saving" ? "75%" : "92%", background: "var(--primary-button-bg)", transition: "width 0.3s ease" }} />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "24px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", color: "var(--accent-neon)", fontSize: "0.8rem", fontWeight: "700" }}>FULL NAME</label>
            <input type="text" className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "8px", color: "var(--accent-neon)", fontSize: "0.8rem", fontWeight: "700" }}>EMAIL FOR UPDATES</label>
            <input type="email" className="input-field" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} required />
          </div>
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "24px", marginBottom: "32px" }}>
          <div style={{ padding: "18px", borderRadius: "14px", background: "rgba(255,255,255,0.03)", border: photoFile ? "1px solid var(--success-border)" : "1px solid rgba(255,255,255,0.08)" }}>
            <label style={{ display: "block", marginBottom: "8px", color: "var(--accent-neon)", fontSize: "0.8rem", fontWeight: "700" }}>PASSPORT PHOTO</label>
            <input type="file" accept="image/*" className="input-field" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} required />
            <p style={{ marginTop: "10px", color: "var(--text-secondary)", fontSize: "0.8rem" }}>{photoFile ? photoFile.name : "No photo selected yet"}</p>
          </div>
          <div style={{ padding: "18px", borderRadius: "14px", background: "rgba(255,255,255,0.03)", border: cvFile ? "1px solid var(--success-border)" : "1px solid rgba(255,255,255,0.08)" }}>
            <label style={{ display: "block", marginBottom: "8px", color: "var(--accent-neon)", fontSize: "0.8rem", fontWeight: "700" }}>CV (PDF)</label>
            <input type="file" accept=".pdf" className="input-field" onChange={(e) => setCvFile(e.target.files?.[0] || null)} required />
            <p style={{ marginTop: "10px", color: "var(--text-secondary)", fontSize: "0.8rem" }}>{cvFile ? cvFile.name : "No CV selected yet"}</p>
          </div>
        </div>

        <button type="submit" className="premium-button" style={{ width: "100%", height: "56px" }} disabled={isSubmitting || jobsLoading || !selectedJob}>
          {isSubmitting ? stepLabels[submitStep] : selectedJob ? "Submit Application" : jobsLoading ? "Loading Jobs..." : "Select a Valid Job First"}
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

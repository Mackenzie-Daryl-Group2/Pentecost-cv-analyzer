"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";
import { getMatchDecision, getMatchStyle } from "@/utils/match";
import { getJobById, loadJobs, type Job } from "@/utils/jobs";
import { getRoleHome, getUserRole } from "@/utils/roles";
import {
  buildInterviewScoreNote,
  cvAiSummary,
  emptyInterviewScoreForm,
  interviewRecommendation,
  interviewScoreTotal,
  mergeInterviewScoreNote,
  onboardingProgress,
  onboardingEmailForStep,
  onboardingSteps,
  parseInterviewScore,
  type InterviewScoreForm,
} from "@/utils/recruitment-insights";
import UserBadge, { Avatar } from "@/components/UserBadge";
import UniversityBrand from "@/components/UniversityBrand";

interface Application {
  id: number;
  job_id: number;
  name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  image_path?: string | null;
  image_url?: string | null;
  status: string;
  similarity: number;
  cv_passed?: boolean | string | null;
  submitted_at?: string | null;
  interview_scheduled_at?: string | null;
  interview_meet_link?: string | null;
  interview_notes?: string | null;
  interview_passed?: boolean | string | null;
  hr_report_sent?: boolean | string | null;
  pro_vc_approved?: boolean | string | null;
  onboarding_status?: string | null;
}

type JobForm = Omit<Job, "id">;
type HrPanel = "screening" | "interviews" | "hiring" | "vacancies";

const emptyJobForm: JobForm = {
  title: "",
  description: "",
  requirements: "",
  salary: "",
};

const cardStyle: React.CSSProperties = {
  padding: "22px",
  marginBottom: "18px",
  borderRadius: "8px",
};

function truthy(value: unknown) {
  return value === true || ["true", "yes", "1", "passed"].includes(String(value || "").toLowerCase());
}

function candidateName(app: Application) {
  return app.name || app.full_name || "Applicant";
}

function roleTitle(app: Application, jobs: Job[]) {
  return jobs.find((job) => job.id === Number(app.job_id))?.title || getJobById(app.job_id)?.title || `Job ${app.job_id}`;
}

function passedCv(app: Application) {
  return truthy(app.cv_passed) || getMatchDecision(Number(app.similarity || 0)).passed || String(app.status || "").toLowerCase().includes("cv passed");
}

function toDatetimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function escapeHtml(value?: string | null) {
  return String(value || "").replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

function candidatePhotoUrl(app: Application) {
  const storedPath = app.image_url || app.image_path;
  if (!storedPath) return "";
  if (/^https?:\/\//i.test(storedPath)) return storedPath;
  return supabase.storage.from("images").getPublicUrl(storedPath).data.publicUrl;
}

function CandidateSummary({ app, jobs, detail }: { app: Application; jobs: Job[]; detail?: string }) {
  return (
    <div className="candidate-cell">
      <Avatar name={candidateName(app)} src={candidatePhotoUrl(app)} />
      <div>
        <strong>{candidateName(app)}</strong>
        <p>{detail || app.email || app.phone || roleTitle(app, jobs)}</p>
      </div>
    </div>
  );
}

export default function HRDashboard() {
  const [apps, setApps] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [newJob, setNewJob] = useState<JobForm>(emptyJobForm);
  const [editJobId, setEditJobId] = useState<number | null>(null);
  const [editJob, setEditJob] = useState<JobForm>(emptyJobForm);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ datetime: "", meetLink: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activePanel, setActivePanel] = useState<HrPanel>("screening");
  const [applicationSearch, setApplicationSearch] = useState("");
  const [scoreForms, setScoreForms] = useState<Record<number, InterviewScoreForm>>({});
  const router = useRouter();

  async function fetchData() {
    const [applicationsResponse, loadedJobs] = await Promise.all([
      supabase.from("applications").select("*").order("similarity", { ascending: false }),
      loadJobs(supabase),
    ]);

    if (applicationsResponse.error) {
      setMessage(applicationsResponse.error.message);
    } else {
      setApps((applicationsResponse.data || []) as Application[]);
    }

    setJobs(loadedJobs);
    if (loadedJobs.length && !editJobId) {
      setEditJobId(loadedJobs[0].id);
      setEditJob({
        title: loadedJobs[0].title,
        description: loadedJobs[0].description,
        requirements: loadedJobs[0].requirements,
        salary: loadedJobs[0].salary,
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?message=Please+log+in+to+continue");
        return;
      }

      const role = getUserRole(user);
      if (role !== "hr") {
        router.replace(getRoleHome(role));
        return;
      }

      setCurrentUser(user);
      await fetchData();
    };

    init();
  }, [router]);

  const cvPassedApps = useMemo(() => apps.filter(passedCv), [apps]);
  const scheduledApps = useMemo(() => apps.filter((app) => Boolean(app.interview_scheduled_at)), [apps]);
  const passedInterviewApps = useMemo(() => apps.filter((app) => truthy(app.interview_passed)), [apps]);
  const hrReportApps = useMemo(() => apps.filter((app) => passedCv(app) && truthy(app.interview_passed)), [apps]);
  const pendingReviewApps = useMemo(() => apps.filter((app) => !passedCv(app) && !String(app.status || "").toLowerCase().includes("not passed")), [apps]);
  const filteredApps = useMemo(() => {
    const term = applicationSearch.trim().toLowerCase();
    if (!term) return apps;

    return apps.filter((app) =>
      [
        candidateName(app),
        app.email || "",
        app.phone || "",
        roleTitle(app, jobs),
        app.status || "",
      ].some((value) => value.toLowerCase().includes(term))
    );
  }, [apps, applicationSearch, jobs]);

  useEffect(() => {
    if (!selectedScheduleId && cvPassedApps.length) {
      setSelectedScheduleId(cvPassedApps[0].id);
    }
  }, [cvPassedApps, selectedScheduleId]);

  useEffect(() => {
    const selected = apps.find((app) => app.id === selectedScheduleId);
    if (!selected) return;

    setScheduleForm({
      datetime: toDatetimeInput(selected.interview_scheduled_at),
      meetLink: selected.interview_meet_link || "",
      notes: selected.interview_notes || "",
    });
  }, [apps, selectedScheduleId]);

  const selectedScheduleApp = apps.find((app) => app.id === selectedScheduleId);

  async function updateApplication(appId: number, updates: Partial<Application>, successMessage: string) {
    setBusyAction(`app-${appId}`);
    setMessage("");

    const { error } = await supabase.from("applications").update(updates).eq("id", appId);

    if (error) {
      setMessage(error.message);
      setBusyAction("");
      return false;
    } else {
      setMessage(successMessage);
      await fetchData();
    }

    setBusyAction("");
    return true;
  }

  async function sendApplicantEmail(app: Application, subject: string, html: string) {
    if (!app.email) return false;

    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: app.email,
        subject,
        html,
      }),
    }).catch(() => null);

    return Boolean(response?.ok);
  }

  async function sendJobRequest(method: "POST" | "PUT" | "DELETE", body?: Record<string, unknown>, query = "") {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const response = await fetch(`/api/jobs${query}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: method === "DELETE" ? undefined : JSON.stringify(body || {}),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Vacancy action failed.");
    return data;
  }

  function scoreFormFor(appId: number) {
    return scoreForms[appId] || emptyInterviewScoreForm;
  }

  function updateScoreForm(appId: number, updates: Partial<InterviewScoreForm>) {
    setScoreForms((current) => ({
      ...current,
      [appId]: {
        ...emptyInterviewScoreForm,
        ...(current[appId] || {}),
        ...updates,
      },
    }));
  }

  async function handleSaveInterviewScore(app: Application) {
    const form = scoreFormFor(app.id);
    const scoreNote = buildInterviewScoreNote(form);
    const total = interviewScoreTotal(form);
    const recommendation = interviewRecommendation(total);
    const notes = mergeInterviewScoreNote(app.interview_notes, scoreNote);

    const updated = await updateApplication(
      app.id,
      {
        interview_notes: notes,
        status: recommendation.label === "Do not proceed" ? "Interview Review Needed" : "Interview Scored",
      },
      `Interview score saved: ${total}/100 (${recommendation.label}).`
    );

    if (updated) {
      setScoreForms((current) => {
        const next = { ...current };
        delete next[app.id];
        return next;
      });
    }
  }

  async function handleOnboardingStep(app: Application, step: string) {
    const updated = await updateApplication(
      app.id,
      {
        onboarding_status: step,
        status: step === "Completed" ? "Hired / Onboarded" : "Awaiting Onboarding",
      },
      `Onboarding updated: ${step}.`
    );

    if (!updated) return;

    const email = onboardingEmailForStep(step, candidateName(app), roleTitle(app, jobs));
    if (!email) return;

    const emailSent = await sendApplicantEmail(app, email.subject, email.html);
    setMessage(
      app.email
        ? emailSent
          ? `Onboarding updated: ${step}. Applicant was notified by email.`
          : `Onboarding updated: ${step}, but the applicant email could not be sent.`
        : `Onboarding updated: ${step}, but the applicant has no email address on file.`
    );
  }

  async function handleCreateJob(e: React.FormEvent) {
    e.preventDefault();
    setBusyAction("create-job");
    setMessage("");

    try {
      await sendJobRequest("POST", newJob);
      setNewJob(emptyJobForm);
      setMessage("Vacancy published successfully.");
      await fetchData();
    } catch (error: any) {
      setMessage(error.message || "Vacancy could not be published.");
    }

    setBusyAction("");
  }

  async function handleUpdateJob(e: React.FormEvent) {
    e.preventDefault();
    if (!editJobId) return;
    setBusyAction("edit-job");
    setMessage("");

    try {
      await sendJobRequest("PUT", { id: editJobId, ...editJob });
      setMessage("Vacancy updated successfully.");
      await fetchData();
    } catch (error: any) {
      setMessage(error.message || "Vacancy could not be updated.");
    }

    setBusyAction("");
  }

  async function handleRemoveJob() {
    if (!editJobId) return;
    setBusyAction("remove-job");
    setMessage("");

    try {
      await sendJobRequest("DELETE", undefined, `?id=${encodeURIComponent(editJobId)}`);
      setEditJobId(null);
      setEditJob(emptyJobForm);
      setMessage("Vacancy removed successfully.");
      await fetchData();
    } catch (error: any) {
      setMessage(error.message || "Vacancy could not be removed.");
    }

    setBusyAction("");
  }

  async function handleScheduleInterview(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedScheduleApp) return;

    const interviewDate = new Date(scheduleForm.datetime || "");
    const interviewIso = Number.isNaN(interviewDate.getTime()) ? null : interviewDate.toISOString();
    if (!interviewIso) {
      setMessage("Interview date and time are required.");
      return;
    }

    setBusyAction(`app-${selectedScheduleApp.id}`);
    setMessage("Saving interview schedule...");

    try {
      let meetLink = scheduleForm.meetLink.trim();

      const { error: scheduleError } = await supabase
        .from("applications")
        .update({
          status: "Interview Scheduled",
          interview_scheduled_at: interviewIso,
          interview_meet_link: meetLink || null,
          interview_notes: scheduleForm.notes,
        })
        .eq("id", selectedScheduleApp.id);

      if (scheduleError) throw scheduleError;

      let calendarEventLink = "";
      let meetError = "";
      if (!meetLink) {
        setMessage("Schedule saved. Generating Google Meet link...");
        try {
          const meetResponse = await fetch("/api/interviews/google-meet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              candidateName: candidateName(selectedScheduleApp),
              candidateEmail: selectedScheduleApp.email,
              candidatePhone: selectedScheduleApp.phone,
              roleTitle: roleTitle(selectedScheduleApp, jobs),
              scheduledAt: interviewIso,
              notes: scheduleForm.notes,
              organizerEmail: currentUser?.email,
            }),
          });
          const meetData = await meetResponse.json().catch(() => ({}));
          if (!meetResponse.ok) {
            throw new Error(meetData.error || "Google Meet link could not be created.");
          }

          meetLink = meetData.meetLink;
          calendarEventLink = meetData.htmlLink || "";
          setScheduleForm((current) => ({ ...current, meetLink }));

          const { error: linkError } = await supabase
            .from("applications")
            .update({ interview_meet_link: meetLink })
            .eq("id", selectedScheduleApp.id);

          if (linkError) throw linkError;
        } catch (error: any) {
          meetError = error.message || "Google Meet link could not be created.";
        }
      }

      let applicantEmailSent = false;
      if (selectedScheduleApp.email) {
        applicantEmailSent = await sendApplicantEmail(
          selectedScheduleApp,
          `Interview Scheduled: ${roleTitle(selectedScheduleApp, jobs)}`,
          `
            <h2>Interview Scheduled</h2>
            <p>Hi ${escapeHtml(candidateName(selectedScheduleApp))},</p>
            <p>Your interview for <strong>${escapeHtml(roleTitle(selectedScheduleApp, jobs))}</strong> is scheduled for <strong>${escapeHtml(formatDate(interviewIso))}</strong>.</p>
            ${meetLink ? `<p><strong>Meeting link:</strong> <a href="${escapeHtml(meetLink)}">${escapeHtml(meetLink)}</a></p>` : "<p>The meeting link will be shared once it is available.</p>"}
            ${calendarEventLink ? `<p><strong>Calendar event:</strong> <a href="${escapeHtml(calendarEventLink)}">Open event</a></p>` : ""}
            ${scheduleForm.notes ? `<p><strong>Notes:</strong> ${escapeHtml(scheduleForm.notes)}</p>` : ""}
            <p>Please join a few minutes early and keep this email for your records.</p>
            <p>Pentecost Recruitment Team</p>
          `
        );
      }

      const staffResponse = await fetch("/api/interviews/notify-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: candidateName(selectedScheduleApp),
          candidateEmail: selectedScheduleApp.email,
          candidatePhone: selectedScheduleApp.phone,
          roleTitle: roleTitle(selectedScheduleApp, jobs),
          scheduledAt: interviewIso,
          meetLink,
          calendarEventLink,
          notes: scheduleForm.notes,
          organizerEmail: currentUser?.email,
        }),
      }).catch(() => null);
      const staffEmailSent = Boolean(staffResponse?.ok);

      await fetchData();
      setMessage(
        meetError
          ? `Interview time was saved, but the Meet link was not generated: ${meetError}. ${applicantEmailSent || staffEmailSent ? "Schedule email was still sent." : "Schedule email could not be sent."}`
          : !meetLink
          ? applicantEmailSent || staffEmailSent
            ? "Interview scheduled and schedule email sent. Add a meeting link when it is ready."
            : "Interview scheduled, but the schedule email could not be sent."
          : selectedScheduleApp.email
            ? applicantEmailSent
              ? "Interview scheduled. The applicant was emailed, and HR/admins can join from their dashboards."
              : "Interview scheduled and meeting link saved, but the applicant email could not be sent."
            : "Interview scheduled and meeting link saved, but the applicant has no email address on file."
      );
    } catch (error: any) {
      setMessage(error.message || "Interview could not be scheduled.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleInterviewResult(app: Application, passed: boolean) {
    const updated = await updateApplication(
      app.id,
      {
        interview_passed: passed,
        status: passed ? "Interview Passed" : "Interview Not Passed",
      },
      passed ? "Candidate marked as interview passed." : "Candidate marked as interview not passed."
    );

    if (!updated) return;

    const emailSent = await sendApplicantEmail(
      app,
      passed ? `Interview Update: ${roleTitle(app, jobs)}` : `Application Update: ${roleTitle(app, jobs)}`,
      passed
        ? `
          <h2>Interview Update</h2>
          <p>Hi ${escapeHtml(candidateName(app))},</p>
          <p>Thank you for attending your interview for <strong>${escapeHtml(roleTitle(app, jobs))}</strong>.</p>
          <p>You have passed the interview stage and your application has moved to final hiring review.</p>
          <p>Our HR team will contact you once the final decision and onboarding steps are confirmed.</p>
          <p>Pentecost Recruitment Team</p>
        `
        : `
          <h2>Application Update</h2>
          <p>Hi ${escapeHtml(candidateName(app))},</p>
          <p>Thank you for interviewing for <strong>${escapeHtml(roleTitle(app, jobs))}</strong>.</p>
          <p>After the interview review, we are sorry to inform you that your application will not move forward for this position.</p>
          <p>We appreciate your interest in Pentecost University and wish you the best in your search.</p>
          <p>Pentecost Recruitment Team</p>
        `
    );

    setMessage(
      app.email
        ? emailSent
          ? passed
            ? "Interview passed. Applicant was notified and moved to final hiring review."
            : "Interview not passed. Applicant was notified by email."
          : "Interview result saved, but the applicant email could not be sent."
        : "Interview result saved, but the applicant has no email address on file."
    );
  }

  async function handleApproveCv(app: Application, status = "CV Passed by HR") {
    const updated = await updateApplication(
      app.id,
      {
        cv_passed: true,
        status,
      },
      status === "Recommended for Interview"
        ? "Candidate recommended for interview."
        : "Candidate approved for CV stage."
    );

    if (!updated || status !== "Recommended for Interview") return;

    const emailSent = await sendApplicantEmail(
      app,
      `Interview Recommendation: ${roleTitle(app, jobs)}`,
      `
        <h2>Recommended for Interview</h2>
        <p>Hi ${escapeHtml(candidateName(app))},</p>
        <p>Your application for <strong>${escapeHtml(roleTitle(app, jobs))}</strong> has been recommended for an interview.</p>
        <p>Our HR team will send the interview date, Google Meet link, and any preparation notes as soon as the schedule is confirmed.</p>
        <p>Pentecost Recruitment Team</p>
      `
    );

    setMessage(
      app.email
        ? emailSent
          ? "Candidate recommended for interview and notified. Schedule the interview to send the Meet link and date."
          : "Candidate recommended for interview, but the email notification could not be sent."
        : "Candidate recommended for interview, but there is no applicant email address on file."
    );
  }

  async function handleRecommendForHire(app: Application) {
    await updateApplication(
      app.id,
      {
        hr_report_sent: true,
        status: "Recommended for Hire",
      },
      "Candidate recommended for hire and sent for PRO-VC review."
    );
  }

  async function handleHiring(app: Application) {
    const updated = await updateApplication(
      app.id,
      {
        onboarding_status: "Started",
        status: "Awaiting Onboarding",
      },
      "Hiring approved and onboarding started."
    );

    if (!updated) return;

    const emailSent = await sendApplicantEmail(
      app,
      "Welcome to Pentecost University - Official Offer",
      `
        <h2>Welcome to Pentecost University</h2>
        <p>Hello ${escapeHtml(candidateName(app))},</p>
        <p>We are pleased to inform you that you have been selected for <strong>${escapeHtml(roleTitle(app, jobs))}</strong> at Pentecost University.</p>
        <p>Your onboarding process has started. Our HR team will contact you with the next steps.</p>
        <p>Regards,<br/>Pentecost University HR Department</p>
      `
    );

    setMessage(
      app.email
        ? emailSent
          ? "Hiring approved, onboarding started, and the offer email was sent."
          : "Hiring approved and onboarding started, but the offer email could not be sent."
        : "Hiring approved and onboarding started, but the applicant has no email address on file."
    );
  }

  async function handleRejectCv(app: Application) {
    setBusyAction(`app-${app.id}`);
    setMessage("");

    const { error } = await supabase
      .from("applications")
      .update({
        cv_passed: false,
        status: "CV Not Passed",
      })
      .eq("id", app.id);

    if (error) {
      setMessage(error.message);
      setBusyAction("");
      return;
    }

    let emailSent = false;
    if (app.email) {
      const emailResponse = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: app.email,
          subject: `Application Update: ${roleTitle(app, jobs)}`,
          html: `
            <h2>Application Update</h2>
            <p>Hi ${candidateName(app)},</p>
            <p>Thank you for applying for <strong>${roleTitle(app, jobs)}</strong> at Pentecost University.</p>
            <p>After reviewing your CV against the role requirements, we are sorry to inform you that you do not qualify for this position.</p>
            <p>We appreciate your interest and encourage you to apply for future opportunities that match your profile.</p>
            <br/>
            <p>Pentecost Recruitment Team</p>
          `,
        }),
      }).catch(() => null);

      emailSent = Boolean(emailResponse?.ok);
    }

    await fetchData();
    setMessage(
      app.email
        ? emailSent
          ? "CV rejected and email notification sent to the applicant."
          : "CV rejected, but the email notification could not be sent."
        : "CV rejected, but the applicant has no email address on file."
    );
    setBusyAction("");
  }

  function downloadReport() {
    const lines = ["HR Final Report (CV + Interview Passed)", ""];
    if (!hrReportApps.length) {
      lines.push("No passed applicants yet.");
    } else {
      hrReportApps.forEach((app) => {
        lines.push(
          `${candidateName(app)} | ${app.email || ""} | ${roleTitle(app, jobs)} | Similarity ${Number(app.similarity || 0).toFixed(2)} | ${app.status}`
        );
      });
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hr_final_report.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  const metricCards = [
    { label: "Total Vacancies", value: jobs.length },
    { label: "Total Applications", value: apps.length },
    { label: "CV Passed Candidates", value: cvPassedApps.length },
    { label: "Scheduled Interviews", value: scheduledApps.length },
    { label: "Ready for Hiring", value: passedInterviewApps.length },
  ];

  const panels: Array<{ id: HrPanel; label: string; count: number }> = [
    { id: "screening", label: "Screening", count: pendingReviewApps.length || apps.length },
    { id: "interviews", label: "Interviews", count: scheduledApps.length + cvPassedApps.length },
    { id: "hiring", label: "Hiring", count: passedInterviewApps.length },
    { id: "vacancies", label: "Vacancies", count: jobs.length },
  ];

  if (loading) {
    return (
      <main className="app-shell">
        <p>Loading HR dashboard...</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="page-container">
        <header className="app-topbar">
          <div className="dashboard-brand-title">
            <UniversityBrand />
            <div>
            <p className="eyebrow">Human Resources</p>
            <h1 className="page-title">HR Operations</h1>
            <p className="page-subtitle">Manage vacancies, CV decisions, interviews, hiring approvals, onboarding, and final reports.</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <UserBadge user={currentUser} label="HR account" onUserUpdated={setCurrentUser} />
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/");
              }}
              style={{ background: "rgba(255,0,0,0.1)", color: "#ff8a80", border: "1px solid rgba(255,0,0,0.2)", padding: "10px 16px", borderRadius: "8px", fontWeight: "700" }}
            >
              Logout
            </button>
          </div>
        </header>

        {message && (
          <div style={{ marginBottom: "22px", padding: "14px 16px", borderRadius: "12px", background: "var(--surface-1)", border: "1px solid var(--line-soft)", color: "var(--text-primary)" }}>
            {message}
          </div>
        )}

        <section className="metric-grid">
          {metricCards.map((metric) => (
            <div key={metric.label} className="glass-card metric-card">
              <p>{metric.label}</p>
              <h2>{metric.value}</h2>
            </div>
          ))}
        </section>

        {scheduledApps.length > 0 && (
          <section className="glass-card upcoming-interviews">
            <div className="section-heading">
              <div>
                <h2>Upcoming Interview Meetings</h2>
                <p className="status-note">Join scheduled meetings directly from the HR dashboard.</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => setActivePanel("interviews")}>
                View Interviews
              </button>
            </div>
            <div className="meeting-list">
              {scheduledApps.map((app) => (
                <article key={app.id} className="meeting-row">
                  <CandidateSummary app={app} jobs={jobs} detail={roleTitle(app, jobs)} />
                  <div>
                    <p className="eyebrow">Scheduled Time</p>
                    <strong>{formatDate(app.interview_scheduled_at)}</strong>
                  </div>
                  <div className="meeting-actions">
                    {app.interview_meet_link ? (
                      <a className="premium-button" href={app.interview_meet_link} target="_blank" rel="noreferrer">
                        Join Meeting
                      </a>
                    ) : (
                      <span className="status-note">No meeting link saved</span>
                    )}
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        setSelectedScheduleId(app.id);
                        setActivePanel("interviews");
                      }}
                    >
                      Details
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="tab-strip" aria-label="HR workflow sections">
          {panels.map((panel) => (
            <button
              key={panel.id}
              type="button"
              className="tab-button"
              data-active={activePanel === panel.id}
              onClick={() => setActivePanel(panel.id)}
            >
              {panel.label}
              <span className="tab-count">{panel.count}</span>
            </button>
          ))}
        </div>

        {activePanel === "vacancies" && (
          <>
        <section className="glass-card" style={cardStyle}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "18px" }}>Create Job Vacancy</h2>
          <form onSubmit={handleCreateJob} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <input className="input-field" placeholder="Job title" value={newJob.title} onChange={(e) => setNewJob({ ...newJob, title: e.target.value })} required />
            <input className="input-field" placeholder="Salary" value={newJob.salary} onChange={(e) => setNewJob({ ...newJob, salary: e.target.value })} required />
            <textarea className="input-field" placeholder="Description" rows={3} value={newJob.description} onChange={(e) => setNewJob({ ...newJob, description: e.target.value })} required />
            <textarea className="input-field" placeholder="Requirements" rows={3} value={newJob.requirements} onChange={(e) => setNewJob({ ...newJob, requirements: e.target.value })} required />
            <button className="premium-button" type="submit" disabled={busyAction === "create-job"} style={{ height: "48px" }}>
              {busyAction === "create-job" ? "Publishing..." : "Publish Vacancy"}
            </button>
          </form>
        </section>

        <section className="glass-card" style={cardStyle}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "18px" }}>Edit or Remove Job Vacancy</h2>
          {jobs.length ? (
            <form onSubmit={handleUpdateJob} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
              <select
                className="input-field"
                value={editJobId || ""}
                onChange={(e) => {
                  const selectedId = Number(e.target.value);
                  const selectedJob = jobs.find((job) => job.id === selectedId);
                  setEditJobId(selectedId);
                  if (selectedJob) {
                    setEditJob({
                      title: selectedJob.title,
                      description: selectedJob.description,
                      requirements: selectedJob.requirements,
                      salary: selectedJob.salary,
                    });
                  }
                }}
              >
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>{job.id} - {job.title}</option>
                ))}
              </select>
              <input className="input-field" placeholder="Job title" value={editJob.title} onChange={(e) => setEditJob({ ...editJob, title: e.target.value })} required />
              <input className="input-field" placeholder="Salary" value={editJob.salary} onChange={(e) => setEditJob({ ...editJob, salary: e.target.value })} required />
              <textarea className="input-field" placeholder="Description" rows={3} value={editJob.description} onChange={(e) => setEditJob({ ...editJob, description: e.target.value })} required />
              <textarea className="input-field" placeholder="Requirements" rows={3} value={editJob.requirements} onChange={(e) => setEditJob({ ...editJob, requirements: e.target.value })} required />
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button className="premium-button" type="submit" disabled={busyAction === "edit-job"}>{busyAction === "edit-job" ? "Updating..." : "Update Vacancy"}</button>
                <button type="button" onClick={handleRemoveJob} disabled={busyAction === "remove-job"} style={{ background: "rgba(255,0,0,0.1)", color: "#ff8a80", border: "1px solid rgba(255,0,0,0.2)", padding: "12px 16px", borderRadius: "10px", fontWeight: "800" }}>
                  {busyAction === "remove-job" ? "Removing..." : "Remove"}
                </button>
              </div>
            </form>
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>No active jobs to edit.</p>
          )}
        </section>
          </>
        )}

        {activePanel === "interviews" && (
          <>
        <section className="glass-card" style={cardStyle}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "18px" }}>Applicants Who Passed CV Mark</h2>
          {cvPassedApps.length && selectedScheduleApp ? (
            <div className="hr-schedule-workspace">
              <div className="hr-schedule-candidate-list">
                {cvPassedApps.map((app) => {
                  const decision = getMatchDecision(Number(app.similarity || 0));
                  const isSelected = selectedScheduleId === app.id;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      className="hr-schedule-candidate"
                      data-active={isSelected}
                      onClick={() => setSelectedScheduleId(app.id)}
                    >
                      <CandidateSummary app={app} jobs={jobs} detail={app.email || app.phone || "No contact on file"} />
                      <div>
                        <p className="eyebrow">Role</p>
                        <strong>{roleTitle(app, jobs)}</strong>
                        <span style={{ ...getMatchStyle(decision.tone), display: "inline-block", marginTop: "8px", padding: "6px 10px", borderRadius: "999px", fontSize: "0.7rem", fontWeight: "800" }}>
                          {decision.label}
                        </span>
                      </div>
                      <div>
                        <p className="eyebrow">Schedule</p>
                        <strong>{formatDate(app.interview_scheduled_at)}</strong>
                        <p className="status-note">{app.interview_meet_link ? "Meeting link saved" : "No meeting link yet"}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleScheduleInterview} className="hr-schedule-form">
                <div>
                  <p className="eyebrow">Schedule meeting for</p>
                  <h3>{candidateName(selectedScheduleApp)} - {roleTitle(selectedScheduleApp, jobs)}</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "6px" }}>Current schedule: {formatDate(selectedScheduleApp.interview_scheduled_at)}</p>
                  <p className="status-note" style={{ marginTop: "8px" }}>{selectedScheduleApp.email || "No applicant email on file"}</p>
                  {selectedScheduleApp.interview_meet_link && (
                    <a
                      className="secondary-button"
                      href={selectedScheduleApp.interview_meet_link}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "inline-flex", marginTop: "10px", textDecoration: "none" }}
                    >
                      Join Meeting
                    </a>
                  )}
                </div>
                {message && (
                  <p className="status-note" style={{ background: "var(--surface-1)", border: "1px solid var(--line-soft)", borderRadius: "8px", padding: "10px" }}>
                    {message}
                  </p>
                )}
                <input className="input-field" type="datetime-local" value={scheduleForm.datetime} onChange={(e) => setScheduleForm({ ...scheduleForm, datetime: e.target.value })} required />
                <input className="input-field" placeholder="Google Meet link will be generated automatically, or paste one manually" value={scheduleForm.meetLink} onChange={(e) => setScheduleForm({ ...scheduleForm, meetLink: e.target.value })} />
                <textarea className="input-field" placeholder="Interview notes or venue" rows={4} value={scheduleForm.notes} onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })} />
                <button className="premium-button" type="submit" disabled={busyAction === `app-${selectedScheduleApp.id}`}>
                  Schedule / Generate Meet Link
                </button>
              </form>
            </div>
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>No applicant has passed the CV mark yet.</p>
          )}
        </section>

        <section className="glass-card" style={cardStyle}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "18px" }}>Interview Results</h2>
          {scheduledApps.length ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {scheduledApps.map((app) => {
                const savedScore = parseInterviewScore(app.interview_notes);
                const scoreForm = scoreFormFor(app.id);
                const draftScore = interviewScoreTotal(scoreForm);
                const recommendation = interviewRecommendation(savedScore);

                return (
                  <div key={app.id} style={{ display: "grid", gap: "12px", padding: "14px", borderRadius: "12px", background: "rgba(255,255,255,0.04)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1fr) auto", gap: "12px", alignItems: "center" }}>
                      <CandidateSummary app={app} jobs={jobs} detail={roleTitle(app, jobs)} />
                      <div>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.86rem" }}>{formatDate(app.interview_scheduled_at)}</p>
                        <p style={{ color: "var(--accent-neon)", fontWeight: "800", marginTop: "4px" }}>
                          Mark score: {savedScore === null ? "Not scored" : `${savedScore}/100`}
                        </p>
                        <p className="status-note">{recommendation.label} - {recommendation.detail}</p>
                        {app.interview_meet_link && (
                          <a
                            href={app.interview_meet_link}
                            target="_blank"
                            rel="noreferrer"
                            className="secondary-button"
                            style={{ display: "inline-flex", marginTop: "10px", textDecoration: "none" }}
                          >
                            Join Meeting
                          </a>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <button onClick={() => handleInterviewResult(app, true)} style={{ background: "var(--success-bg)", color: "var(--accent-neon)", border: "1px solid var(--success-border)", padding: "9px 12px", borderRadius: "8px", fontWeight: "800" }}>Passed</button>
                        <button onClick={() => handleInterviewResult(app, false)} style={{ background: "var(--surface-1)", color: "var(--text-primary)", border: "1px solid var(--line-soft)", padding: "9px 12px", borderRadius: "8px", fontWeight: "800" }}>Not Passed</button>
                      </div>
                    </div>
                    <details>
                      <summary style={{ cursor: "pointer", color: "var(--accent-neon)", fontWeight: "800" }}>Interview scoring sheet</summary>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", marginTop: "12px" }}>
                        <input className="input-field" type="number" min="0" max="25" placeholder="Communication /25" value={scoreForm.communication} onChange={(event) => updateScoreForm(app.id, { communication: event.target.value })} />
                        <input className="input-field" type="number" min="0" max="25" placeholder="Role knowledge /25" value={scoreForm.roleKnowledge} onChange={(event) => updateScoreForm(app.id, { roleKnowledge: event.target.value })} />
                        <input className="input-field" type="number" min="0" max="25" placeholder="Experience /25" value={scoreForm.experience} onChange={(event) => updateScoreForm(app.id, { experience: event.target.value })} />
                        <input className="input-field" type="number" min="0" max="25" placeholder="Culture fit /25" value={scoreForm.cultureFit} onChange={(event) => updateScoreForm(app.id, { cultureFit: event.target.value })} />
                      </div>
                      <textarea className="input-field" rows={3} placeholder="Panel notes" value={scoreForm.notes} onChange={(event) => updateScoreForm(app.id, { notes: event.target.value })} style={{ marginTop: "10px" }} />
                      <div style={{ display: "flex", gap: "10px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", marginTop: "10px" }}>
                        <p className="status-note">Draft score: {draftScore}/100 - {interviewRecommendation(draftScore).label}</p>
                        <button className="premium-button" onClick={() => handleSaveInterviewScore(app)} disabled={busyAction === `app-${app.id}`}>
                          Save Score
                        </button>
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>No interview schedule has been added yet.</p>
          )}
        </section>
          </>
        )}

        {activePanel === "hiring" && (
        <section className="glass-card" style={cardStyle}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "18px" }}>Final Hiring Approval & Onboarding</h2>
          {passedInterviewApps.length ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {passedInterviewApps.map((app) => {
                const progress = onboardingProgress(app.onboarding_status);
                const savedScore = parseInterviewScore(app.interview_notes);

                return (
                  <div key={app.id} style={{ display: "grid", gap: "12px", padding: "14px", borderRadius: "12px", background: "rgba(255,255,255,0.04)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) minmax(180px, auto) auto", gap: "12px", alignItems: "center" }}>
                      <CandidateSummary
                        app={app}
                        jobs={jobs}
                        detail={`${roleTitle(app, jobs)} | ${app.pro_vc_approved ? "Recommended by PRO-VC" : truthy(app.hr_report_sent) ? "Recommended for hire; awaiting PRO-VC" : "Ready for HR decision"}`}
                      />
                      <div>
                        <span style={{ color: "var(--accent-neon)", fontWeight: "800" }}>{app.onboarding_status || "Not started"}</span>
                        <p className="status-note">Interview score: {savedScore === null ? "Not scored" : `${savedScore}/100`}</p>
                      </div>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <button disabled={busyAction === `app-${app.id}` || truthy(app.hr_report_sent)} onClick={() => handleRecommendForHire(app)} style={{ background: "var(--surface-1)", color: "var(--text-primary)", border: "1px solid var(--line-soft)", padding: "9px 12px", borderRadius: "8px", fontWeight: "800", opacity: truthy(app.hr_report_sent) ? 0.55 : 1 }}>
                          {truthy(app.hr_report_sent) ? "Recommended" : "Recommend for Hire"}
                        </button>
                        <button disabled={busyAction === `app-${app.id}`} onClick={() => handleHiring(app)} className="premium-button">Approve Candidate</button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px" }}>
                      {onboardingSteps.map((step, index) => (
                        <button
                          key={step}
                          type="button"
                          onClick={() => handleOnboardingStep(app, step)}
                          disabled={busyAction === `app-${app.id}`}
                          style={{
                            background: index <= progress ? "var(--success-bg)" : "var(--surface-1)",
                            color: index <= progress ? "var(--accent-neon)" : "var(--text-secondary)",
                            border: index <= progress ? "1px solid var(--success-border)" : "1px solid var(--line-soft)",
                            padding: "9px 10px",
                            borderRadius: "8px",
                            fontWeight: "800",
                            textAlign: "left",
                          }}
                        >
                          {step}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>No candidates have passed the interview stage yet.</p>
          )}
        </section>
        )}

        {activePanel === "screening" && (
        <section className="glass-card" style={cardStyle}>
          <div className="section-heading">
            <div>
              <h2>Application Screening</h2>
              <p className="status-note">{filteredApps.length} of {apps.length} applications shown</p>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <input
                className="input-field"
                placeholder="Search candidate, role, email, or status"
                value={applicationSearch}
                onChange={(e) => setApplicationSearch(e.target.value)}
                style={{ width: "min(360px, 78vw)" }}
              />
              <button onClick={downloadReport} className="secondary-button">
                Download HR Report
              </button>
            </div>
          </div>
          <div className="hr-screening-list">
            {filteredApps.map((app) => {
              const decision = getMatchDecision(Number(app.similarity || 0));
              const interviewScore = parseInterviewScore(app.interview_notes);
              const recommendation = interviewRecommendation(interviewScore);
              const interviewState = truthy(app.interview_passed) ? "Passed" : app.interview_scheduled_at ? "Scheduled" : "Not scheduled";
              const matchPercent = Math.max(0, Math.min(100, Math.round(Number(app.similarity || 0) * 100)));
              const aiSummary = cvAiSummary(candidateName(app), roleTitle(app, jobs), Number(app.similarity || 0), app.status);
              const shortAiSummary = aiSummary.length > 120 ? `${aiSummary.slice(0, 117)}...` : aiSummary;

              return (
                <article key={app.id} className="hr-screening-card">
                  <div className="application-profile">
                    <Avatar name={candidateName(app)} src={candidatePhotoUrl(app)} />
                    <div>
                      <p className="eyebrow">Candidate</p>
                      <h3>{candidateName(app)}</h3>
                      <p className="status-note">{app.email || app.phone || "No contact on file"}</p>
                      <span className="status-pill">{app.status}</span>
                    </div>
                  </div>

                  <div className="application-intelligence">
                    <div className="insight-card">
                      <p className="eyebrow">Role Match</p>
                      <strong>{roleTitle(app, jobs)}</strong>
                      <span style={{ ...getMatchStyle(decision.tone), display: "inline-block", marginTop: "10px", padding: "6px 10px", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 850 }}>
                        {decision.label}
                      </span>
                    </div>
                    <div className="insight-card">
                      <p className="eyebrow">AI Screening Summary</p>
                      <div className="ai-score-review">
                        <div className="ai-score-circle" style={{ "--score": `${matchPercent}%` } as React.CSSProperties} aria-label={`AI CV match score ${matchPercent}%`}>
                          <span>{matchPercent}%</span>
                        </div>
                        <div>
                          <strong>CV match</strong>
                          <p>{decision.label}</p>
                        </div>
                      </div>
                      <p className="status-note ai-review-summary">{shortAiSummary}</p>
                    </div>
                    <div className="insight-card">
                      <p className="eyebrow">Pipeline</p>
                      <strong>{interviewState}</strong>
                      <p className="status-note">{formatDate(app.interview_scheduled_at)}</p>
                      <p className="status-note">Score: {interviewScore === null ? "Not scored" : `${interviewScore}/100`} · {recommendation.label}</p>
                      <p className="status-note">Onboarding: {app.onboarding_status || "Not started"}</p>
                    </div>
                  </div>

                  <div className="hr-decision-panel">
                    <p className="eyebrow">HR Decision</p>
                    <div className="action-grid">
                      {!passedCv(app) && (
                        <>
                          <button disabled={busyAction === `app-${app.id}`} onClick={() => handleApproveCv(app)} className="secondary-button">
                            {busyAction === `app-${app.id}` ? "Saving..." : "Approve CV"}
                          </button>
                          <button disabled={busyAction === `app-${app.id}`} onClick={() => handleApproveCv(app, "Recommended for Interview")} className="secondary-button">
                            Recommend Interview
                          </button>
                        </>
                      )}
                      <button disabled={busyAction === `app-${app.id}`} onClick={() => handleRejectCv(app)} className="secondary-button">
                        {busyAction === `app-${app.id}` ? "Saving..." : "Reject CV"}
                      </button>
                      {passedCv(app) && (
                        <button disabled={busyAction === `app-${app.id}`} onClick={() => { setSelectedScheduleId(app.id); setActivePanel("interviews"); }} className="premium-button">
                          Schedule Interview
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {!filteredApps.length && (
            <p style={{ color: "var(--text-secondary)", marginTop: "16px" }}>No applications match that search.</p>
          )}
        </section>
        )}
      </div>
    </main>
  );
}

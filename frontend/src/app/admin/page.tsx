"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { getJobById, loadJobs, type Job } from "@/utils/jobs";
import { getMatchDecision, getMatchStyle } from "@/utils/match";
import { getRoleHome, getUserRole } from "@/utils/roles";
import {
  cvAiSummary,
  interviewRecommendation,
  onboardingEmailForStep,
  onboardingSteps,
  parseInterviewScore,
} from "@/utils/recruitment-insights";
import UserBadge from "@/components/UserBadge";
import UniversityBrand from "@/components/UniversityBrand";

interface Application {
  id: number;
  job_id: number;
  name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  status: string;
  similarity: number;
  cv_passed?: boolean | string | null;
  interview_scheduled_at?: string | null;
  interview_meet_link?: string | null;
  interview_notes?: string | null;
  interview_passed?: boolean | string | null;
  hr_report_sent?: boolean | string | null;
  pro_vc_approved?: boolean | string | null;
  onboarding_status?: string | null;
}

type AdminPanel = "overview" | "applications" | "recommendations" | "vacancies" | "roles" | "reports";
type JobForm = Omit<Job, "id">;

const emptyJobForm: JobForm = {
  title: "",
  description: "",
  requirements: "",
  salary: "",
};

const roleMatrix = [
  { role: "Admin", power: "Full control", detail: "Vacancies, applications, HR actions, final overrides, reports, role visibility." },
  { role: "HR", power: "Recruitment operations", detail: "CV review, interview scheduling, interview results, hiring and onboarding." },
  { role: "PRO-VC", power: "Executive recommendation", detail: "Reviews HR reports and submits recommendation decisions." },
  { role: "Registrar", power: "Records visibility", detail: "Tracks submitted applications, interviews, and final records." },
  { role: "Applicant", power: "Self service", detail: "Applies for vacancies and tracks application/interview status." },
];

const adminPowerMatrix = [
  { power: "Create, edit, and remove vacancies", roles: ["Admin", "HR"] },
  { power: "Approve or reject CVs", roles: ["Admin", "HR"] },
  { power: "Mark interview outcomes", roles: ["Admin", "HR"] },
  { power: "Recommend or approve hiring", roles: ["Admin", "HR", "PRO-VC"] },
  { power: "Override application status", roles: ["Admin"] },
  { power: "Download institution-wide reports", roles: ["Admin", "Registrar"] },
];

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

function formatDate(value?: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

async function sendApplicantEmail(app: Application, subject: string, html: string) {
  if (!app.email) return false;

  const response = await fetch("/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: app.email, subject, html }),
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

export default function AdminDashboard() {
  const [apps, setApps] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [newJob, setNewJob] = useState<JobForm>(emptyJobForm);
  const [editJobId, setEditJobId] = useState<number | null>(null);
  const [editJob, setEditJob] = useState<JobForm>(emptyJobForm);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [activePanel, setActivePanel] = useState<AdminPanel>("overview");
  const [search, setSearch] = useState("");
  const router = useRouter();

  async function fetchData() {
    const [applicationsResponse, loadedJobs] = await Promise.all([
      supabase.from("applications").select("*").order("submitted_at", { ascending: false }),
      loadJobs(supabase),
    ]);

    if (applicationsResponse.error) {
      setMessage(applicationsResponse.error.message);
    } else {
      setApps((applicationsResponse.data || []) as Application[]);
    }

    setJobs(loadedJobs);
    if (loadedJobs.length && !editJobId) {
      const firstJob = loadedJobs[0];
      setEditJobId(firstJob.id);
      setEditJob({
        title: firstJob.title,
        description: firstJob.description,
        requirements: firstJob.requirements,
        salary: firstJob.salary,
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
      if (role !== "admin") {
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
  const interviewPassedApps = useMemo(() => apps.filter((app) => truthy(app.interview_passed)), [apps]);
  const hiredApps = useMemo(() => apps.filter((app) => String(app.status || "").toLowerCase().includes("hired")), [apps]);
  const filteredApps = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return apps;

    return apps.filter((app) =>
      [candidateName(app), app.email || "", app.phone || "", roleTitle(app, jobs), app.status || ""]
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [apps, jobs, search]);
  const bestApplicationsByRole = useMemo(() => {
    return jobs
      .map((job) => ({
        job,
        applicants: apps
          .filter((app) => Number(app.job_id) === Number(job.id))
          .sort((a, b) => Number(b.similarity || 0) - Number(a.similarity || 0))
          .slice(0, 3),
      }))
      .filter((group) => group.applicants.length);
  }, [apps, jobs]);

  async function updateApplication(app: Application, updates: Partial<Application>, successMessage: string) {
    setBusyAction(`app-${app.id}`);
    setMessage("");

    const { error } = await supabase.from("applications").update(updates).eq("id", app.id);

    if (error) {
      setMessage(error.message);
      setBusyAction("");
      return false;
    }

    setMessage(successMessage);
    await fetchData();
    setBusyAction("");
    return true;
  }

  async function handleCreateJob(event: React.FormEvent) {
    event.preventDefault();
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

  async function handleUpdateJob(event: React.FormEvent) {
    event.preventDefault();
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

  async function handleApproveCv(app: Application) {
    const updated = await updateApplication(app, { cv_passed: true, status: "CV Passed by Admin" }, "CV approved by admin.");
    if (updated) {
      await sendApplicantEmail(app, `CV Review Update: ${roleTitle(app, jobs)}`, `
        <h2>CV Review Update</h2>
        <p>Hi ${candidateName(app)},</p>
        <p>Your CV for <strong>${roleTitle(app, jobs)}</strong> has passed administrative review.</p>
        <p>Pentecost Recruitment Team</p>
      `);
    }
  }

  async function handleRejectCv(app: Application) {
    const updated = await updateApplication(app, { cv_passed: false, status: "CV Not Passed" }, "CV rejected by admin.");
    if (updated) {
      const emailSent = await sendApplicantEmail(app, `Application Update: ${roleTitle(app, jobs)}`, `
        <h2>Application Update</h2>
        <p>Hi ${candidateName(app)},</p>
        <p>After reviewing your CV against the requirements for <strong>${roleTitle(app, jobs)}</strong>, we are sorry to inform you that you do not qualify for this position.</p>
        <p>Pentecost Recruitment Team</p>
      `);
      setMessage(emailSent ? "CV rejected and applicant notified." : "CV rejected. Applicant email could not be sent.");
    }
  }

  async function handleInterviewResult(app: Application, passed: boolean) {
    const updated = await updateApplication(
      app,
      { interview_passed: passed, status: passed ? "Interview Passed" : "Interview Not Passed" },
      passed ? "Interview marked as passed." : "Interview marked as not passed."
    );

    if (updated) {
      await sendApplicantEmail(app, `Interview Update: ${roleTitle(app, jobs)}`, `
        <h2>Interview Update</h2>
        <p>Hi ${candidateName(app)},</p>
        <p>Your interview result for <strong>${roleTitle(app, jobs)}</strong> has been recorded as <strong>${passed ? "passed" : "not passed"}</strong>.</p>
        <p>Pentecost Recruitment Team</p>
      `);
    }
  }

  async function handleRecommendForHire(app: Application) {
    await updateApplication(app, { hr_report_sent: true, status: "Recommended for Hire" }, "Candidate recommended for hire.");
  }

  async function handleApproveHire(app: Application) {
    const updated = await updateApplication(app, { onboarding_status: "Started", status: "Awaiting Onboarding" }, "Candidate approved and onboarding started.");
    if (updated) {
      await sendApplicantEmail(app, "Welcome to Pentecost University - Official Offer", `
        <h2>Welcome to Pentecost University</h2>
        <p>Hello ${candidateName(app)},</p>
        <p>You have been selected for <strong>${roleTitle(app, jobs)}</strong>. Your onboarding process has started.</p>
        <p>Pentecost University HR Department</p>
      `);
    }
  }

  async function handleOverrideStatus(app: Application, status: string) {
    if (!status) return;
    await updateApplication(app, { status }, `Status overridden to "${status}".`);
  }

  async function handleDecisionAction(app: Application, action: string) {
    if (!action) return;

    if (action === "approve-cv") await handleApproveCv(app);
    if (action === "reject-cv") await handleRejectCv(app);
    if (action === "pass-interview") await handleInterviewResult(app, true);
    if (action === "not-pass-interview") await handleInterviewResult(app, false);
    if (action === "recommend-hire") await handleRecommendForHire(app);
    if (action === "approve-hire") await handleApproveHire(app);
    if (action === "complete-onboarding") await handleOnboardingStep(app, "Completed");
  }

  async function handleOnboardingStep(app: Application, step: string) {
    const updated = await updateApplication(
      app,
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

  function downloadAdminReport() {
    const lines = [
      "Pentecost University Recruitment Admin Report",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "Candidate | Email | Role | Match | CV | Interview | Mark Score | AI Recommendation | Onboarding | Status",
    ];

    apps.forEach((app) => {
      lines.push([
        candidateName(app),
        app.email || "",
        roleTitle(app, jobs),
        Number(app.similarity || 0).toFixed(2),
        passedCv(app) ? "Passed" : "Not passed",
        truthy(app.interview_passed) ? "Passed" : app.interview_scheduled_at ? "Scheduled" : "Not scheduled",
        parseInterviewScore(app.interview_notes) === null ? "Not scored" : `${parseInterviewScore(app.interview_notes)}/100`,
        interviewRecommendation(parseInterviewScore(app.interview_notes)).label,
        app.onboarding_status || "Not started",
        app.status || "",
      ].join(" | "));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pentecost_admin_report.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  const metricCards = [
    { label: "Vacancies", value: jobs.length },
    { label: "Applications", value: apps.length },
    { label: "CV Passed", value: cvPassedApps.length },
    { label: "Interviews", value: scheduledApps.length },
    { label: "Ready / Hired", value: interviewPassedApps.length + hiredApps.length },
  ];
  const metricAccentClasses = [
    "from-[#143f8f]/35 to-transparent",
    "from-[#f8b51b]/25 to-transparent",
    "from-emerald-500/20 to-transparent",
    "from-sky-500/20 to-transparent",
    "from-violet-500/20 to-transparent",
  ];

  const panels: Array<{ id: AdminPanel; label: string; count: number }> = [
    { id: "overview", label: "Overview", count: apps.length },
    { id: "applications", label: "Applications", count: filteredApps.length },
    { id: "recommendations", label: "Best Three", count: bestApplicationsByRole.length },
    { id: "vacancies", label: "Vacancies", count: jobs.length },
    { id: "roles", label: "Roles", count: roleMatrix.length },
    { id: "reports", label: "Reports", count: apps.length },
  ];

  if (loading) {
    return (
      <main className="app-shell">
        <p>Loading admin dashboard...</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="page-container">
        <header className="app-topbar relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(20,63,143,0.28),rgba(248,181,27,0.10),rgba(255,255,255,0.04))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f8b51b]/70 to-transparent" />
          <div className="dashboard-brand-title">
            <UniversityBrand />
            <div>
              <p className="eyebrow">Administration</p>
              <h1 className="page-title">Recruitment Command Center</h1>
              <p className="page-subtitle max-w-3xl">Control vacancies, applications, candidate decisions, role visibility, onboarding, and reports.</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <UserBadge user={currentUser} label="Admin account" onUserUpdated={setCurrentUser} />
            <button onClick={async () => { await supabase.auth.signOut(); router.push("/"); }} className="danger-button">Logout</button>
          </div>
        </header>

        {message && (
          <div className="glass-card mb-5 rounded-xl border border-[#f8b51b]/25 bg-[#f8b51b]/10 px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
            {message}
          </div>
        )}

        <section className="metric-grid">
          {metricCards.map((metric, index) => (
            <div key={metric.label} className={`glass-card metric-card group relative overflow-hidden rounded-2xl border-white/10 bg-gradient-to-br ${metricAccentClasses[index]} transition duration-200 hover:-translate-y-1 hover:border-[#f8b51b]/40 hover:shadow-[0_18px_55px_rgba(0,0,0,0.24)]`}>
              <div className="absolute right-4 top-4 h-10 w-10 rounded-full border border-white/10 bg-white/5 opacity-70 transition group-hover:scale-110" />
              <p className="relative uppercase tracking-[0.16em]">{metric.label}</p>
              <h2 className="relative">{metric.value}</h2>
            </div>
          ))}
        </section>

        {scheduledApps.length > 0 && (
          <section className="glass-card upcoming-interviews rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(20,63,143,0.12))]">
            <div className="section-heading">
              <div>
                <h2>Upcoming Interview Meetings</h2>
                <p className="status-note">Admin can join scheduled interviews directly from the dashboard.</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => setActivePanel("applications")}>
                View Applications
              </button>
            </div>
            <div className="meeting-list">
              {scheduledApps.map((app) => (
                <article key={app.id} className="meeting-row transition duration-200 hover:border-[#f8b51b]/40 hover:bg-white/[0.075]">
                  <div className="application-profile">
                    <div className="application-avatar">{candidateName(app).slice(0, 2).toUpperCase()}</div>
                    <div>
                      <p className="eyebrow">Candidate</p>
                      <h3>{candidateName(app)}</h3>
                      <p className="status-note">{roleTitle(app, jobs)}</p>
                    </div>
                  </div>
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
                    <button className="secondary-button" type="button" onClick={() => setActivePanel("applications")}>
                      Details
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="admin-workspace">
          <aside className="admin-sidebar">
            <div>
              <p className="eyebrow">Admin Sections</p>
              <h2>Control Keys</h2>
              <p className="status-note">Move between the main recruitment controls.</p>
            </div>
            <label className="admin-section-select">
              Quick switch
              <select className="input-field" value={activePanel} onChange={(event) => setActivePanel(event.target.value as AdminPanel)}>
                {panels.map((panel) => (
                  <option key={panel.id} value={panel.id}>{panel.label} ({panel.count})</option>
                ))}
              </select>
            </label>
            <nav className="admin-section-list" aria-label="Admin sections">
              {panels.map((panel, index) => (
                <button
                  key={panel.id}
                  type="button"
                  className="admin-section-key"
                  data-active={activePanel === panel.id}
                  onClick={() => setActivePanel(panel.id)}
                >
                  <span className="admin-section-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="admin-section-copy">
                    <strong>{panel.label}</strong>
                    <small>{panel.id === "recommendations" ? "Top candidates" : panel.id === "vacancies" ? "Open roles" : panel.id}</small>
                  </span>
                  <span className="admin-section-count">{panel.count}</span>
                </button>
              ))}
            </nav>
          </aside>

          <div className="admin-panel-surface">

        {activePanel === "overview" && (
          <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="glass-card ops-section rounded-2xl border-white/10 bg-white/[0.045]">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Control Surface</p>
                  <h2>Admin Powers</h2>
                </div>
                <span className="rounded-full border border-[#f8b51b]/30 bg-[#f8b51b]/10 px-3 py-1 text-xs font-black text-[#f8b51b]">Full access</span>
              </div>
              <div className="grid gap-3">
                {adminPowerMatrix.map((item) => (
                  <div key={item.power} className="admin-power-row border-white/10 bg-white/[0.045] transition duration-200 hover:-translate-y-0.5 hover:border-[#f8b51b]/35">
                    <strong>{item.power}</strong>
                    <div className="admin-role-chip-list">
                      {item.roles.map((role) => (
                        <span key={role}>{role}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card ops-section rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(248,181,27,0.10),rgba(255,255,255,0.04))]">
              <p className="eyebrow">Pipeline Snapshot</p>
              <h2 className="mb-5">Current Movement</h2>
              <div className="grid gap-3">
                {[
                  ["Pending CV decisions", apps.filter((app) => !passedCv(app) && !String(app.status || "").toLowerCase().includes("not passed")).length],
                  ["Scheduled interviews", scheduledApps.length],
                  ["Passed interviews", interviewPassedApps.length],
                  ["Onboarding started", apps.filter((app) => app.onboarding_status === "Started").length],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                    <span className="status-note">{label}</span>
                    <strong className="text-lg text-[#f8b51b]">{value}</strong>
                  </div>
                ))}
                <button className="premium-button mt-1" onClick={() => setActivePanel("applications")}>Review Applications</button>
              </div>
            </div>
          </section>
        )}

        {activePanel === "applications" && (
          <section className="glass-card ops-section rounded-2xl border-white/10 bg-white/[0.045]">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Decision Desk</p>
                <h2>Application Control</h2>
                <p className="status-note">Admin has HR-level action controls plus direct status override.</p>
              </div>
              <input
                className="input-field"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search candidate, email, role, or status"
                style={{ width: "min(360px, 78vw)" }}
              />
            </div>
            <div className="admin-application-list">
              {filteredApps.map((app) => {
                const decision = getMatchDecision(Number(app.similarity || 0));
                const interviewScore = parseInterviewScore(app.interview_notes);
                const recommendation = interviewRecommendation(interviewScore);

                return (
                  <article key={app.id} className="admin-application-card rounded-2xl border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] transition duration-200 hover:-translate-y-0.5 hover:border-[#f8b51b]/35">
                    <div className="application-profile admin-candidate-profile">
                      <div className="application-avatar admin-candidate-avatar shadow-[0_10px_24px_rgba(0,0,0,0.22)]">{candidateName(app).slice(0, 2).toUpperCase()}</div>
                      <div>
                        <p className="eyebrow">Candidate</p>
                        <h3>{candidateName(app)}</h3>
                        <span className="status-pill">{app.status}</span>
                        <div className="admin-contact-stack">
                          <span>{app.email || "No email on file"}</span>
                          <span>{app.phone || "No phone on file"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="application-intelligence">
                      <div className="insight-card">
                        <p className="eyebrow">Role</p>
                        <strong>{roleTitle(app, jobs)}</strong>
                        <span style={{ ...getMatchStyle(decision.tone), display: "inline-block", marginTop: "10px", padding: "6px 10px", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 850 }}>
                          {decision.label}
                        </span>
                      </div>
                      <div className="insight-card">
                        <p className="eyebrow">AI Review</p>
                        <div className="ai-score-header">
                          <strong>{Math.round(Number(app.similarity || 0) * 100)}% CV match</strong>
                          <span>{decision.label}</span>
                        </div>
                        <div className="ai-score-bar" aria-label="AI CV match score">
                          <span style={{ width: `${Math.max(0, Math.min(100, Math.round(Number(app.similarity || 0) * 100)))}%` }} />
                        </div>
                        <p className="status-note">{cvAiSummary(candidateName(app), roleTitle(app, jobs), Number(app.similarity || 0), app.status)}</p>
                      </div>
                      <div className="insight-card">
                        <p className="eyebrow">Interview</p>
                        <strong>{truthy(app.interview_passed) ? "Passed" : app.interview_scheduled_at ? "Scheduled" : "Not scheduled"}</strong>
                        <p className="status-note">{formatDate(app.interview_scheduled_at)}</p>
                        <div className="score-meter" aria-label="Interview score">
                          <span style={{ width: `${interviewScore === null ? 0 : interviewScore}%` }} />
                        </div>
                        <p className="status-note"><strong>{interviewScore === null ? "Not scored" : `${interviewScore}/100`}</strong> · {recommendation.label}</p>
                        {app.interview_meet_link && (
                          <a
                            className="secondary-button"
                            href={app.interview_meet_link}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: "inline-flex", marginTop: "10px", textDecoration: "none" }}
                          >
                            Join Meeting
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="application-operations">
                      <label className="control-label">
                        Status override
                        <select className="input-field" value="" onChange={(event) => handleOverrideStatus(app, event.target.value)}>
                          <option value="">Set status...</option>
                          <option value="Admin Review">Admin Review</option>
                          <option value="CV Passed by Admin">CV Passed by Admin</option>
                          <option value="Recommended for Interview">Recommended for Interview</option>
                          <option value="Interview Passed">Interview Passed</option>
                          <option value="Recommended for Hire">Recommended for Hire</option>
                          <option value="Awaiting Onboarding">Awaiting Onboarding</option>
                          <option value="Hired / Onboarded">Hired / Onboarded</option>
                          <option value="Application Closed">Application Closed</option>
                        </select>
                      </label>

                      <label className="control-label">
                        Decision action
                        <select
                          className="input-field"
                          value=""
                          onChange={(event) => handleDecisionAction(app, event.target.value)}
                          disabled={busyAction === `app-${app.id}`}
                        >
                          <option value="">Choose action...</option>
                          <option value="approve-cv">Approve CV</option>
                          <option value="reject-cv">Reject CV</option>
                          <option value="pass-interview">Pass interview</option>
                          <option value="not-pass-interview">Reject after interview</option>
                          <option value="recommend-hire">Recommend for hire</option>
                          <option value="approve-hire">Approve hire</option>
                          <option value="complete-onboarding">Complete onboarding</option>
                        </select>
                      </label>

                      <div>
                        <div className="onboarding-header">
                          <strong>Onboarding</strong>
                          <span>{app.onboarding_status || "Not started"}</span>
                        </div>
                        <select
                          className="input-field"
                          value={app.onboarding_status || ""}
                          onChange={(event) => handleOnboardingStep(app, event.target.value)}
                          disabled={busyAction === `app-${app.id}`}
                        >
                          <option value="">Not started</option>
                          {onboardingSteps.map((step) => (
                            <option key={step} value={step}>{step}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {!filteredApps.length && <p className="status-note">No applications match that search.</p>}
          </section>
        )}

        {activePanel === "recommendations" && (
          <section className="glass-card ops-section">
            <div className="section-heading">
              <div>
                <h2>Best Three Applicants by Position</h2>
                <p className="status-note">Top candidates are ranked by CV match score for each vacancy.</p>
              </div>
            </div>
            {bestApplicationsByRole.length ? (
              <div className="best-three-grid">
                {bestApplicationsByRole.map(({ job, applicants }) => (
                  <article key={job.id} className="best-three-card">
                    <div className="best-three-header">
                      <div>
                        <p className="eyebrow">Position</p>
                        <h3>{job.title}</h3>
                      </div>
                      <span>{applicants.length}/3</span>
                    </div>
                    <div className="best-three-list">
                      {applicants.map((app, index) => {
                        const decision = getMatchDecision(Number(app.similarity || 0));
                        const matchPercent = Math.round(Number(app.similarity || 0) * 100);
                        return (
                          <div key={app.id} className="best-three-row">
                            <div className="best-rank">{index + 1}</div>
                            <div className="best-three-candidate">
                              <strong>{candidateName(app)}</strong>
                              <span className="best-three-email">{app.email || "No email on file"}</span>
                              <p className="status-note">{app.email || app.phone || "No contact"} · {app.status}</p>
                              <div className="ai-score-bar compact" aria-label="Best three CV match score">
                                <span style={{ width: `${Math.max(0, Math.min(100, matchPercent))}%` }} />
                              </div>
                            </div>
                            <div className="best-three-actions">
                              <span style={{ ...getMatchStyle(decision.tone), padding: "6px 10px", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 850 }}>
                                {matchPercent}%
                              </span>
                              <select
                                className="input-field"
                                value=""
                                onChange={(event) => handleDecisionAction(app, event.target.value)}
                                disabled={busyAction === `app-${app.id}`}
                              >
                                <option value="">Select action...</option>
                                <option value="approve-cv">Approve CV</option>
                                <option value="reject-cv">Reject CV</option>
                                <option value="pass-interview">Pass interview</option>
                                <option value="not-pass-interview">Reject after interview</option>
                                <option value="recommend-hire">Recommend for hire</option>
                                <option value="approve-hire">Approve hire</option>
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="status-note">No applications have been submitted yet.</p>
            )}
          </section>
        )}

        {activePanel === "vacancies" && (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
            <div className="glass-card ops-section">
              <h2>Publish Vacancy</h2>
              <form onSubmit={handleCreateJob} style={{ display: "grid", gap: "12px" }}>
                <input className="input-field" placeholder="Job title" value={newJob.title} onChange={(event) => setNewJob({ ...newJob, title: event.target.value })} required />
                <input className="input-field" placeholder="Salary" value={newJob.salary} onChange={(event) => setNewJob({ ...newJob, salary: event.target.value })} required />
                <textarea className="input-field" placeholder="Description" rows={3} value={newJob.description} onChange={(event) => setNewJob({ ...newJob, description: event.target.value })} required />
                <textarea className="input-field" placeholder="Requirements" rows={3} value={newJob.requirements} onChange={(event) => setNewJob({ ...newJob, requirements: event.target.value })} required />
                <button className="premium-button" disabled={busyAction === "create-job"}>{busyAction === "create-job" ? "Publishing..." : "Publish Vacancy"}</button>
              </form>
            </div>

            <div className="glass-card ops-section">
              <h2>Edit Vacancy</h2>
              {jobs.length ? (
                <form onSubmit={handleUpdateJob} style={{ display: "grid", gap: "12px" }}>
                  <select
                    className="input-field"
                    value={editJobId || ""}
                    onChange={(event) => {
                      const selectedId = Number(event.target.value);
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
                    {jobs.map((job) => <option key={job.id} value={job.id}>{job.id} - {job.title}</option>)}
                  </select>
                  <input className="input-field" placeholder="Job title" value={editJob.title} onChange={(event) => setEditJob({ ...editJob, title: event.target.value })} required />
                  <input className="input-field" placeholder="Salary" value={editJob.salary} onChange={(event) => setEditJob({ ...editJob, salary: event.target.value })} required />
                  <textarea className="input-field" placeholder="Description" rows={3} value={editJob.description} onChange={(event) => setEditJob({ ...editJob, description: event.target.value })} required />
                  <textarea className="input-field" placeholder="Requirements" rows={3} value={editJob.requirements} onChange={(event) => setEditJob({ ...editJob, requirements: event.target.value })} required />
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button className="premium-button" disabled={busyAction === "edit-job"}>{busyAction === "edit-job" ? "Saving..." : "Save Vacancy"}</button>
                    <button type="button" className="danger-button" disabled={busyAction === "remove-job"} onClick={handleRemoveJob}>{busyAction === "remove-job" ? "Removing..." : "Remove Vacancy"}</button>
                  </div>
                </form>
              ) : (
                <p className="status-note">No vacancies available.</p>
              )}
            </div>
          </section>
        )}

        {activePanel === "roles" && (
          <section className="glass-card ops-section">
            <h2>Role Powers</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
              {roleMatrix.map((role) => (
                <div key={role.role} className="row-card">
                  <p className="eyebrow">{role.role}</p>
                  <h3>{role.power}</h3>
                  <p className="status-note">{role.detail}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {activePanel === "reports" && (
          <section className="glass-card ops-section">
            <div className="section-heading">
              <div>
                <h2>Reports and Audit</h2>
                <p className="status-note">Export all application, interview, and onboarding records for administrative review.</p>
              </div>
              <button className="premium-button" onClick={downloadAdminReport}>Download Admin Report</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
              <div className="row-card"><strong>{apps.length}</strong><p className="status-note">Total applications in the report</p></div>
              <div className="row-card"><strong>{cvPassedApps.length}</strong><p className="status-note">Candidates with CV pass signal</p></div>
              <div className="row-card"><strong>{interviewPassedApps.length}</strong><p className="status-note">Interview-passed candidates</p></div>
              <div className="row-card"><strong>{hiredApps.length}</strong><p className="status-note">Hired or onboarded candidates</p></div>
            </div>
          </section>
        )}
          </div>
        </div>
      </div>
    </main>
  );
}

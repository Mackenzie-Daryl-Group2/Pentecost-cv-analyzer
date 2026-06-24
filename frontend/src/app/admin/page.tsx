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
  parseInterviewScore,
} from "@/utils/recruitment-insights";
import UserBadge from "@/components/UserBadge";
import UniversityBrand from "@/components/UniversityBrand";
import { generateStaffId, onboardingStepHref } from "@/utils/onboarding";
import { canJoinInterview, interviewAccessMessage } from "@/utils/interviews";

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
  staff_id?: string | null;
}

type AdminPanel = "overview" | "applications" | "recommendations" | "onboarding" | "vacancies" | "users" | "activity" | "roles" | "reports";
type JobForm = Omit<Job, "id">;

type UserProfile = {
  id: string;
  email?: string | null;
  username?: string | null;
  full_name?: string | null;
  phone?: string | null;
  role: string;
  last_sign_in_at?: string | null;
  created_at: string;
};

type ActivityLog = {
  id: number;
  actor_email?: string | null;
  actor_role?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  description: string;
  ip_address?: string | null;
  created_at: string;
};

const emptyJobForm: JobForm = {
  title: "",
  description: "",
  requirements: "",
  salary: "",
  application_deadline: null,
};

const roleMatrix = [
  { role: "Admin", power: "Oversight and governance", detail: "Oversees stakeholder roles, user access, activity logs, and reporting across the recruitment system." },
  { role: "HR", power: "Recruitment operations", detail: "Leads CV review, interviews, hiring, onboarding, document review, and staff ID assignment." },
  { role: "PRO-VC", power: "Executive recommendation", detail: "Reviews HR reports and submits recommendation decisions." },
  { role: "Registrar", power: "Records visibility", detail: "Tracks submitted applications, interviews, and final records." },
  { role: "Applicant", power: "Self service", detail: "Applies for vacancies and tracks application/interview status." },
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
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [oversightSearch, setOversightSearch] = useState("");
  const [oversightSetupRequired, setOversightSetupRequired] = useState(false);
  const router = useRouter();

  async function fetchOversight() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const response = await fetch("/api/admin/oversight?limit=300", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error || "User and activity records could not be loaded.");
      return;
    }
    setOversightSetupRequired(Boolean(result.setupRequired));
    setProfiles(result.profiles || []);
    setActivityLogs(result.logs || []);
  }

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
        application_deadline: firstJob.application_deadline || null,
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
      await Promise.all([fetchData(), fetchOversight()]);
    };

    init();
  }, [router]);

  const cvPassedApps = useMemo(() => apps.filter(passedCv), [apps]);
  const scheduledApps = useMemo(() => apps.filter((app) => Boolean(app.interview_scheduled_at)), [apps]);
  const upcomingScheduledApps = useMemo(
    () => scheduledApps.filter((app) =>
      new Date(app.interview_scheduled_at || "").getTime() > Date.now()
      && app.interview_passed !== true
      && app.interview_passed !== false
    ),
    [scheduledApps]
  );
  const interviewPassedApps = useMemo(() => apps.filter((app) => truthy(app.interview_passed)), [apps]);
  const hiredApps = useMemo(() => apps.filter((app) => String(app.status || "").toLowerCase().includes("hired")), [apps]);
  const onboardingApps = useMemo(
    () => apps.filter((app) => truthy(app.interview_passed) || Boolean(app.onboarding_status)),
    [apps]
  );
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
  const filteredProfiles = useMemo(() => {
    const term = oversightSearch.trim().toLowerCase();
    if (!term) return profiles;
    return profiles.filter((profile) =>
      [profile.email, profile.username, profile.full_name, profile.phone, profile.role]
        .some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [profiles, oversightSearch]);
  const filteredActivityLogs = useMemo(() => {
    const term = oversightSearch.trim().toLowerCase();
    if (!term) return activityLogs;
    return activityLogs.filter((log) =>
      [log.actor_email, log.actor_role, log.action, log.description, log.entity_type, log.entity_id]
        .some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [activityLogs, oversightSearch]);

  async function updateUserRole(userId: string, role: string) {
    setBusyAction(`user-${userId}`);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/admin/oversight", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token || ""}`,
        },
        body: JSON.stringify({ userId, role }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Role update failed.");
      setMessage("User role updated successfully.");
      await fetchOversight();
    } catch (error: any) {
      setMessage(error.message || "User role could not be updated.");
    } finally {
      setBusyAction("");
    }
  }

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
        ...(step === "Completed" ? { staff_id: app.staff_id || generateStaffId(app.id) } : {}),
      },
      `Onboarding updated: ${step}.`
    );

    if (!updated) return;

    const email = onboardingEmailForStep(step, candidateName(app), roleTitle(app, jobs));
    if (!email) {
      router.push(onboardingStepHref(app.id, step));
      return;
    }

    const emailSent = await sendApplicantEmail(app, email.subject, email.html);
    setMessage(
      app.email
        ? emailSent
          ? `Onboarding updated: ${step}. Applicant was notified by email.`
          : `Onboarding updated: ${step}, but the applicant email could not be sent.`
        : `Onboarding updated: ${step}, but the applicant has no email address on file.`
    );
    router.push(onboardingStepHref(app.id, step));
  }

  function downloadAdminReport() {
    const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Candidate", "Email", "Role", "Match", "CV", "Interview", "Mark Score", "AI Recommendation", "Onboarding", "Status"],
      ...apps.map((app) => [
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
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pentecost_admin_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const metricCards = [
    { label: "Users", value: profiles.length },
    { label: "Activity Logs", value: activityLogs.length },
    { label: "Interviews", value: scheduledApps.length },
    { label: "Reports", value: apps.length },
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
    { id: "users", label: "Users", count: profiles.length },
    { id: "activity", label: "Activity Logs", count: activityLogs.length },
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
              <p className="page-subtitle max-w-3xl">Oversee stakeholder roles, audit activity, user access, and institutional recruitment reports.</p>
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

        {oversightSetupRequired && (
          <div className="glass-card onboarding-message">
            User and activity tables are not installed in this Supabase project. Run <strong>frontend/supabase/admin-oversight.sql</strong> in Supabase SQL Editor, then reload.
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

        {upcomingScheduledApps.length > 0 && (
          <section className="glass-card upcoming-interviews rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(20,63,143,0.12))]">
            <div className="section-heading">
              <div>
                <h2>Upcoming Interview Meetings</h2>
                <p className="status-note">Admin can join scheduled interviews directly from the dashboard.</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => setActivePanel("reports")}>
                View Reports
              </button>
            </div>
            <div className="meeting-list">
              {upcomingScheduledApps.map((app) => (
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
                    {canJoinInterview(app.interview_scheduled_at, app.interview_meet_link, app.interview_passed, app.status) ? (
                      <a className="premium-button" href={app.interview_meet_link || ""} target="_blank" rel="noreferrer">
                        Join Meeting
                      </a>
                    ) : (
                      <span className="status-note">{interviewAccessMessage(app.interview_scheduled_at, app.interview_passed, app.status)}</span>
                    )}
                    <button className="secondary-button" type="button" onClick={() => setActivePanel("reports")}>
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
                    <small>{panel.id}</small>
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
              <div className="grid gap-3 sm:grid-cols-2">
                {["Manage stakeholder access", "Review user directory", "Track activity logs", "Oversee role assignments", "Monitor interview movement", "Download institution-wide reports"].map((power) => (
                  <div key={power} className="row-card border-white/10 bg-white/[0.045] transition duration-200 hover:-translate-y-0.5 hover:border-[#f8b51b]/35">
                    <strong>{power}</strong>
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
                <button className="premium-button mt-1" onClick={() => setActivePanel("reports")}>Open Reports</button>
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
                <p className="status-note">Admin oversight with full decision, status, hiring, and onboarding controls.</p>
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
                const aiSummary = cvAiSummary(candidateName(app), roleTitle(app, jobs), Number(app.similarity || 0), app.status);
                const shortAiSummary = aiSummary.length > 120 ? `${aiSummary.slice(0, 117)}...` : aiSummary;
                const matchPercent = Math.max(0, Math.min(100, Math.round(Number(app.similarity || 0) * 100)));

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
                        <p className="eyebrow">Interview</p>
                        <strong>{truthy(app.interview_passed) ? "Passed" : app.interview_scheduled_at ? "Scheduled" : "Not scheduled"}</strong>
                        <p className="status-note">{formatDate(app.interview_scheduled_at)}</p>
                        <div className="score-meter" aria-label="Interview score">
                          <span style={{ width: `${interviewScore === null ? 0 : interviewScore}%` }} />
                        </div>
                        <p className="status-note"><strong>{interviewScore === null ? "Not scored" : `${interviewScore}/100`}</strong> · {recommendation.label}</p>
                        {canJoinInterview(app.interview_scheduled_at, app.interview_meet_link, app.interview_passed, app.status) && (
                          <a
                            className="secondary-button"
                            href={app.interview_meet_link || ""}
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
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => router.push(onboardingStepHref(app.id, app.onboarding_status || "Offer Letter Sent"))}
                        >
                          Open Onboarding Workspace
                        </button>
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
                            </div>
                            <div className="best-three-actions">
                              <div className="ai-score-circle compact" style={{ "--score": `${Math.max(0, Math.min(100, matchPercent))}%` } as React.CSSProperties} aria-label={`Best three CV match score ${matchPercent}%`}>
                                <span>{matchPercent}%</span>
                              </div>
                              <span style={{ ...getMatchStyle(decision.tone), padding: "6px 10px", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 850 }}>
                                {decision.label}
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

        {activePanel === "onboarding" && (
          <section className="glass-card ops-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Onboarding Oversight</p>
                <h2>New Staff Workspace</h2>
                <p className="status-note">Monitor and manage documents, references, orientation, and staff ID completion.</p>
              </div>
            </div>
            <div className="admin-application-list">
              {onboardingApps.map((app) => (
                <article key={app.id} className="admin-application-card">
                  <div className="application-profile">
                    <div className="application-avatar">{candidateName(app).slice(0, 2).toUpperCase()}</div>
                    <div>
                      <p className="eyebrow">Candidate</p>
                      <h3>{candidateName(app)}</h3>
                      <p className="status-note">{app.email || app.phone || "No contact on file"}</p>
                    </div>
                  </div>
                  <div className="application-intelligence">
                    <div className="insight-card">
                      <p className="eyebrow">Position</p>
                      <strong>{roleTitle(app, jobs)}</strong>
                    </div>
                    <div className="insight-card">
                      <p className="eyebrow">Recorded Stage</p>
                      <strong>{app.onboarding_status || "Not started"}</strong>
                    </div>
                    <div className="insight-card">
                      <p className="eyebrow">Staff ID</p>
                      <strong>{app.staff_id || "Not assigned"}</strong>
                    </div>
                  </div>
                  <div className="application-operations">
                    <button
                      className="premium-button"
                      onClick={() => router.push(onboardingStepHref(app.id, app.onboarding_status || "Offer Letter Sent"))}
                    >
                      Open Onboarding Workspace
                    </button>
                    {!app.onboarding_status && (
                      <button className="secondary-button" onClick={() => handleOnboardingStep(app, "Offer Letter Sent")}>
                        Start Onboarding
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {!onboardingApps.length && <p className="status-note">No candidates are ready for onboarding yet.</p>}
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
                <label className="control-label">
                  Application cutoff
                  <input className="input-field" type="datetime-local" value={newJob.application_deadline ? new Date(new Date(newJob.application_deadline).getTime() - new Date(newJob.application_deadline).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""} onChange={(event) => setNewJob({ ...newJob, application_deadline: event.target.value || null })} />
                </label>
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
                          application_deadline: selectedJob.application_deadline || null,
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
                  <label className="control-label">
                    Application cutoff
                    <input className="input-field" type="datetime-local" value={editJob.application_deadline ? new Date(new Date(editJob.application_deadline).getTime() - new Date(editJob.application_deadline).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""} onChange={(event) => setEditJob({ ...editJob, application_deadline: event.target.value || null })} />
                  </label>
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

        {activePanel === "users" && (
          <section className="glass-card ops-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">User Directory</p>
                <h2>Accounts and Stakeholder Roles</h2>
                <p className="status-note">Profiles are synchronized from Supabase Auth. Admin can assign application roles here.</p>
              </div>
              <input
                className="input-field"
                value={oversightSearch}
                onChange={(event) => setOversightSearch(event.target.value)}
                placeholder="Search name, email, phone, or role"
                style={{ width: "min(360px, 78vw)" }}
              />
            </div>
            <div className="oversight-table-wrap">
              <table className="data-table oversight-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Contact</th>
                    <th>Role</th>
                    <th>Last Sign In</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles.map((profile) => (
                    <tr key={profile.id}>
                      <td>
                        <strong>{profile.full_name || profile.username || "Unnamed user"}</strong>
                        <p className="status-note">{profile.username || profile.id.slice(0, 8)}</p>
                      </td>
                      <td>
                        <span>{profile.email || "No email"}</span>
                        <p className="status-note">{profile.phone || "No phone"}</p>
                      </td>
                      <td>
                        <select
                          className="input-field"
                          value={profile.role || "user"}
                          disabled={busyAction === `user-${profile.id}`}
                          onChange={(event) => updateUserRole(profile.id, event.target.value)}
                        >
                          <option value="user">Applicant</option>
                          <option value="hr">HR</option>
                          <option value="pro_vc">PRO-VC</option>
                          <option value="registrar">Registrar</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td>{profile.last_sign_in_at ? formatDate(profile.last_sign_in_at) : "Never"}</td>
                      <td>{formatDate(profile.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filteredProfiles.length && <p className="status-note">No users match that search.</p>}
          </section>
        )}

        {activePanel === "activity" && (
          <section className="glass-card ops-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Audit Center</p>
                <h2>User Activity Logs</h2>
                <p className="status-note">Tracks authentication, route visits, recruitment changes, and Admin role updates.</p>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <input
                  className="input-field"
                  value={oversightSearch}
                  onChange={(event) => setOversightSearch(event.target.value)}
                  placeholder="Search actor, action, or record"
                  style={{ width: "min(360px, 78vw)" }}
                />
                <button className="secondary-button" onClick={fetchOversight}>Refresh Logs</button>
              </div>
            </div>
            <div className="activity-log-list">
              {filteredActivityLogs.map((log) => (
                <article key={log.id} className="activity-log-row">
                  <div className="activity-log-marker" aria-hidden="true" />
                  <div>
                    <strong>{log.description}</strong>
                    <p className="status-note">{log.actor_email || "System"} · {log.actor_role || "system"} · {log.action}</p>
                  </div>
                  <div>
                    <p>{log.entity_type || "activity"}{log.entity_id ? ` #${log.entity_id}` : ""}</p>
                    <p className="status-note">{log.ip_address || "IP unavailable"}</p>
                  </div>
                  <time>{formatDate(log.created_at)}</time>
                </article>
              ))}
            </div>
            {!filteredActivityLogs.length && <p className="status-note">No activity records match that search.</p>}
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

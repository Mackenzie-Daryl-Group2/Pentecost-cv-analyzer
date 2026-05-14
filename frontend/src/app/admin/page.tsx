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
  onboardingProgress,
  onboardingSteps,
  parseInterviewScore,
} from "@/utils/recruitment-insights";
import UserBadge from "@/components/UserBadge";

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

type AdminPanel = "overview" | "applications" | "vacancies" | "roles" | "reports";
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

  const panels: Array<{ id: AdminPanel; label: string; count: number }> = [
    { id: "overview", label: "Overview", count: apps.length },
    { id: "applications", label: "Applications", count: filteredApps.length },
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
        <header className="app-topbar">
          <div>
            <p className="eyebrow">Administration</p>
            <h1 className="page-title">Recruitment Command Center</h1>
            <p className="page-subtitle">Control vacancies, applications, candidate decisions, role visibility, onboarding, and reports.</p>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <UserBadge user={currentUser} label="Admin account" onUserUpdated={setCurrentUser} />
            <button onClick={async () => { await supabase.auth.signOut(); router.push("/"); }} className="danger-button">Logout</button>
          </div>
        </header>

        {message && (
          <div className="glass-card" style={{ marginBottom: "18px", padding: "14px 16px" }}>
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

        <div className="tab-strip" aria-label="Admin sections">
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

        {activePanel === "overview" && (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            <div className="glass-card ops-section">
              <h2>Admin Powers</h2>
              <div style={{ display: "grid", gap: "12px" }}>
                {["Create, edit, and remove vacancies", "Approve or reject CVs", "Mark interview outcomes", "Recommend or approve hiring", "Override application status", "Download institution-wide reports"].map((power) => (
                  <div key={power} className="row-card">
                    <strong>{power}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card ops-section">
              <h2>Pipeline Snapshot</h2>
              <div style={{ display: "grid", gap: "12px" }}>
                <p className="status-note">Pending CV decisions: {apps.filter((app) => !passedCv(app) && !String(app.status || "").toLowerCase().includes("not passed")).length}</p>
                <p className="status-note">Scheduled interviews: {scheduledApps.length}</p>
                <p className="status-note">Passed interviews: {interviewPassedApps.length}</p>
                <p className="status-note">Onboarding started: {apps.filter((app) => app.onboarding_status === "Started").length}</p>
                <button className="premium-button" onClick={() => setActivePanel("applications")}>Review Applications</button>
              </div>
            </div>
          </section>
        )}

        {activePanel === "applications" && (
          <section className="glass-card ops-section">
            <div className="section-heading">
              <div>
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
                const progress = onboardingProgress(app.onboarding_status);

                return (
                  <article key={app.id} className="admin-application-card">
                    <div className="application-profile">
                      <div className="application-avatar">{candidateName(app).slice(0, 2).toUpperCase()}</div>
                      <div>
                        <p className="eyebrow">Candidate</p>
                        <h3>{candidateName(app)}</h3>
                        <p className="status-note">{app.email || app.phone || "No contact on file"}</p>
                        <span className="status-pill">{app.status}</span>
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

                      <div className="action-grid">
                        <button disabled={busyAction === `app-${app.id}`} onClick={() => handleApproveCv(app)} className="secondary-button">Approve CV</button>
                        <button disabled={busyAction === `app-${app.id}`} onClick={() => handleRejectCv(app)} className="secondary-button">Reject CV</button>
                        <button disabled={busyAction === `app-${app.id}`} onClick={() => handleInterviewResult(app, true)} className="secondary-button">Pass Interview</button>
                        <button disabled={busyAction === `app-${app.id}`} onClick={() => handleRecommendForHire(app)} className="secondary-button">Recommend Hire</button>
                        <button disabled={busyAction === `app-${app.id}`} onClick={() => handleApproveHire(app)} className="premium-button">Approve Hire</button>
                        <button disabled={busyAction === `app-${app.id}`} onClick={() => handleOnboardingStep(app, "Completed")} className="secondary-button">Complete Onboarding</button>
                      </div>

                      <div>
                        <div className="onboarding-header">
                          <strong>Onboarding</strong>
                          <span>{app.onboarding_status || "Not started"}</span>
                        </div>
                        <div className="onboarding-timeline">
                          {onboardingSteps.map((step, index) => (
                            <button
                              key={step}
                              type="button"
                              data-complete={index <= progress}
                              onClick={() => handleOnboardingStep(app, step)}
                              disabled={busyAction === `app-${app.id}`}
                            >
                              <span />
                              {step}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {!filteredApps.length && <p className="status-note">No applications match that search.</p>}
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
    </main>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { loadJobs, type Job } from "@/utils/jobs";
import { getRoleHome, getUserRole, isApplicantRole } from "@/utils/roles";
import {
  applicationProgress,
  applicationTimeline,
  canReplaceCv,
  canWithdrawApplication,
  validateRecruitmentFile,
} from "@/utils/application-lifecycle";
import { onboardingStepByName, onboardingStepHref } from "@/utils/onboarding";
import UserBadge from "@/components/UserBadge";
import UniversityBrand from "@/components/UniversityBrand";

interface Application {
  id: string | number;
  job_id: string | number;
  name?: string;
  email?: string;
  phone?: string;
  status: string;
  submitted_at: string;
  similarity: number;
  cv_path?: string | null;
  cv_replaced_at?: string | null;
  interview_scheduled_at?: string | null;
  interview_meet_link?: string | null;
  onboarding_status?: string | null;
  staff_id?: string | null;
  talent_pool_consent?: boolean | null;
  retention_until?: string | null;
  withdrawn_at?: string | null;
  withdrawal_reason?: string | null;
  offer_status?: string | null;
  offer_details?: {
    position?: string;
    salary?: string;
    startDate?: string;
    probation?: string;
    reportingOfficer?: string;
    responseDeadline?: string;
    additionalTerms?: string;
  } | null;
  data_deletion_requested_at?: string | null;
}

export default function MyApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  async function loadData(email: string) {
    const [applications, loadedJobs] = await Promise.all([
      supabase.from("applications").select("*").eq("email", email).order("submitted_at", { ascending: false }),
      loadJobs(supabase),
    ]);
    if (applications.error) setMessage(applications.error.message);
    setApps((applications.data || []) as Application[]);
    setJobs(loadedJobs);
    setLoading(false);
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
        return;
      }
      const role = getUserRole(user);
      if (!isApplicantRole(role)) {
        router.replace(getRoleHome(role));
        return;
      }
      setUser(user);
      await loadData(user.email || "");
    };
    init();
  }, [router]);

  async function applicationRequest(app: Application, body: Record<string, unknown>) {
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch(`/api/applications/${app.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token || ""}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Application update failed.");
    return data.application as Application;
  }

  async function updatePreference(app: Application, talentPoolConsent: boolean) {
    setBusyId(`preferences-${app.id}`);
    try {
      await applicationRequest(app, { action: "preferences", talentPoolConsent });
      setMessage(talentPoolConsent ? "Talent pool permission enabled." : "Talent pool permission removed.");
      await loadData(user.email || "");
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusyId("");
    }
  }

  async function withdraw(app: Application) {
    const reason = window.prompt("Optional: tell HR why you are withdrawing this application.") ?? "";
    if (!window.confirm("Withdraw this application? HR will retain the record according to the recruitment privacy policy.")) return;
    setBusyId(`withdraw-${app.id}`);
    try {
      await applicationRequest(app, { action: "withdraw", reason });
      setMessage("Application withdrawn.");
      await loadData(user.email || "");
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusyId("");
    }
  }

  async function replaceCv(app: Application, file?: File) {
    if (!file) return;
    const validationError = validateRecruitmentFile(file, "cv");
    if (validationError) {
      setMessage(validationError);
      return;
    }
    setBusyId(`cv-${app.id}`);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uploadResponse = await fetch(`/api/applications/${app.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token || ""}`,
        },
        body: JSON.stringify({ action: "replace-cv-upload", fileName: file.name }),
      });
      const upload = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok) throw new Error(upload.error || "CV upload could not be prepared.");
      const { error } = await supabase.storage.from("cvs").uploadToSignedUrl(upload.path, upload.token, file);
      if (error) throw error;
      await applicationRequest(app, { action: "replace-cv", path: upload.path });
      setMessage("CV replaced and returned to HR for review.");
      await loadData(user.email || "");
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusyId("");
    }
  }

  async function respondToOffer(app: Application, response: "accepted" | "declined") {
    if (!window.confirm(`${response === "accepted" ? "Accept" : "Decline"} this offer?`)) return;
    setBusyId(`offer-${app.id}`);
    try {
      await applicationRequest(app, { action: "offer-response", response });
      setMessage(`Offer ${response}.`);
      await loadData(user.email || "");
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusyId("");
    }
  }

  async function requestDeletion(app: Application) {
    if (!window.confirm("Send HR a request to delete or anonymise this application when legally permitted?")) return;
    setBusyId(`delete-${app.id}`);
    try {
      await applicationRequest(app, { action: "deletion-request" });
      setMessage("Your data deletion request was recorded for HR review.");
      await loadData(user.email || "");
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusyId("");
    }
  }

  function exportData(app: Application) {
    const job = jobs.find((item) => String(item.id) === String(app.job_id));
    const blob = new Blob([JSON.stringify({ ...app, job: job || null }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `application-${app.id}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main className="app-shell">
      <div className="page-container">
        <header className="app-topbar">
          <button type="button" className="brand-button" onClick={() => router.push("/jobs")}><UniversityBrand /></button>
          <div>
            <p className="eyebrow">Applicant Portal</p>
            <h1 className="page-title">My Applications</h1>
            <p className="page-subtitle">Track decisions, manage documents, and control your recruitment data.</p>
          </div>
          <div className="topbar-actions">
            <button className="secondary-button" onClick={() => router.push("/jobs")}>Available Jobs</button>
            <UserBadge user={user} label="Applicant account" onUserUpdated={setUser} />
            <button className="danger-button" onClick={async () => { await supabase.auth.signOut(); router.push("/"); }}>Logout</button>
          </div>
        </header>

        {message && <div className="glass-card onboarding-message" role="status">{message}</div>}

        {loading ? <p>Loading applications...</p> : apps.length === 0 ? (
          <section className="glass-card empty-state">
            <h2>No applications yet</h2>
            <p className="status-note">Browse open vacancies to start an application.</p>
            <button className="premium-button" onClick={() => router.push("/jobs")}>Browse Jobs</button>
          </section>
        ) : (
          <div className="applicant-application-list">
            {apps.map((app) => {
              const job = jobs.find((item) => String(item.id) === String(app.job_id));
              const progress = applicationProgress(app.status, app.interview_scheduled_at, app.onboarding_status);
              const onboardingStep = onboardingStepByName(app.onboarding_status);
              return (
                <article key={app.id} className="glass-card applicant-application-card">
                  <div className="applicant-application-heading">
                    <div>
                      <p className="eyebrow">Application #{String(app.id).slice(-8)}</p>
                      <h2>{job?.title || `Position ${app.job_id}`}</h2>
                      <p className="status-note">Sent {new Date(app.submitted_at).toLocaleDateString()}</p>
                    </div>
                    <span className="status-pill">{app.status}</span>
                  </div>

                  <ol className="application-timeline" aria-label="Application progress">
                    {applicationTimeline.map((step, index) => (
                      <li key={step.key} data-complete={index <= progress} data-current={index === progress}>
                        <span>{index + 1}</span>
                        <strong>{step.label}</strong>
                      </li>
                    ))}
                  </ol>

                  <div className="applicant-application-grid">
                    <section>
                      <p className="eyebrow">Current Update</p>
                      <h3>{app.status}</h3>
                      {app.interview_scheduled_at && (
                        <div className="applicant-update-box">
                          <strong>Interview: {new Date(app.interview_scheduled_at).toLocaleString()}</strong>
                          {app.interview_meet_link && <a href={app.interview_meet_link} target="_blank" rel="noreferrer">Join Google Meet</a>}
                        </div>
                      )}
                      {app.onboarding_status && (
                        <div className="applicant-update-box">
                          <strong>{onboardingStep.title}</strong>
                          <p className="status-note">{onboardingStep.applicantText}</p>
                          <button className="secondary-button" onClick={() => router.push(onboardingStepHref(app.id, app.onboarding_status))}>Open Onboarding</button>
                        </div>
                      )}
                    </section>

                    <section>
                      <p className="eyebrow">Documents and Actions</p>
                      <div className="applicant-action-list">
                        {canReplaceCv(app.status, app.interview_scheduled_at) && (
                          <label className="secondary-button file-action-button">
                            {busyId === `cv-${app.id}` ? "Replacing CV..." : "Replace CV"}
                            <input type="file" accept=".pdf,application/pdf" disabled={Boolean(busyId)} onChange={(event) => replaceCv(app, event.target.files?.[0])} />
                          </label>
                        )}
                        <button className="secondary-button" onClick={() => exportData(app)}>Download My Data</button>
                        {canWithdrawApplication(app.status, app.onboarding_status) && (
                          <button className="danger-button" disabled={Boolean(busyId)} onClick={() => withdraw(app)}>Withdraw Application</button>
                        )}
                      </div>
                      {app.cv_replaced_at && <p className="status-note">CV replaced: {new Date(app.cv_replaced_at).toLocaleString()}</p>}
                    </section>
                  </div>

                  {app.offer_details && (
                    <section className="applicant-offer-panel">
                      <div>
                        <p className="eyebrow">Official Offer</p>
                        <h3>{app.offer_details.position || job?.title}</h3>
                        <p>Start date: <strong>{app.offer_details.startDate || "To be confirmed"}</strong></p>
                        <p>Salary: <strong>{app.offer_details.salary || "As communicated by HR"}</strong></p>
                        <p>Reporting officer: <strong>{app.offer_details.reportingOfficer || "Head of Department"}</strong></p>
                      </div>
                      <div className="applicant-action-list">
                        <span className="status-pill">{app.offer_status || "Awaiting response"}</span>
                        {!["Accepted", "Declined"].includes(app.offer_status || "") && (
                          <>
                            <button className="premium-button" onClick={() => respondToOffer(app, "accepted")}>Accept Offer</button>
                            <button className="danger-button" onClick={() => respondToOffer(app, "declined")}>Decline Offer</button>
                          </>
                        )}
                      </div>
                    </section>
                  )}

                  <details className="applicant-privacy-panel">
                    <summary>Privacy and retention controls</summary>
                    <div>
                      <label className="privacy-toggle">
                        <input type="checkbox" checked={Boolean(app.talent_pool_consent)} disabled={Boolean(busyId)} onChange={(event) => updatePreference(app, event.target.checked)} />
                        <span><strong>Talent pool permission</strong> Allow HR to contact me about suitable future vacancies.</span>
                      </label>
                      <p className="status-note">Retention date: {app.retention_until ? new Date(app.retention_until).toLocaleDateString() : "Not specified"}</p>
                      <button className="secondary-button" disabled={Boolean(app.data_deletion_requested_at) || Boolean(busyId)} onClick={() => requestDeletion(app)}>
                        {app.data_deletion_requested_at ? "Deletion Request Submitted" : "Request Data Deletion"}
                      </button>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

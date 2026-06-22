"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { isJobClosed, loadJobs, type Job } from "@/utils/jobs";
import { getRoleHome, getUserRole } from "@/utils/roles";
import { recordActivity } from "@/utils/audit";
import UniversityBrand from "@/components/UniversityBrand";
import UserBadge, { Avatar } from "@/components/UserBadge";

type TalentApplication = {
  id: string | number;
  job_id: string | number;
  name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  status?: string;
  similarity?: number;
  image_path?: string | null;
  image_url?: string | null;
  submitted_at?: string | null;
  talent_pool_consent?: boolean | null;
  talent_pool_added_at?: string | null;
  retention_until?: string | null;
};

function candidateName(application: TalentApplication) {
  return application.name || application.full_name || "Candidate";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[character] || character));
}

function candidatePhoto(application: TalentApplication) {
  const path = application.image_url || application.image_path;
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from("images").getPublicUrl(path).data.publicUrl;
}

export default function TalentOutreachPage() {
  const params = useParams<{ applicationId: string }>();
  const router = useRouter();
  const [application, setApplication] = useState<TalentApplication | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
  const [subject, setSubject] = useState("Career opportunities at Pentecost University");
  const [introduction, setIntroduction] = useState("");
  const [closing, setClosing] = useState("Kind regards,\nHuman Resources Department\nPentecost University");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?message=Please+log+in+to+continue");
        return;
      }
      const role = getUserRole(user);
      if (role !== "hr" && role !== "admin") {
        router.replace(getRoleHome(role));
        return;
      }
      setCurrentUser(user);

      const [applicationResponse, loadedJobs] = await Promise.all([
        supabase.from("applications").select("*").eq("id", params.applicationId).single(),
        loadJobs(supabase),
      ]);
      if (applicationResponse.error || !applicationResponse.data) {
        setMessage(applicationResponse.error?.message || "Talent profile could not be loaded.");
        setLoading(false);
        return;
      }

      const profile = applicationResponse.data as TalentApplication;
      if (!profile.talent_pool_consent) {
        setMessage("This candidate has not consented to talent-pool contact.");
      }
      setApplication(profile);
      setJobs(loadedJobs);
      setIntroduction(
        `Hello ${candidateName(profile)},\n\nThank you for allowing Pentecost University to retain your profile for suitable career opportunities. Based on your previous application, we would like to draw your attention to the following vacancies that may interest you.`
      );
      setLoading(false);
    };
    init();
  }, [params.applicationId, router]);

  const openJobs = useMemo(
    () => jobs.filter((job) => !isJobClosed(job)),
    [jobs]
  );
  const selectedJobs = useMemo(
    () => openJobs.filter((job) => selectedJobIds.includes(job.id)),
    [openJobs, selectedJobIds]
  );
  const previousJob = jobs.find((job) => String(job.id) === String(application?.job_id));

  function toggleJob(jobId: number) {
    setSelectedJobIds((current) =>
      current.includes(jobId) ? current.filter((id) => id !== jobId) : [...current, jobId]
    );
  }

  function composeHtml() {
    const origin = window.location.origin;
    const vacancyHtml = selectedJobs.map((job) => `
      <div style="border:1px solid #d9e1dc;border-radius:8px;padding:16px;margin:14px 0;">
        <h3 style="margin:0 0 8px;color:#08783f;">${escapeHtml(job.title)}</h3>
        <p>${escapeHtml(job.description)}</p>
        <p><strong>Requirements:</strong> ${escapeHtml(job.requirements)}</p>
        ${job.application_deadline ? `<p><strong>Application deadline:</strong> ${escapeHtml(new Date(job.application_deadline).toLocaleString())}</p>` : ""}
        <p><a href="${origin}/jobs" style="color:#08783f;font-weight:bold;">View vacancy and apply</a></p>
      </div>
    `).join("");

    return `
      <div style="font-family:Arial,sans-serif;color:#17211b;line-height:1.6;max-width:720px;">
        ${escapeHtml(introduction).replace(/\n/g, "<br>")}
        ${vacancyHtml}
        <p>You will need to sign in to your applicant account before submitting a new application.</p>
        <p>${escapeHtml(closing).replace(/\n/g, "<br>")}</p>
      </div>
    `;
  }

  async function sendOutreach(event: React.FormEvent) {
    event.preventDefault();
    if (!application?.email) {
      setMessage("This candidate has no email address on file.");
      return;
    }
    if (!application.talent_pool_consent) {
      setMessage("Talent-pool consent is required before contacting this candidate.");
      return;
    }
    if (!selectedJobs.length) {
      setMessage("Select at least one vacancy to include.");
      return;
    }

    setSending(true);
    setMessage("");
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch(`/api/talent-outreach/${application.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token || ""}`,
      },
      body: JSON.stringify({
        subject,
        html: composeHtml(),
        jobIds: selectedJobs.map((job) => job.id),
      }),
    }).catch(() => null);

    if (!response?.ok) {
      const data = response ? await response.json().catch(() => ({})) : {};
      setMessage(data.error || "The outreach email could not be sent.");
      setSending(false);
      return;
    }

    await recordActivity(
      "talent_pool_outreach_sent",
      `Career opportunity email sent to ${application.email}.`,
      {
        entityType: "application",
        entityId: application.id,
        metadata: {
          job_ids: selectedJobs.map((job) => job.id),
          job_titles: selectedJobs.map((job) => job.title),
        },
      }
    );
    setMessage(`Career opportunity email sent to ${application.email}.`);
    setSending(false);
  }

  if (loading) return <main className="app-shell"><p>Loading talent profile...</p></main>;
  if (!application) return <main className="app-shell"><div className="glass-card ops-section">{message}</div></main>;

  return (
    <main className="app-shell">
      <div className="page-container">
        <header className="app-topbar">
          <div className="dashboard-brand-title">
            <UniversityBrand />
            <div>
              <p className="eyebrow">Talent Pool Outreach</p>
              <h1 className="page-title">Contact Candidate</h1>
              <p className="page-subtitle">Review the profile, select relevant vacancies, and send a tailored opportunity email.</p>
            </div>
          </div>
          <div className="topbar-actions">
            <UserBadge user={currentUser} label="HR account" onUserUpdated={setCurrentUser} />
            <button className="secondary-button" onClick={() => router.push(getUserRole(currentUser) === "admin" ? "/admin" : "/hr")}>Back to Dashboard</button>
          </div>
        </header>

        {message && <div className="glass-card onboarding-message" role="status">{message}</div>}

        <div className="talent-outreach-layout">
          <aside className="glass-card ops-section talent-contact-profile">
            <div className="talent-profile-heading">
              <Avatar name={candidateName(application)} src={candidatePhoto(application)} />
              <div>
                <p className="eyebrow">Candidate Profile</p>
                <h2>{candidateName(application)}</h2>
                <span className="status-pill">{application.talent_pool_consent ? "Contact consent active" : "No contact consent"}</span>
              </div>
            </div>

            <div className="talent-contact-list">
              <div><small>Email</small><strong>{application.email || "Not provided"}</strong></div>
              <div><small>Phone</small><strong>{application.phone || "Not provided"}</strong></div>
              <div><small>Previous application</small><strong>{previousJob?.title || `Position ${application.job_id}`}</strong></div>
              <div><small>Previous CV match</small><strong>{Math.round(Number(application.similarity || 0) * 100)}%</strong></div>
              <div><small>Current status</small><strong>{application.status || "Not recorded"}</strong></div>
              <div><small>Retention date</small><strong>{application.retention_until ? new Date(application.retention_until).toLocaleDateString() : "Not set"}</strong></div>
            </div>

            <div className="talent-direct-actions">
              {application.email && <a className="secondary-button" href={`mailto:${application.email}`}>Open Email App</a>}
              {application.phone && <a className="secondary-button" href={`tel:${application.phone}`}>Call Candidate</a>}
            </div>
          </aside>

          <form className="glass-card ops-section talent-email-composer" onSubmit={sendOutreach}>
            <div>
              <p className="eyebrow">Opportunity Email</p>
              <h2>Draft Candidate Outreach</h2>
              <p className="status-note">The selected vacancies and their application links will be included automatically.</p>
            </div>

            <label className="control-label">
              Recipient
              <input className="input-field" value={application.email || ""} readOnly />
            </label>
            <label className="control-label">
              Subject
              <input className="input-field" value={subject} onChange={(event) => setSubject(event.target.value)} required />
            </label>
            <label className="control-label">
              Opening message
              <textarea className="input-field" rows={6} value={introduction} onChange={(event) => setIntroduction(event.target.value)} required />
            </label>

            <fieldset className="talent-job-selector">
              <legend>Potential vacancies</legend>
              <p className="status-note">Select one or more current jobs to showcase.</p>
              <div>
                {openJobs.map((job) => (
                  <label key={job.id} data-selected={selectedJobIds.includes(job.id)}>
                    <input type="checkbox" checked={selectedJobIds.includes(job.id)} onChange={() => toggleJob(job.id)} />
                    <span>
                      <strong>{job.title}</strong>
                      <small>{job.description}</small>
                      {job.application_deadline && <small>Deadline: {new Date(job.application_deadline).toLocaleString()}</small>}
                    </span>
                  </label>
                ))}
              </div>
              {!openJobs.length && <p className="status-note">There are no open vacancies to recommend.</p>}
            </fieldset>

            <label className="control-label">
              Closing
              <textarea className="input-field" rows={4} value={closing} onChange={(event) => setClosing(event.target.value)} required />
            </label>

            <div className="talent-email-summary">
              <span><small>Selected vacancies</small><strong>{selectedJobs.length}</strong></span>
              <span><small>Delivery</small><strong>Portal SMTP email</strong></span>
            </div>
            <button className="premium-button" disabled={sending || !selectedJobs.length || !application.email || !application.talent_pool_consent}>
              {sending ? "Sending Email..." : "Send Opportunity Email"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

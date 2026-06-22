"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { loadJobs, type Job } from "@/utils/jobs";
import { getRoleHome, getUserRole } from "@/utils/roles";
import {
  emptyInterviewScoreForm,
  interviewRecommendation,
  interviewScoreTotal,
  type InterviewScoreForm,
} from "@/utils/recruitment-insights";
import { type InterviewPanelScore } from "@/utils/interview-panel";
import UserBadge from "@/components/UserBadge";
import UniversityBrand from "@/components/UniversityBrand";
import { canJoinInterview, interviewAccessMessage } from "@/utils/interviews";

interface Application {
  id: string | number;
  job_id: string | number;
  name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  status: string;
  submitted_at?: string | null;
  interview_scheduled_at?: string | null;
  interview_meet_link?: string | null;
}

function candidateName(app: Application) {
  return app.name || app.full_name || "Applicant";
}

export default function RegistrarDashboard() {
  const [apps, setApps] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [scores, setScores] = useState<InterviewPanelScore[]>([]);
  const [scoreForms, setScoreForms] = useState<Record<string, InterviewScoreForm>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const router = useRouter();

  async function loadData() {
    const { data: sessionData } = await supabase.auth.getSession();
    const [applications, loadedJobs, scoresResponse] = await Promise.all([
      supabase.from("applications").select("*").order("submitted_at", { ascending: false }),
      loadJobs(supabase),
      fetch("/api/interview-scores", {
        headers: { Authorization: `Bearer ${sessionData.session?.access_token || ""}` },
      }).catch(() => null),
    ]);

    if (applications.error) setMessage(applications.error.message);
    setApps((applications.data || []) as Application[]);
    setJobs(loadedJobs);
    if (scoresResponse?.ok) {
      const data = await scoresResponse.json();
      const loadedScores = (data.scores || []) as InterviewPanelScore[];
      setScores(loadedScores);
      setScoreForms((current) => {
        const next = { ...current };
        loadedScores.forEach((score) => {
          next[String(score.application_id)] = {
            communication: String(score.communication),
            roleKnowledge: String(score.role_knowledge),
            experience: String(score.experience),
            cultureFit: String(score.culture_fit),
            notes: score.notes || "",
          };
        });
        return next;
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
      if (role !== "registrar") {
        router.replace(getRoleHome(role));
        return;
      }

      setCurrentUser(user);
      await loadData();
    };

    init();
  }, [router]);

  const scheduledApps = useMemo(
    () => apps.filter((app) => Boolean(app.interview_scheduled_at)),
    [apps]
  );

  function roleTitle(app: Application) {
    return jobs.find((job) => Number(job.id) === Number(app.job_id))?.title || `Job ${app.job_id}`;
  }

  function formFor(id: string | number) {
    return scoreForms[String(id)] || emptyInterviewScoreForm;
  }

  function updateForm(id: string | number, updates: Partial<InterviewScoreForm>) {
    setScoreForms((current) => ({
      ...current,
      [String(id)]: { ...emptyInterviewScoreForm, ...(current[String(id)] || {}), ...updates },
    }));
  }

  async function saveScore(app: Application) {
    const form = formFor(app.id);
    setBusyId(String(app.id));
    setMessage("");
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/interview-scores", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token || ""}`,
      },
      body: JSON.stringify({
        applicationId: app.id,
        communication: form.communication,
        roleKnowledge: form.roleKnowledge,
        experience: form.experience,
        cultureFit: form.cultureFit,
        notes: form.notes,
      }),
    }).catch(() => null);
    setBusyId(null);

    if (!response?.ok) {
      const data = response ? await response.json().catch(() => ({})) : {};
      setMessage(data.error || "The score could not be saved.");
      return;
    }

    setMessage(`${candidateName(app)}'s Registrar score was saved.`);
    await loadData();
  }

  return (
    <main className="app-shell">
      <div className="page-container">
        <header className="app-topbar">
          <div className="dashboard-brand-title">
            <UniversityBrand />
            <div>
              <p className="eyebrow">Registrar</p>
              <h1 className="page-title">Interview Review</h1>
              <p className="page-subtitle">Review recruitment records and submit independent interview panel scores.</p>
            </div>
          </div>
          <div className="topbar-actions">
            <UserBadge user={currentUser} label="Registrar account" onUserUpdated={setCurrentUser} />
            <button className="danger-button" onClick={async () => { await supabase.auth.signOut(); router.push("/"); }}>
              Logout
            </button>
          </div>
        </header>

        {message && <div className="glass-card onboarding-message">{message}</div>}

        <section className="glass-card ops-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Panel Workspace</p>
              <h2>Scheduled Interviews</h2>
              <p className="status-note">Your score is stored separately and compiled with HR's score for the final review.</p>
            </div>
            <span className="status-pill">{scheduledApps.length} sessions</span>
          </div>

          {loading ? (
            <p>Loading interviews...</p>
          ) : (
            <div className="interview-history-list">
              {scheduledApps.map((app) => {
                const form = formFor(app.id);
                const savedScore = scores.find((score) => String(score.application_id) === String(app.id));
                const draftTotal = interviewScoreTotal(form);
                const recommendation = interviewRecommendation(savedScore?.total_score ?? null);
                const scheduledAt = new Date(app.interview_scheduled_at || "");
                return (
                  <article key={app.id} className="interview-history-card">
                    <div className="registrar-score-header">
                      <div>
                        <p className="eyebrow">{scheduledAt.getTime() <= Date.now() ? "Past Session" : "Upcoming Session"}</p>
                        <h3>{candidateName(app)}</h3>
                        <p className="status-note">{app.email || app.phone || "No contact"} · {roleTitle(app)}</p>
                      </div>
                      <div>
                        <strong>{scheduledAt.toLocaleString()}</strong>
                        <p className="status-note">{app.status}</p>
                      </div>
                      <div>
                        <strong>{savedScore ? `${savedScore.total_score}/100` : "Not scored"}</strong>
                        <p className="status-note">{recommendation.label}</p>
                      </div>
                      {canJoinInterview(app.interview_scheduled_at, app.interview_meet_link, undefined, app.status) ? (
                        <a className="secondary-button" href={app.interview_meet_link || ""} target="_blank" rel="noreferrer">
                          Join Interview
                        </a>
                      ) : app.interview_meet_link ? <span className="status-note">{interviewAccessMessage(app.interview_scheduled_at, undefined, app.status)}</span> : null}
                    </div>

                    <div className="interview-score-grid">
                      <input className="input-field" type="number" min="0" max="25" placeholder="Communication /25" value={form.communication} onChange={(event) => updateForm(app.id, { communication: event.target.value })} />
                      <input className="input-field" type="number" min="0" max="25" placeholder="Role knowledge /25" value={form.roleKnowledge} onChange={(event) => updateForm(app.id, { roleKnowledge: event.target.value })} />
                      <input className="input-field" type="number" min="0" max="25" placeholder="Experience /25" value={form.experience} onChange={(event) => updateForm(app.id, { experience: event.target.value })} />
                      <input className="input-field" type="number" min="0" max="25" placeholder="Culture fit /25" value={form.cultureFit} onChange={(event) => updateForm(app.id, { cultureFit: event.target.value })} />
                    </div>
                    <textarea className="input-field" rows={3} placeholder="Registrar panel notes" value={form.notes} onChange={(event) => updateForm(app.id, { notes: event.target.value })} />
                    <div className="section-heading registrar-score-footer">
                      <p className="status-note">Current total: {draftTotal}/100 · {interviewRecommendation(draftTotal).label}</p>
                      <button className="premium-button" disabled={busyId === String(app.id)} onClick={() => saveScore(app)}>
                        {busyId === String(app.id) ? "Saving..." : savedScore ? "Update Registrar Score" : "Submit Registrar Score"}
                      </button>
                    </div>
                  </article>
                );
              })}
              {!scheduledApps.length && <p className="status-note">There are no scheduled interviews to score.</p>}
            </div>
          )}
        </section>

        <section className="glass-card ops-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Records</p>
              <h2>All Applications</h2>
            </div>
          </div>
          <div className="table-scroll">
            <table className="records-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Role</th>
                  <th>Submitted</th>
                  <th>Interview</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => (
                  <tr key={app.id}>
                    <td><strong>{candidateName(app)}</strong><p className="status-note">{app.email || app.phone}</p></td>
                    <td>{roleTitle(app)}</td>
                    <td>{app.submitted_at ? new Date(app.submitted_at).toLocaleString() : "Not recorded"}</td>
                    <td>{app.interview_scheduled_at ? new Date(app.interview_scheduled_at).toLocaleString() : "Not scheduled"}</td>
                    <td><span className="status-pill">{app.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

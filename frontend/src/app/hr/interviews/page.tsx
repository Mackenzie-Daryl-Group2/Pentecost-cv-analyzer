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
  parseInterviewScore,
  type InterviewScoreForm,
} from "@/utils/recruitment-insights";
import {
  compiledInterviewScore,
  reviewerLabel,
  type InterviewPanelScore,
} from "@/utils/interview-panel";
import UniversityBrand from "@/components/UniversityBrand";
import UserBadge from "@/components/UserBadge";
import { canJoinInterview, interviewAccessMessage } from "@/utils/interviews";

type Application = {
  id: string | number;
  job_id: string | number;
  name?: string;
  full_name?: string;
  email?: string;
  status: string;
  interview_scheduled_at?: string | null;
  interview_meet_link?: string | null;
  interview_notes?: string | null;
  interview_passed?: boolean | string | null;
};

function candidateName(app: Application) {
  return app.name || app.full_name || "Applicant";
}

function isTruthy(value: unknown) {
  return value === true || ["true", "yes", "1", "passed"].includes(String(value || "").toLowerCase());
}

export default function InterviewHistoryPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [scoreForms, setScoreForms] = useState<Record<string, InterviewScoreForm>>({});
  const [panelScores, setPanelScores] = useState<InterviewPanelScore[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();

  async function loadData() {
    const { data: sessionData } = await supabase.auth.getSession();
    const [applications, loadedJobs, scoresResponse] = await Promise.all([
      supabase
        .from("applications")
        .select("*")
        .not("interview_scheduled_at", "is", null)
        .order("interview_scheduled_at", { ascending: false }),
      loadJobs(supabase),
      fetch("/api/interview-scores", {
        headers: { Authorization: `Bearer ${sessionData.session?.access_token || ""}` },
      }).catch(() => null),
    ]);
    if (applications.error) setMessage(applications.error.message);
    setApps((applications.data || []) as Application[]);
    setJobs(loadedJobs);
    if (scoresResponse?.ok) {
      const scoreData = await scoresResponse.json();
      const loadedScores = (scoreData.scores || []) as InterviewPanelScore[];
      setPanelScores(loadedScores);
      const reviewerId = sessionData.session?.user.id;
      if (reviewerId) {
        setScoreForms((current) => {
          const next = { ...current };
          loadedScores
            .filter((score) => score.reviewer_id === reviewerId)
            .forEach((score) => {
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
      if (role !== "hr" && role !== "admin") {
        router.replace(getRoleHome(role));
        return;
      }
      setUser(user);
      await loadData();
    };
    init();
  }, [router]);

  const filteredApps = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return apps;
    return apps.filter((app) => {
      const role = jobs.find((job) => Number(job.id) === Number(app.job_id))?.title || "";
      return [candidateName(app), app.email, role, app.status].some((value) =>
        String(value || "").toLowerCase().includes(term)
      );
    });
  }, [apps, jobs, search]);

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
    const total = interviewScoreTotal(form);
    setBusyId(String(app.id));
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
      setMessage(data.error || "Interview score could not be saved.");
      return;
    }
    setMessage(`Interview score saved: ${total}/100.`);
    await loadData();
  }

  async function setResult(app: Application, passed: boolean) {
    setBusyId(String(app.id));
    const { error } = await supabase
      .from("applications")
      .update({ interview_passed: passed, status: passed ? "Interview Passed" : "Interview Not Passed" })
      .eq("id", app.id);
    setBusyId(null);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(passed ? "Candidate marked as passed." : "Candidate marked as not passed.");
    await loadData();
  }

  if (loading) return <main className="app-shell"><p>Loading interview records...</p></main>;

  return (
    <main className="app-shell">
      <div className="page-container">
        <header className="app-topbar">
          <div className="dashboard-brand-title">
            <UniversityBrand />
            <div>
              <p className="eyebrow">Interview Archive</p>
              <h1 className="page-title">Sessions and Scores</h1>
              <p className="page-subtitle">Review upcoming and completed sessions, record scores, and confirm outcomes.</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <UserBadge user={user} label="Staff account" onUserUpdated={setUser} />
            <button className="secondary-button" onClick={() => router.push(getUserRole(user) === "admin" ? "/admin" : "/hr")}>Dashboard</button>
          </div>
        </header>

        {message && <div className="glass-card onboarding-message">{message}</div>}

        <section className="glass-card ops-section">
          <div className="section-heading">
            <div>
              <h2>All Interview Sessions</h2>
              <p className="status-note">{filteredApps.length} records</p>
            </div>
            <input className="input-field" placeholder="Search candidate, role, email, or status" value={search} onChange={(event) => setSearch(event.target.value)} style={{ width: "min(360px, 78vw)" }} />
          </div>

          <div className="interview-history-list">
            {filteredApps.map((app) => {
              const role = jobs.find((job) => Number(job.id) === Number(app.job_id))?.title || `Job ${app.job_id}`;
              const scheduledAt = new Date(app.interview_scheduled_at || "");
              const isPast = scheduledAt.getTime() <= Date.now();
              const applicationScores = panelScores.filter((score) => String(score.application_id) === String(app.id));
              const compiledScore = compiledInterviewScore(applicationScores);
              const legacyScore = parseInterviewScore(app.interview_notes);
              const savedScore = compiledScore ?? legacyScore;
              const recommendation = interviewRecommendation(savedScore);
              const form = formFor(app.id);
              return (
                <article key={app.id} className="interview-history-card">
                  <div className="interview-history-summary">
                    <div>
                      <p className="eyebrow">{isPast ? "Completed / Past Session" : "Upcoming Session"}</p>
                      <h3>{candidateName(app)}</h3>
                      <p className="status-note">{app.email || "No email"} · {role}</p>
                    </div>
                    <div>
                      <strong>{scheduledAt.toLocaleString()}</strong>
                      <p className="status-note">{app.status}</p>
                    </div>
                    <div>
                      <strong>{savedScore === null ? "Not scored" : `${savedScore}/100`}</strong>
                      <p className="status-note">
                        {applicationScores.length ? `${applicationScores.length} panel review${applicationScores.length === 1 ? "" : "s"}` : "No panel reviews"} · {recommendation.label}
                      </p>
                    </div>
                    <div className="interview-history-actions">
                      {canJoinInterview(app.interview_scheduled_at, app.interview_meet_link, app.interview_passed, app.status) ? (
                        <a className="secondary-button" href={app.interview_meet_link || ""} target="_blank" rel="noreferrer">Join</a>
                      ) : app.interview_meet_link ? (
                        <span className="status-note">{interviewAccessMessage(app.interview_scheduled_at, app.interview_passed, app.status)}</span>
                      ) : null}
                      <button className="secondary-button" disabled={busyId === String(app.id)} onClick={() => setResult(app, true)}>Passed</button>
                      <button className="danger-button" disabled={busyId === String(app.id)} onClick={() => setResult(app, false)}>Not Passed</button>
                    </div>
                  </div>
                  {applicationScores.length > 0 && (
                    <div className="panel-score-summary">
                      <div>
                        <p className="eyebrow">Compiled Panel Score</p>
                        <strong>{compiledScore}/100</strong>
                      </div>
                      {applicationScores.map((score) => (
                        <div key={`${score.application_id}-${score.reviewer_id}`}>
                          <p className="eyebrow">{reviewerLabel(score)}</p>
                          <strong>{score.total_score}/100</strong>
                          <p className="status-note">{score.reviewer_email || "Panel member"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <details open={isPast || savedScore === null}>
                    <summary>{savedScore === null ? "Score this interview" : "Update interview score"}</summary>
                    <div className="interview-score-grid">
                      <input className="input-field" type="number" min="0" max="25" placeholder="Communication /25" value={form.communication} onChange={(event) => updateForm(app.id, { communication: event.target.value })} />
                      <input className="input-field" type="number" min="0" max="25" placeholder="Role knowledge /25" value={form.roleKnowledge} onChange={(event) => updateForm(app.id, { roleKnowledge: event.target.value })} />
                      <input className="input-field" type="number" min="0" max="25" placeholder="Experience /25" value={form.experience} onChange={(event) => updateForm(app.id, { experience: event.target.value })} />
                      <input className="input-field" type="number" min="0" max="25" placeholder="Culture fit /25" value={form.cultureFit} onChange={(event) => updateForm(app.id, { cultureFit: event.target.value })} />
                    </div>
                    <textarea className="input-field" rows={3} placeholder="Panel notes" value={form.notes} onChange={(event) => updateForm(app.id, { notes: event.target.value })} />
                    <div className="section-heading" style={{ marginTop: "10px" }}>
                      <p className="status-note">Draft: {interviewScoreTotal(form)}/100 · {interviewRecommendation(interviewScoreTotal(form)).label}</p>
                      <button className="premium-button" disabled={busyId === String(app.id)} onClick={() => saveScore(app)}>Save Score</button>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
          {!filteredApps.length && <p className="status-note">No interview sessions found.</p>}
        </section>
      </div>
    </main>
  );
}

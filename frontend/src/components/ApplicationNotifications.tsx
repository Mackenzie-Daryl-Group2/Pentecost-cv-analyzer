"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getJobById } from "@/utils/jobs";
import { getUserRole, isApplicantRole } from "@/utils/roles";
import { supabase } from "@/utils/supabase";
import { canJoinInterview, interviewAccessMessage } from "@/utils/interviews";

type ApplicationNotice = {
  id: number;
  job_id: number;
  status: string;
  submitted_at?: string | null;
  interview_scheduled_at?: string | null;
  interview_meet_link?: string | null;
  interview_passed?: boolean | string | null;
  onboarding_status?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function progressFor(app: ApplicationNotice) {
  const status = String(app.status || "").toLowerCase();

  if (status.includes("hired") || app.onboarding_status === "Completed") return { label: "Completed", step: 5, percent: 100 };
  if (status.includes("onboarding") || app.onboarding_status) return { label: "Onboarding", step: 4, percent: 82 };
  if (status.includes("hire")) return { label: "Final Review", step: 4, percent: 72 };
  if (status.includes("interview passed")) return { label: "Interview Passed", step: 3, percent: 62 };
  if (status.includes("interview") || app.interview_scheduled_at) return { label: "Interview", step: 3, percent: 52 };
  if (status.includes("cv passed") || status.includes("recommended")) return { label: "CV Approved", step: 2, percent: 36 };
  if (status.includes("not passed") || status.includes("rejected")) return { label: "Closed", step: 1, percent: 100 };
  return { label: "Submitted", step: 1, percent: 18 };
}

export default function ApplicationNotifications() {
  const [open, setOpen] = useState(false);
  const [apps, setApps] = useState<ApplicationNotice[]>([]);
  const [isApplicant, setIsApplicant] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;

      if (!user || !isApplicantRole(getUserRole(user))) {
        setIsApplicant(false);
        setLoading(false);
        return;
      }

      setIsApplicant(true);
      const { data } = await supabase
        .from("applications")
        .select("id,job_id,status,submitted_at,interview_scheduled_at,interview_meet_link,interview_passed,onboarding_status")
        .eq("email", user.email || "")
        .order("submitted_at", { ascending: false });

      if (mounted) {
        setApps((data || []) as ApplicationNotice[]);
        setLoading(false);
      }
    }

    load();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const latest = apps[0];
  const unreadCount = apps.length;
  const latestProgress = useMemo(() => latest ? progressFor(latest) : null, [latest]);

  if (!isApplicant && !loading) return null;

  return (
    <div className="notification-shell">
      <button
        type="button"
        className="notification-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-label="Application notifications"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {unreadCount > 0 && <span>{unreadCount}</span>}
      </button>

      {open && (
        <section className="notification-panel" aria-label="Application progress">
          <div className="notification-header">
            <div>
              <p className="eyebrow">Application Updates</p>
              <h2>Progress Tracker</h2>
            </div>
            <button className="modal-icon-button" type="button" onClick={() => setOpen(false)} aria-label="Close notifications">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>

          {loading ? (
            <p className="status-note">Checking your application progress...</p>
          ) : !apps.length ? (
            <div className="notification-empty">
              <p>You have no applications yet.</p>
              <button className="premium-button" onClick={() => { setOpen(false); router.push("/jobs"); }}>Browse Jobs</button>
            </div>
          ) : (
            <div className="notification-list">
              {apps.slice(0, 4).map((app) => {
                const progress = progressFor(app);
                const jobTitle = getJobById(app.job_id)?.title || `Job ${app.job_id}`;

                return (
                  <article key={app.id} className="notification-card">
                    <div className="notification-card-header">
                      <strong>{jobTitle}</strong>
                      <span>{progress.label}</span>
                    </div>
                    <div className="notification-progress">
                      <span style={{ width: `${progress.percent}%` }} />
                    </div>
                    <p className="status-note">{app.status}</p>
                    {app.interview_scheduled_at && (
                      <p className="status-note">Interview: {formatDate(app.interview_scheduled_at)}</p>
                    )}
                    {canJoinInterview(app.interview_scheduled_at, app.interview_meet_link, app.interview_passed, app.status) ? (
                      <a className="notification-link" href={app.interview_meet_link || ""} target="_blank" rel="noreferrer">Open meeting link</a>
                    ) : app.interview_meet_link ? (
                      <p className="status-note">{interviewAccessMessage(app.interview_scheduled_at, app.interview_passed, app.status)}</p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}

          {latestProgress && (
            <button className="secondary-button" onClick={() => { setOpen(false); router.push("/my-applications"); }}>
              View all applications
            </button>
          )}
        </section>
      )}
    </div>
  );
}

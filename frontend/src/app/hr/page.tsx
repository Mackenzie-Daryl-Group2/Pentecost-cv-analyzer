"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";
import { getMatchDecision, getMatchStyle } from "@/utils/match";
import { getJobById, loadJobs, type Job } from "@/utils/jobs";
import { getRoleHome, getUserRole } from "@/utils/roles";
import {
  cvAiSummary,
  interviewRecommendation,
  onboardingProgress,
  onboardingEmailForStep,
  onboardingSteps,
  parseInterviewScore,
} from "@/utils/recruitment-insights";
import UserBadge, { Avatar } from "@/components/UserBadge";
import UniversityBrand from "@/components/UniversityBrand";
import { generateStaffId, onboardingStepHref, parseOnboardingDocuments } from "@/utils/onboarding";
import { canJoinInterview, interviewAccessMessage } from "@/utils/interviews";
import { compiledInterviewScore, type InterviewPanelScore } from "@/utils/interview-panel";

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
  onboarding_documents?: unknown;
  onboarding_required_documents?: string[] | null;
  orientation_details?: string | null;
  staff_id?: string | null;
  privacy_consent_at?: string | null;
  talent_pool_consent?: boolean | null;
  talent_pool_added_at?: string | null;
  withdrawn_at?: string | null;
  retention_until?: string | null;
  data_deletion_requested_at?: string | null;
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
}

type JobForm = Omit<Job, "id">;
type HrPanel = "screening" | "recommendations" | "history" | "interviews" | "hiring" | "onboarding" | "talent" | "vacancies" | "metrics";

const emptyJobForm: JobForm = {
  title: "",
  description: "",
  requirements: "",
  salary: "",
  application_deadline: null,
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

function passedCv(app: Application, threshold: number) {
  const status = String(app.status || "").toLowerCase();
  const manuallyPassed = status.includes("cv passed") || status.includes("approved") || status.includes("recommended for interview");
  return manuallyPassed || Number(app.similarity || 0) * 100 >= threshold;
}

function rejectedCv(app: Application) {
  const status = String(app.status || "").toLowerCase();
  return status.includes("cv not passed") || status.includes("cv rejected") || status.includes("not qualified");
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
  const [panelScores, setPanelScores] = useState<InterviewPanelScore[]>([]);
  const [newJob, setNewJob] = useState<JobForm>(emptyJobForm);
  const [editJobId, setEditJobId] = useState<number | null>(null);
  const [editJob, setEditJob] = useState<JobForm>(emptyJobForm);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [selectedHiringId, setSelectedHiringId] = useState<number | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ datetime: "", meetLink: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activePanel, setActivePanel] = useState<HrPanel>("screening");
  const [applicationSearch, setApplicationSearch] = useState("");
  const [portalEmail, setPortalEmail] = useState({ to: "", subject: "", message: "" });
  const [cvPassThreshold, setCvPassThreshold] = useState(55);
  const [thresholdDraft, setThresholdDraft] = useState("55");
  const [talentSearch, setTalentSearch] = useState("");
  const [offerForm, setOfferForm] = useState({
    salary: "",
    startDate: "",
    probation: "Six months",
    reportingOfficer: "Head of Department",
    responseDeadline: "",
    additionalTerms: "",
  });
  const router = useRouter();

  async function fetchData() {
    const { data: sessionData } = await supabase.auth.getSession();
    const [applicationsResponse, loadedJobs, scoresResponse] = await Promise.all([
      supabase.from("applications").select("*").order("similarity", { ascending: false }),
      loadJobs(supabase),
      fetch("/api/interview-scores", {
        headers: { Authorization: `Bearer ${sessionData.session?.access_token || ""}` },
      }).catch(() => null),
    ]);

    if (applicationsResponse.error) {
      setMessage(applicationsResponse.error.message);
    } else {
      setApps((applicationsResponse.data || []) as Application[]);
    }

    if (scoresResponse?.ok) {
      const scoreData = await scoresResponse.json().catch(() => ({}));
      setPanelScores((scoreData.scores || []) as InterviewPanelScore[]);
    }

    setJobs(loadedJobs);
    if (loadedJobs.length && !editJobId) {
      setEditJobId(loadedJobs[0].id);
      setEditJob({
        title: loadedJobs[0].title,
        description: loadedJobs[0].description,
        requirements: loadedJobs[0].requirements,
        salary: loadedJobs[0].salary,
        application_deadline: loadedJobs[0].application_deadline || null,
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
      const { data: sessionData } = await supabase.auth.getSession();
      const [thresholdResponse] = await Promise.all([
        fetch("/api/settings/cv-threshold", {
          headers: { Authorization: `Bearer ${sessionData.session?.access_token || ""}` },
        }).catch(() => null),
        fetchData(),
      ]);
      if (thresholdResponse?.ok) {
        const thresholdData = await thresholdResponse.json();
        const threshold = Number(thresholdData.threshold || 55);
        setCvPassThreshold(threshold);
        setThresholdDraft(String(threshold));
      }
    };

    init();
  }, [router]);

  function interviewScoresFor(appId: number | string) {
    return panelScores.filter((score) => String(score.application_id) === String(appId));
  }

  function interviewScoreFor(app: Application) {
    return compiledInterviewScore(interviewScoresFor(app.id)) ?? parseInterviewScore(app.interview_notes);
  }

  const cvPassedApps = useMemo(() => apps.filter((app) => passedCv(app, cvPassThreshold)), [apps, cvPassThreshold]);
  const scheduledApps = useMemo(() => apps.filter((app) => Boolean(app.interview_scheduled_at)), [apps]);
  const completedInterviewApps = useMemo(
    () => scheduledApps.filter((app) => new Date(app.interview_scheduled_at || "").getTime() <= Date.now()),
    [scheduledApps]
  );
  const scoringQueueApps = useMemo(
    () => completedInterviewApps.filter((app) => interviewScoreFor(app) === null || app.interview_passed === null || app.interview_passed === undefined),
    [completedInterviewApps, panelScores]
  );
  const upcomingInterviewApps = useMemo(
    () => scheduledApps.filter((app) =>
      new Date(app.interview_scheduled_at || "").getTime() > Date.now()
      && app.interview_passed !== true
      && app.interview_passed !== false
    ),
    [scheduledApps]
  );
  const passedInterviewApps = useMemo(() => apps.filter((app) => truthy(app.interview_passed)), [apps]);
  const onboardingApps = useMemo(
    () => apps.filter((app) => truthy(app.interview_passed) || Boolean(app.onboarding_status)),
    [apps]
  );
  const talentPoolApps = useMemo(
    () => apps.filter((app) => truthy(app.talent_pool_consent)),
    [apps]
  );
  const filteredTalentPool = useMemo(() => {
    const term = talentSearch.trim().toLowerCase();
    if (!term) return talentPoolApps;
    return talentPoolApps.filter((app) =>
      [candidateName(app), app.email || "", roleTitle(app, jobs), app.status || ""]
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [jobs, talentPoolApps, talentSearch]);
  const bestApplicationsByRole = useMemo(() => {
    return jobs
      .map((job) => ({
        job,
        applicants: apps
          .filter((app) => {
            const status = String(app.status || "").toLowerCase();
            return Number(app.job_id) === Number(job.id)
              && !rejectedCv(app)
              && !status.includes("withdrawn");
          })
          .sort((a, b) => Number(b.similarity || 0) - Number(a.similarity || 0))
          .slice(0, 3),
      }))
      .filter((group) => group.applicants.length);
  }, [apps, jobs]);
  const hrReportApps = useMemo(() => apps.filter((app) => passedCv(app, cvPassThreshold) && truthy(app.interview_passed)), [apps, cvPassThreshold]);
  const rejectedApps = useMemo(() => apps.filter(rejectedCv), [apps]);
  const screeningApps = useMemo(() => apps.filter((app) => !rejectedCv(app)), [apps]);
  const pendingReviewApps = useMemo(() => screeningApps.filter((app) => !passedCv(app, cvPassThreshold)), [screeningApps, cvPassThreshold]);
  const filteredApps = useMemo(() => {
    const term = applicationSearch.trim().toLowerCase();
    if (!term) return screeningApps;

    return screeningApps.filter((app) =>
      [
        candidateName(app),
        app.email || "",
        app.phone || "",
        roleTitle(app, jobs),
        app.status || "",
      ].some((value) => value.toLowerCase().includes(term))
    );
  }, [screeningApps, applicationSearch, jobs]);

  useEffect(() => {
    if (!selectedScheduleId && cvPassedApps.length) {
      setSelectedScheduleId(cvPassedApps[0].id);
    }
  }, [cvPassedApps, selectedScheduleId]);

  useEffect(() => {
    if (passedInterviewApps.length && !passedInterviewApps.some((app) => app.id === selectedHiringId)) {
      setSelectedHiringId(passedInterviewApps[0].id);
    }
  }, [passedInterviewApps, selectedHiringId]);

  useEffect(() => {
    if (!selectedHiringApp) return;
    setOfferForm({
      salary: selectedHiringApp.offer_details?.salary || "",
      startDate: selectedHiringApp.offer_details?.startDate || "",
      probation: selectedHiringApp.offer_details?.probation || "Six months",
      reportingOfficer: selectedHiringApp.offer_details?.reportingOfficer || "Head of Department",
      responseDeadline: selectedHiringApp.offer_details?.responseDeadline || "",
      additionalTerms: selectedHiringApp.offer_details?.additionalTerms || "",
    });
  }, [selectedHiringId]);

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
  const selectedHiringApp = passedInterviewApps.find((app) => app.id === selectedHiringId);

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

  async function handleOnboardingStep(app: Application, step: string) {
    const updated = await updateApplication(
      app.id,
      {
        onboarding_status: step,
        status: step === "Completed" ? "Hired / Onboarded" : "Awaiting Onboarding",
        ...(step === "Completed" ? { staff_id: app.staff_id || generateStaffId(app.id) } : {}),
      },
      `Onboarding updated: ${step}.`
    );

    if (!updated) return;

    const finalStaffId = step === "Completed" ? app.staff_id || generateStaffId(app.id) : app.staff_id;
    const portalUrl = typeof window !== "undefined"
      ? `${window.location.origin}${onboardingStepHref(app.id, step)}`
      : "";
    const email = onboardingEmailForStep(step, candidateName(app), roleTitle(app, jobs), {
      staffId: finalStaffId,
      orientationDetails: app.orientation_details,
      portalUrl,
    });
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

  async function handlePortalEmail(event: React.FormEvent) {
    event.preventDefault();
    setBusyAction("portal-email");
    setMessage("");
    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: portalEmail.to.trim(),
          subject: portalEmail.subject.trim(),
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6">
              ${escapeHtml(portalEmail.message).replace(/\n/g, "<br/>")}
              <p>Pentecost University HR Department</p>
            </div>
          `,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Email could not be sent.");
      setPortalEmail({ to: "", subject: "", message: "" });
      setMessage("Email sent successfully through the HR portal.");
    } catch (error: any) {
      setMessage(error.message || "Email could not be sent.");
    } finally {
      setBusyAction("");
    }
  }

  async function saveCvPassThreshold() {
    const threshold = Number(thresholdDraft);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
      setMessage("CV pass threshold must be between 0 and 100.");
      return;
    }
    setBusyAction("cv-threshold");
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/settings/cv-threshold", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token || ""}`,
        },
        body: JSON.stringify({ threshold }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "CV pass threshold could not be saved.");
      setCvPassThreshold(result.threshold);
      setThresholdDraft(String(result.threshold));
      setMessage(`CV pass threshold updated to ${result.threshold}%.`);
    } catch (error: any) {
      setMessage(error.message || "CV pass threshold could not be saved.");
    } finally {
      setBusyAction("");
    }
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

  async function restoreRejectedCv(app: Application) {
    await updateApplication(
      app.id,
      { cv_passed: null, status: "HR Review" },
      "Application returned to the screening workspace."
    );
  }

  function printOfferLetter(app: Application, details = app.offer_details) {
    if (!details) {
      setMessage("Generate the offer details before opening the letter.");
      return;
    }
    const letter = window.open("", "_blank");
    if (!letter) {
      setMessage("Allow pop-ups to open the printable offer letter.");
      return;
    }
    letter.document.write(`<!doctype html>
      <html><head><title>Offer Letter - ${escapeHtml(candidateName(app))}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#17211b;margin:0;padding:48px;line-height:1.6}
        .page{max-width:760px;margin:auto}.header{border-bottom:4px solid #08783f;padding-bottom:18px;margin-bottom:30px}
        h1{font-size:24px;margin:0;color:#08783f}.meta{color:#59645d;font-size:13px}.terms{background:#f4f7f5;padding:18px;margin:24px 0}
        .sign{margin-top:48px}.actions{position:fixed;right:20px;top:20px}@media print{.actions{display:none}body{padding:0}}
        button{background:#08783f;color:white;border:0;padding:10px 16px;font-weight:bold;cursor:pointer}
      </style></head><body><button class="actions" onclick="window.print()">Print / Save PDF</button><main class="page">
      <header class="header"><h1>Pentecost University</h1><p class="meta">P. O. Box KN 1739, Kaneshie, Accra · info@pentvars.edu.gh</p></header>
      <p>${new Date().toLocaleDateString()}</p>
      <p><strong>${escapeHtml(candidateName(app))}</strong><br>${escapeHtml(app.email || "")}</p>
      <h2>Offer of Appointment: ${escapeHtml(details.position || roleTitle(app, jobs))}</h2>
      <p>Dear ${escapeHtml(candidateName(app))},</p>
      <p>Pentecost University is pleased to offer you appointment as <strong>${escapeHtml(details.position || roleTitle(app, jobs))}</strong>, commencing on <strong>${escapeHtml(details.startDate || "the agreed date")}</strong>.</p>
      <div class="terms">
        <p><strong>Salary:</strong> ${escapeHtml(details.salary || "As communicated by HR")}</p>
        <p><strong>Probation:</strong> ${escapeHtml(details.probation || "Six months")}</p>
        <p><strong>Reporting officer:</strong> ${escapeHtml(details.reportingOfficer || "Head of Department")}</p>
        ${details.responseDeadline ? `<p><strong>Response deadline:</strong> ${escapeHtml(details.responseDeadline)}</p>` : ""}
      </div>
      ${details.additionalTerms ? `<p>${escapeHtml(details.additionalTerms).replace(/\n/g, "<br>")}</p>` : ""}
      <p>This appointment is subject to successful verification of your submitted documents, references, and compliance with University policies.</p>
      <p>Please sign in to the recruitment portal to accept or decline this offer.</p>
      <div class="sign"><p>Yours faithfully,</p><p><strong>Human Resources Department</strong><br>Pentecost University</p></div>
      </main></body></html>`);
    letter.document.close();
    letter.opener = null;
  }

  async function generateOfferLetter(app: Application) {
    setBusyAction(`offer-${app.id}`);
    setMessage("");
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch(`/api/offers/${app.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token || ""}`,
      },
      body: JSON.stringify({ ...offerForm, position: roleTitle(app, jobs) }),
    }).catch(() => null);
    setBusyAction("");
    if (!response?.ok) {
      const data = response ? await response.json().catch(() => ({})) : {};
      setMessage(data.error || "Offer letter could not be generated.");
      return;
    }
    const data = await response.json();
    const emailSent = app.email
      ? await sendApplicantEmail(
          app,
          `Offer of Appointment: ${roleTitle(app, jobs)}`,
          `<h2>Offer of Appointment</h2>
           <p>Hello ${escapeHtml(candidateName(app))},</p>
           <p>Pentecost University has issued an offer of appointment for <strong>${escapeHtml(roleTitle(app, jobs))}</strong>.</p>
           <p>Please sign in to the recruitment portal to review the appointment details and accept or decline the offer.</p>
           <p>Regards,<br>Human Resources Department<br>Pentecost University</p>`
        )
      : false;
    setMessage(emailSent
      ? "Offer letter generated, saved to the portal, and emailed to the applicant."
      : "Offer letter generated and saved to the applicant's portal.");
    await fetchData();
    printOfferLetter(data.application, data.application.offer_details);
  }

  async function updateTalentPool(app: Application, enabled: boolean) {
    setBusyAction(`talent-${app.id}`);
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch(`/api/applications/${app.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token || ""}`,
      },
      body: JSON.stringify({ action: "talent-pool", enabled }),
    }).catch(() => null);
    setBusyAction("");
    if (!response?.ok) {
      const data = response ? await response.json().catch(() => ({})) : {};
      setMessage(data.error || "Talent pool could not be updated.");
      return;
    }
    setMessage(enabled ? "Candidate added to the talent pool." : "Candidate removed from the talent pool.");
    await fetchData();
  }

  async function handleBestThreeAction(app: Application, action: string) {
    if (action === "approve-cv") await handleApproveCv(app);
    if (action === "recommend-interview") await handleApproveCv(app, "Recommended for Interview");
    if (action === "reject-cv") await handleRejectCv(app);
    if (action === "pass-interview") await handleInterviewResult(app, true);
    if (action === "not-pass-interview") await handleInterviewResult(app, false);
    if (action === "recommend-hire") await handleRecommendForHire(app);
    if (action === "approve-hire") await handleHiring(app);
  }

  function downloadReport() {
    const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Candidate", "Email", "Phone", "Role", "CV Match Percent", "CV Threshold", "Interview Score", "Interview Result", "Onboarding", "Status"],
      ...hrReportApps.map((app) => [
        candidateName(app),
        app.email || "",
        app.phone || "",
        roleTitle(app, jobs),
        Math.round(Number(app.similarity || 0) * 100),
        cvPassThreshold,
        interviewScoreFor(app) ?? "",
        truthy(app.interview_passed) ? "Passed" : "Not Passed",
        app.onboarding_status || "Not started",
        app.status,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pentecost_hr_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadFunnelReport() {
    const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Metric", "Count", "Rate"],
      ["Applications", apps.length, "100%"],
      ["CV passed", cvPassedApps.length, apps.length ? `${Math.round(cvPassedApps.length / apps.length * 100)}%` : "0%"],
      ["Interviews scheduled", scheduledApps.length, apps.length ? `${Math.round(scheduledApps.length / apps.length * 100)}%` : "0%"],
      ["Interviews passed", passedInterviewApps.length, scheduledApps.length ? `${Math.round(passedInterviewApps.length / scheduledApps.length * 100)}%` : "0%"],
      ["Onboarding", onboardingApps.length, passedInterviewApps.length ? `${Math.round(onboardingApps.length / passedInterviewApps.length * 100)}%` : "0%"],
      ["Talent pool", talentPoolApps.length, apps.length ? `${Math.round(talentPoolApps.length / apps.length * 100)}%` : "0%"],
      ["Withdrawn", apps.filter((app) => Boolean(app.withdrawn_at)).length, ""],
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    link.download = `pentecost_recruitment_funnel_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const metricCards = [
    { label: "Total Vacancies", value: jobs.length },
    { label: "Total Applications", value: apps.length },
    { label: "CV Passed Candidates", value: cvPassedApps.length },
    { label: "Upcoming Interviews", value: upcomingInterviewApps.length },
    { label: "Ready for Hiring", value: passedInterviewApps.length },
  ];

  const panels: Array<{ id: HrPanel; label: string; count: number }> = [
    { id: "screening", label: "Screening", count: screeningApps.length },
    { id: "recommendations", label: "Best Three", count: bestApplicationsByRole.length },
    { id: "history", label: "Rejection History", count: rejectedApps.length },
    { id: "interviews", label: "Interviews", count: upcomingInterviewApps.length + cvPassedApps.length },
    { id: "hiring", label: "Hiring", count: passedInterviewApps.length },
    { id: "onboarding", label: "Onboarding", count: onboardingApps.length },
    { id: "talent", label: "Talent Pool", count: talentPoolApps.length },
    { id: "vacancies", label: "Vacancies", count: jobs.length },
    { id: "metrics", label: "Metrics & Email", count: apps.length },
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
            <button className="secondary-button" onClick={() => router.push("/hr/operations")}>Operations Center</button>
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

        {upcomingInterviewApps.length > 0 && (
          <section className="glass-card upcoming-interviews">
            <div className="section-heading">
              <div>
                <h2>Upcoming Interview Meetings</h2>
                <p className="status-note">Join scheduled meetings directly from the HR dashboard.</p>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button className="secondary-button" type="button" onClick={() => setActivePanel("interviews")}>
                  Schedule Interviews
                </button>
                <button className="secondary-button" type="button" onClick={() => router.push("/hr/interviews")}>
                  Interview History
                </button>
              </div>
            </div>
            <div className="meeting-list">
              {upcomingInterviewApps.map((app) => (
                <article key={app.id} className="meeting-row">
                  <CandidateSummary app={app} jobs={jobs} detail={roleTitle(app, jobs)} />
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

        <div className="admin-workspace">
          <aside className="admin-sidebar">
            <div>
              <p className="eyebrow">HR Sections</p>
              <h2>Recruitment Desk</h2>
              <p className="status-note">Move between screening, interviews, hiring, vacancies, and reporting tools.</p>
            </div>
            <label className="admin-section-select">
              Quick switch
              <select className="input-field" value={activePanel} onChange={(event) => setActivePanel(event.target.value as HrPanel)}>
                {panels.map((panel) => (
                  <option key={panel.id} value={panel.id}>{panel.label} ({panel.count})</option>
                ))}
              </select>
            </label>
            <nav className="admin-section-list" aria-label="HR workflow sections">
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
                    <small>{panel.id === "metrics" ? "Reports and email" : panel.id}</small>
                  </span>
                  <span className="admin-section-count">{panel.count}</span>
                </button>
              ))}
            </nav>
          </aside>

          <div className="admin-panel-surface">

        {activePanel === "vacancies" && (
          <>
        <section className="glass-card" style={cardStyle}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "18px" }}>Create Job Vacancy</h2>
          <form onSubmit={handleCreateJob} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <input className="input-field" placeholder="Job title" value={newJob.title} onChange={(e) => setNewJob({ ...newJob, title: e.target.value })} required />
            <input className="input-field" placeholder="Salary" value={newJob.salary} onChange={(e) => setNewJob({ ...newJob, salary: e.target.value })} required />
            <textarea className="input-field" placeholder="Description" rows={3} value={newJob.description} onChange={(e) => setNewJob({ ...newJob, description: e.target.value })} required />
            <textarea className="input-field" placeholder="Requirements" rows={3} value={newJob.requirements} onChange={(e) => setNewJob({ ...newJob, requirements: e.target.value })} required />
            <label className="control-label">
              Application cutoff
              <input className="input-field" type="datetime-local" value={newJob.application_deadline ? toDatetimeInput(newJob.application_deadline) : ""} onChange={(e) => setNewJob({ ...newJob, application_deadline: e.target.value || null })} />
            </label>
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
                      application_deadline: selectedJob.application_deadline || null,
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
              <label className="control-label">
                Application cutoff
                <input className="input-field" type="datetime-local" value={editJob.application_deadline ? toDatetimeInput(editJob.application_deadline) : ""} onChange={(e) => setEditJob({ ...editJob, application_deadline: e.target.value || null })} />
              </label>
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
        <section className="glass-card hr-interview-scheduler" style={cardStyle}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Interview Scheduling</p>
              <h2>Applicants Who Passed CV Mark</h2>
              <p className="status-note">Select a candidate, review their details, then schedule the interview from the panel beside them.</p>
            </div>
            <span className="status-pill">{cvPassedApps.length} qualified</span>
          </div>
          {cvPassedApps.length && selectedScheduleApp ? (
            <div className="hr-schedule-workspace">
              <div className="hr-schedule-roster">
                <div className="hr-schedule-roster-heading">
                  <div>
                    <p className="eyebrow">Qualified Candidates</p>
                    <strong>Select an applicant</strong>
                  </div>
                  <span>{cvPassedApps.length}</span>
                </div>
                <div className="hr-schedule-candidate-list">
                  {cvPassedApps.map((app) => {
                    const decision = getMatchDecision(Number(app.similarity || 0));
                    const isSelected = selectedScheduleId === app.id;
                    const matchPercent = Math.round(Number(app.similarity || 0) * 100);
                    return (
                      <button
                        key={app.id}
                        type="button"
                        className="hr-schedule-candidate"
                        data-active={isSelected}
                        onClick={() => setSelectedScheduleId(app.id)}
                      >
                        <div className="hr-schedule-candidate-main">
                          <CandidateSummary app={app} jobs={jobs} detail={app.email || app.phone || "No contact on file"} />
                          <span className="hr-schedule-selection" aria-hidden="true">{isSelected ? "Selected" : "Select"}</span>
                        </div>
                        <div className="hr-schedule-candidate-meta">
                          <span><small>Role</small><strong>{roleTitle(app, jobs)}</strong></span>
                          <span><small>CV match</small><strong>{matchPercent}% · {decision.label}</strong></span>
                          <span><small>Interview</small><strong>{app.interview_scheduled_at ? formatDate(app.interview_scheduled_at) : "Not scheduled"}</strong></span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleScheduleInterview} className="hr-schedule-form">
                <div className="hr-schedule-form-header">
                  <CandidateSummary
                    app={selectedScheduleApp}
                    jobs={jobs}
                    detail={selectedScheduleApp.email || "No applicant email on file"}
                  />
                  <div className="hr-schedule-role">
                    <p className="eyebrow">Position</p>
                    <strong>{roleTitle(selectedScheduleApp, jobs)}</strong>
                  </div>
                  {canJoinInterview(selectedScheduleApp.interview_scheduled_at, selectedScheduleApp.interview_meet_link, selectedScheduleApp.interview_passed, selectedScheduleApp.status) && (
                    <a
                      className="secondary-button"
                      href={selectedScheduleApp.interview_meet_link || ""}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Join Meeting
                    </a>
                  )}
                </div>
                <div className="hr-schedule-current">
                  <span>
                    <small>Current schedule</small>
                    <strong>{formatDate(selectedScheduleApp.interview_scheduled_at)}</strong>
                  </span>
                  <span>
                    <small>Meeting status</small>
                    <strong>
                      {canJoinInterview(selectedScheduleApp.interview_scheduled_at, selectedScheduleApp.interview_meet_link, selectedScheduleApp.interview_passed, selectedScheduleApp.status)
                        ? "Link ready"
                        : interviewAccessMessage(selectedScheduleApp.interview_scheduled_at, selectedScheduleApp.interview_passed, selectedScheduleApp.status)}
                    </strong>
                  </span>
                </div>
                {message && (
                  <p className="status-note hr-schedule-message">
                    {message}
                  </p>
                )}
                <label className="control-label">
                  Interview date and time
                  <input className="input-field" type="datetime-local" value={scheduleForm.datetime} onChange={(e) => setScheduleForm({ ...scheduleForm, datetime: e.target.value })} required />
                </label>
                <label className="control-label">
                  Google Meet link
                  <input className="input-field" placeholder="Generated automatically, or paste a link" value={scheduleForm.meetLink} onChange={(e) => setScheduleForm({ ...scheduleForm, meetLink: e.target.value })} />
                </label>
                <label className="control-label">
                  Interview notes or venue
                  <textarea className="input-field" placeholder="Add panel instructions, venue, or preparation notes" rows={4} value={scheduleForm.notes} onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })} />
                </label>
                <button className="premium-button" type="submit" disabled={busyAction === `app-${selectedScheduleApp.id}`}>
                  {busyAction === `app-${selectedScheduleApp.id}` ? "Scheduling..." : "Schedule Interview"}
                </button>
              </form>
            </div>
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>No applicant has passed the CV mark yet.</p>
          )}
        </section>

        <section className="glass-card" style={cardStyle}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Completed Interviews</p>
              <h2>Ready for Scoring</h2>
              <p className="status-note">Interviews whose scheduled time has passed appear here so HR can score them and confirm the outcome.</p>
            </div>
            <span className="status-pill">{scoringQueueApps.length} pending</span>
          </div>
          {scoringQueueApps.length ? (
            <div className="hr-score-queue">
              {scoringQueueApps.slice(0, 4).map((app) => {
                const savedScore = interviewScoreFor(app);
                const panelReviews = interviewScoresFor(app.id).length;
                return (
                  <article key={app.id} className="hr-score-queue-card">
                    <CandidateSummary app={app} jobs={jobs} detail={app.email || app.phone || "No contact on file"} />
                    <div>
                      <p className="eyebrow">Interview Time</p>
                      <strong>{formatDate(app.interview_scheduled_at)}</strong>
                    </div>
                    <div>
                      <p className="eyebrow">Score Status</p>
                      <strong>{savedScore === null ? "Not scored" : `${savedScore}/100`}</strong>
                      <p className="status-note">{panelReviews} panel review{panelReviews === 1 ? "" : "s"}</p>
                    </div>
                    <button className="premium-button" type="button" onClick={() => router.push("/hr/interviews")}>
                      Score Interview
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="status-note">No completed interviews are waiting for HR scoring.</p>
          )}
        </section>

        <section className="glass-card" style={cardStyle}>
          <div className="section-heading">
            <div>
              <h2>Interview Score Archive</h2>
              <p className="status-note">Past, upcoming, completed, and unscored interview sessions are kept on a dedicated review page.</p>
            </div>
            <button className="premium-button" onClick={() => router.push("/hr/interviews")}>
              Open Interview History
            </button>
          </div>
        </section>
          </>
        )}

        {activePanel === "hiring" && (
        <section className="glass-card hr-hiring-workspace" style={cardStyle}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Final Decision Desk</p>
              <h2>Hiring Approval</h2>
              <p className="status-note">Select an interview-passed candidate, review their status, and complete the hiring decision.</p>
            </div>
            <span className="status-pill">{passedInterviewApps.length} ready</span>
          </div>
          {passedInterviewApps.length && selectedHiringApp ? (
            <div className="hr-hiring-layout">
              <div className="hr-hiring-roster">
                <div className="hr-schedule-roster-heading">
                  <div>
                    <p className="eyebrow">Candidate Shortlist</p>
                    <strong>Passed interviews</strong>
                  </div>
                  <span>{passedInterviewApps.length}</span>
                </div>
                <div className="hr-hiring-candidate-list">
                  {passedInterviewApps.map((app) => {
                    const isSelected = selectedHiringId === app.id;
                    const savedScore = interviewScoreFor(app);
                    const recommendationState = app.pro_vc_approved
                      ? "PRO-VC approved"
                      : truthy(app.hr_report_sent)
                        ? "Recommended"
                        : "Awaiting decision";
                    return (
                      <button
                        key={app.id}
                        type="button"
                        className="hr-hiring-candidate"
                        data-active={isSelected}
                        onClick={() => setSelectedHiringId(app.id)}
                      >
                        <div className="hr-schedule-candidate-main">
                          <CandidateSummary app={app} jobs={jobs} detail={app.email || app.phone || "No contact on file"} />
                          <span className="hr-schedule-selection">{isSelected ? "Selected" : "Select"}</span>
                        </div>
                        <div className="hr-hiring-candidate-meta">
                          <span><small>Position</small><strong>{roleTitle(app, jobs)}</strong></span>
                          <span><small>Interview</small><strong>{savedScore === null ? "Passed · score pending" : `${savedScore}/100`}</strong></span>
                          <span><small>Decision</small><strong>{recommendationState}</strong></span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {(() => {
                const progress = onboardingProgress(selectedHiringApp.onboarding_status);
                const savedScore = interviewScoreFor(selectedHiringApp);
                const recommendation = interviewRecommendation(savedScore);
                return (
                  <div className="hr-hiring-decision">
                    <div className="hr-hiring-profile">
                      <CandidateSummary
                        app={selectedHiringApp}
                        jobs={jobs}
                        detail={selectedHiringApp.email || selectedHiringApp.phone || "No contact on file"}
                      />
                      <span className="status-pill">{selectedHiringApp.status}</span>
                    </div>

                    <div className="hr-hiring-summary">
                      <div>
                        <p className="eyebrow">Position</p>
                        <strong>{roleTitle(selectedHiringApp, jobs)}</strong>
                      </div>
                      <div>
                        <p className="eyebrow">Interview Score</p>
                        <strong>{savedScore === null ? "Not recorded" : `${savedScore}/100`}</strong>
                        <p className="status-note">{recommendation.label}</p>
                      </div>
                      <div>
                        <p className="eyebrow">Onboarding Stage</p>
                        <strong>{selectedHiringApp.onboarding_status || "Not started"}</strong>
                      </div>
                    </div>

                    <div className="hr-hiring-actions">
                      <button
                        className="secondary-button"
                        disabled={busyAction === `app-${selectedHiringApp.id}` || truthy(selectedHiringApp.hr_report_sent)}
                        onClick={() => handleRecommendForHire(selectedHiringApp)}
                      >
                        {truthy(selectedHiringApp.hr_report_sent) ? "Recommended for Hire" : "Recommend for Hire"}
                      </button>
                      <button
                        disabled={busyAction === `app-${selectedHiringApp.id}`}
                        onClick={() => handleHiring(selectedHiringApp)}
                        className="premium-button"
                      >
                        {busyAction === `app-${selectedHiringApp.id}` ? "Processing..." : "Approve Candidate"}
                      </button>
                    </div>

                    <details className="hr-offer-generator" open={selectedHiringApp.offer_status === "Generated"}>
                      <summary>Offer letter generator</summary>
                      <div className="hr-offer-grid">
                        <label className="control-label">
                          Salary and currency
                          <input className="input-field" value={offerForm.salary} onChange={(event) => setOfferForm({ ...offerForm, salary: event.target.value })} placeholder="Example: GHS 6,500 per month" />
                        </label>
                        <label className="control-label">
                          Start date
                          <input className="input-field" type="date" value={offerForm.startDate} onChange={(event) => setOfferForm({ ...offerForm, startDate: event.target.value })} />
                        </label>
                        <label className="control-label">
                          Probation period
                          <input className="input-field" value={offerForm.probation} onChange={(event) => setOfferForm({ ...offerForm, probation: event.target.value })} />
                        </label>
                        <label className="control-label">
                          Reporting officer
                          <input className="input-field" value={offerForm.reportingOfficer} onChange={(event) => setOfferForm({ ...offerForm, reportingOfficer: event.target.value })} />
                        </label>
                        <label className="control-label">
                          Response deadline
                          <input className="input-field" type="date" value={offerForm.responseDeadline} onChange={(event) => setOfferForm({ ...offerForm, responseDeadline: event.target.value })} />
                        </label>
                        <label className="control-label hr-offer-terms">
                          Additional terms
                          <textarea className="input-field" rows={3} value={offerForm.additionalTerms} onChange={(event) => setOfferForm({ ...offerForm, additionalTerms: event.target.value })} placeholder="Optional appointment terms or reporting instructions" />
                        </label>
                      </div>
                      <div className="hr-hiring-actions">
                        <button className="premium-button" disabled={busyAction === `offer-${selectedHiringApp.id}` || !offerForm.startDate} onClick={() => generateOfferLetter(selectedHiringApp)}>
                          {busyAction === `offer-${selectedHiringApp.id}` ? "Generating..." : "Generate and Save Offer"}
                        </button>
                        {selectedHiringApp.offer_details && (
                          <button className="secondary-button" onClick={() => printOfferLetter(selectedHiringApp)}>
                            Open Printable Offer
                          </button>
                        )}
                      </div>
                    </details>

                    <div className="hr-onboarding-stage-panel">
                      <div>
                        <p className="eyebrow">Onboarding Progress</p>
                        <strong>Update the candidate's current stage</strong>
                      </div>
                      <div className="hr-onboarding-stage-grid">
                        {onboardingSteps.map((step, index) => (
                          <button
                            key={step}
                            type="button"
                            className="hr-onboarding-stage"
                            data-complete={index <= progress}
                            data-current={index === progress}
                            onClick={() => handleOnboardingStep(selectedHiringApp, step)}
                            disabled={busyAction === `app-${selectedHiringApp.id}`}
                          >
                            <span>{index + 1}</span>
                            <strong>{step}</strong>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>No candidates have passed the interview stage yet.</p>
          )}
        </section>
        )}

        {activePanel === "talent" && (
          <section className="glass-card ops-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Future Recruitment</p>
                <h2>Consent-Based Talent Pool</h2>
                <p className="status-note">Candidates shown here have permitted Pentecost University to retain and reuse their profile for suitable vacancies.</p>
              </div>
              <input className="input-field" value={talentSearch} onChange={(event) => setTalentSearch(event.target.value)} placeholder="Search candidate, role, or status" style={{ width: "min(340px, 100%)" }} />
            </div>
            <div className="admin-application-list">
              {filteredTalentPool.map((app) => (
                <article key={app.id} className="admin-application-card">
                  <div className="application-profile">
                    <Avatar name={candidateName(app)} src={candidatePhotoUrl(app)} />
                    <div>
                      <p className="eyebrow">Talent Profile</p>
                      <h3>{candidateName(app)}</h3>
                      <p className="status-note">{app.email || app.phone || "No contact on file"}</p>
                    </div>
                  </div>
                  <div className="application-intelligence">
                    <div className="insight-card"><p className="eyebrow">Previous Role</p><strong>{roleTitle(app, jobs)}</strong></div>
                    <div className="insight-card"><p className="eyebrow">CV Match</p><strong>{Math.round(Number(app.similarity || 0) * 100)}%</strong></div>
                    <div className="insight-card"><p className="eyebrow">Retention</p><strong>{app.retention_until ? new Date(app.retention_until).toLocaleDateString() : "Not set"}</strong></div>
                  </div>
                  <div className="application-operations">
                    {app.email && <button className="premium-button" onClick={() => router.push(`/hr/talent/${app.id}`)}>Contact Candidate</button>}
                    <button className="secondary-button" disabled={busyAction === `talent-${app.id}`} onClick={() => updateTalentPool(app, false)}>Remove from Pool</button>
                  </div>
                </article>
              ))}
            </div>
            {!filteredTalentPool.length && <p className="status-note">No consented candidates match this search.</p>}
          </section>
        )}

        {activePanel === "onboarding" && (
          <section className="glass-card ops-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Onboarding Workspace</p>
                <h2>New Staff Progress</h2>
                <p className="status-note">Open each candidate's dedicated workspace to manage documents, references, orientation, and staff ID assignment.</p>
              </div>
            </div>

            <div className="admin-application-list">
              {onboardingApps.map((app) => {
                const progress = onboardingProgress(app.onboarding_status);
                const currentStep = app.onboarding_status || "Offer Letter Sent";
                const documents = parseOnboardingDocuments(app.onboarding_documents);
                const requiredDocuments = app.onboarding_required_documents || [];
                const approvedDocuments = documents.filter((document) => document.status === "approved").length;
                return (
                  <article key={app.id} className="admin-application-card">
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
                        <p className="eyebrow">Position</p>
                        <strong>{roleTitle(app, jobs)}</strong>
                      </div>
                      <div className="insight-card">
                        <p className="eyebrow">Recorded Stage</p>
                        <strong>{app.onboarding_status || "Not started"}</strong>
                        <p className="status-note">{Math.max(0, progress + 1)} of {onboardingSteps.length} stages recorded</p>
                      </div>
                      <div className="insight-card">
                        <p className="eyebrow">Staff ID</p>
                        <strong>{app.staff_id || "Not assigned"}</strong>
                      </div>
                      <div className="insight-card">
                        <p className="eyebrow">Documents</p>
                        <strong>{documents.length} uploaded</strong>
                        <p className="status-note">
                          {approvedDocuments} approved
                          {requiredDocuments.length ? ` · ${requiredDocuments.length} required` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="application-operations">
                      <button
                        className="premium-button"
                        onClick={() => router.push(onboardingStepHref(app.id, currentStep))}
                      >
                        Open Onboarding Workspace
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => router.push(onboardingStepHref(app.id, "Documents Verified"))}
                      >
                        View All Documents
                      </button>
                      {!app.onboarding_status && (
                        <button
                          className="secondary-button"
                          disabled={busyAction === `app-${app.id}`}
                          onClick={() => handleOnboardingStep(app, "Offer Letter Sent")}
                        >
                          Start Onboarding
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {!onboardingApps.length && (
              <p className="status-note">No interview-passed candidates are ready for onboarding yet.</p>
            )}
          </section>
        )}

        {activePanel === "history" && (
          <section className="glass-card ops-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Application Archive</p>
                <h2>Rejected CV History</h2>
                <p className="status-note">Rejected applications are kept here for audit and no longer appear in active screening.</p>
              </div>
            </div>
            <div className="admin-application-list">
              {rejectedApps.map((app) => (
                <article key={app.id} className="admin-application-card">
                  <div className="application-profile">
                    <Avatar name={candidateName(app)} src={candidatePhotoUrl(app)} />
                    <div>
                      <p className="eyebrow">Rejected Candidate</p>
                      <h3>{candidateName(app)}</h3>
                      <p className="status-note">{app.email || app.phone || "No contact on file"}</p>
                      <span className="status-pill">{app.status}</span>
                    </div>
                  </div>
                  <div className="application-intelligence">
                    <div className="insight-card">
                      <p className="eyebrow">Position</p>
                      <strong>{roleTitle(app, jobs)}</strong>
                    </div>
                    <div className="insight-card">
                      <p className="eyebrow">CV Match</p>
                      <strong>{Math.round(Number(app.similarity || 0) * 100)}%</strong>
                      <p className="status-note">Cutoff: {cvPassThreshold}%</p>
                    </div>
                    <div className="insight-card">
                      <p className="eyebrow">Submitted</p>
                      <strong>{formatDate(app.submitted_at)}</strong>
                    </div>
                  </div>
                  <div className="application-operations">
                    <button
                      className="secondary-button"
                      disabled={busyAction === `app-${app.id}`}
                      onClick={() => restoreRejectedCv(app)}
                    >
                      Return to Screening
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!rejectedApps.length && <p className="status-note">No rejected CVs have been archived.</p>}
          </section>
        )}

        {activePanel === "recommendations" && (
          <section className="glass-card ops-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">AI-Assisted Shortlist</p>
                <h2>Best Three Applicants by Position</h2>
                <p className="status-note">Active applicants are ranked by CV requirement match. HR remains responsible for the final decision.</p>
              </div>
              <span className="status-pill">{bestApplicationsByRole.length} positions</span>
            </div>
            {bestApplicationsByRole.length ? (
              <div className="best-three-grid">
                {bestApplicationsByRole.map(({ job, applicants }) => (
                  <article key={job.id} className="best-three-card">
                    <div className="best-three-header">
                      <div>
                        <p className="eyebrow">Position</p>
                        <h3>{job.title}</h3>
                        <p className="status-note">{applicants.length === 3 ? "Top three active candidates" : `${applicants.length} active candidate${applicants.length === 1 ? "" : "s"} available`}</p>
                      </div>
                      <span>{applicants.length}/3</span>
                    </div>
                    <div className="best-three-list">
                      {applicants.map((app, index) => {
                        const decision = getMatchDecision(Number(app.similarity || 0));
                        const matchPercent = Math.max(0, Math.min(100, Math.round(Number(app.similarity || 0) * 100)));
                        return (
                          <div key={app.id} className="best-three-row">
                            <div className="best-rank">{index + 1}</div>
                            <div className="best-three-candidate">
                              <CandidateSummary app={app} jobs={jobs} detail={app.email || app.phone || "No contact on file"} />
                              <span className="best-three-email">{app.email || "No email on file"}</span>
                              <p className="status-note">{app.status}</p>
                            </div>
                            <div className="best-three-actions">
                              <div className="ai-score-circle compact" style={{ "--score": `${matchPercent}%` } as React.CSSProperties} aria-label={`${candidateName(app)} CV match score ${matchPercent}%`}>
                                <span>{matchPercent}%</span>
                              </div>
                              <span style={{ ...getMatchStyle(decision.tone), padding: "6px 10px", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 850 }}>
                                {decision.label}
                              </span>
                              <select
                                className="input-field"
                                defaultValue=""
                                onChange={async (event) => {
                                  const action = event.target.value;
                                  if (!action) return;
                                  await handleBestThreeAction(app, action);
                                  event.target.value = "";
                                }}
                                disabled={busyAction === `app-${app.id}`}
                                aria-label={`Select HR action for ${candidateName(app)}`}
                              >
                                <option value="">Select HR action...</option>
                                <option value="approve-cv">Approve CV</option>
                                <option value="recommend-interview">Recommend interview</option>
                                <option value="reject-cv">Reject CV</option>
                                <option value="pass-interview">Pass interview</option>
                                <option value="not-pass-interview">Reject after interview</option>
                                <option value="recommend-hire">Recommend for hire</option>
                                <option value="approve-hire">Approve candidate</option>
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
              <p className="status-note">No active applications are available for ranking.</p>
            )}
          </section>
        )}

        {activePanel === "metrics" && (
          <section className="hr-metrics-workspace">
            <div className="glass-card ops-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Recruitment Metrics</p>
                  <h2>Hiring Funnel</h2>
                  <p className="status-note">Live measurements calculated from the current application records.</p>
                </div>
              </div>
              <div className="metric-grid">
                {[
                  ["CV pass rate", apps.length ? `${Math.round((cvPassedApps.length / apps.length) * 100)}%` : "0%"],
                  ["Interview scheduling rate", cvPassedApps.length ? `${Math.round((scheduledApps.length / cvPassedApps.length) * 100)}%` : "0%"],
                  ["Interview pass rate", scheduledApps.length ? `${Math.round((passedInterviewApps.length / scheduledApps.length) * 100)}%` : "0%"],
                  ["Awaiting review", pendingReviewApps.length],
                  ["Upcoming interviews", upcomingInterviewApps.length],
                  ["Completed interviews", scheduledApps.filter((app) => new Date(app.interview_scheduled_at || "").getTime() <= Date.now()).length],
                  ["Deletion requests", apps.filter((app) => Boolean(app.data_deletion_requested_at)).length],
                  ["Talent pool profiles", talentPoolApps.length],
                ].map(([label, value]) => (
                  <div key={label} className="glass-card metric-card">
                    <p>{label}</p>
                    <h2>{value}</h2>
                  </div>
                ))}
              </div>
              <button className="secondary-button" onClick={() => router.push("/hr/interviews")}>
                Review Interview Scores
              </button>
              <button className="secondary-button" onClick={downloadFunnelReport}>
                Download Funnel Metrics CSV
              </button>
              {apps.some((app) => app.data_deletion_requested_at) && (
                <div className="onboarding-callout">
                  <strong>Applicant privacy requests</strong>
                  <p className="status-note">Review these records before deletion or anonymisation. Preserve information that must be retained for an active legal or employment process.</p>
                  <div className="privacy-request-list">
                    {apps.filter((app) => app.data_deletion_requested_at).map((app) => (
                      <div key={app.id}>
                        <span>{candidateName(app)} · {app.email || "No email"}</span>
                        <strong>{new Date(app.data_deletion_requested_at || "").toLocaleDateString()}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="onboarding-callout">
                <strong>CV pass threshold</strong>
                <p className="status-note">Applicants at or above this CV match percentage appear as passing the automatic HR screening cutoff.</p>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    className="input-field"
                    type="number"
                    min="0"
                    max="100"
                    value={thresholdDraft}
                    onChange={(event) => setThresholdDraft(event.target.value)}
                    style={{ width: "130px" }}
                  />
                  <span style={{ fontWeight: 800 }}>%</span>
                  <button className="premium-button" type="button" disabled={busyAction === "cv-threshold"} onClick={saveCvPassThreshold}>
                    {busyAction === "cv-threshold" ? "Saving..." : "Save Threshold"}
                  </button>
                </div>
              </div>
            </div>

            <div className="glass-card ops-section">
              <p className="eyebrow">Portal Email</p>
              <h2 style={{ marginBottom: "8px" }}>Send Recruitment Email</h2>
              <p className="status-note" style={{ marginBottom: "16px" }}>Send a direct message to an applicant, stakeholder, or staff email address.</p>
              <form onSubmit={handlePortalEmail} style={{ display: "grid", gap: "12px" }}>
                <input className="input-field" type="email" placeholder="Recipient email" value={portalEmail.to} onChange={(event) => setPortalEmail({ ...portalEmail, to: event.target.value })} required />
                <input className="input-field" placeholder="Email subject" value={portalEmail.subject} onChange={(event) => setPortalEmail({ ...portalEmail, subject: event.target.value })} required />
                <textarea className="input-field" rows={8} placeholder="Write the email message" value={portalEmail.message} onChange={(event) => setPortalEmail({ ...portalEmail, message: event.target.value })} required />
                <button className="premium-button" disabled={busyAction === "portal-email"}>
                  {busyAction === "portal-email" ? "Sending..." : "Send Email"}
                </button>
              </form>
            </div>
          </section>
        )}

        {activePanel === "screening" && (
        <section className="glass-card" style={cardStyle}>
          <div className="section-heading">
            <div>
              <h2>Application Screening</h2>
              <p className="status-note">{filteredApps.length} of {screeningApps.length} active applications shown</p>
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
                Download CSV Report
              </button>
            </div>
          </div>
          <div className="hr-screening-list">
            {filteredApps.map((app) => {
              const decision = getMatchDecision(Number(app.similarity || 0));
              const interviewScore = interviewScoreFor(app);
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
                      {!passedCv(app, cvPassThreshold) && (
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
                      {passedCv(app, cvPassThreshold) && (
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
        </div>
      </div>
    </main>
  );
}

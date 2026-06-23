"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { loadJobs, type Job } from "@/utils/jobs";
import { getRoleHome, getUserRole } from "@/utils/roles";
import { parseOnboardingDocuments } from "@/utils/onboarding";
import UniversityBrand from "@/components/UniversityBrand";
import UserBadge from "@/components/UserBadge";

type Application = {
  id: string | number;
  job_id: string | number;
  name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  status: string;
  submitted_at?: string | null;
  interview_scheduled_at?: string | null;
  interview_passed?: boolean | string | null;
  offer_status?: string | null;
  offer_generated_at?: string | null;
  onboarding_status?: string | null;
  onboarding_documents?: unknown;
  onboarding_required_documents?: string[] | null;
};

type EmailTemplate = {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  is_active: boolean;
  updated_at: string;
};

type ReferenceRequest = {
  id: string;
  application_id: string;
  referee_name: string;
  referee_email: string;
  relationship?: string | null;
  status: string;
  due_at?: string | null;
  sent_at?: string | null;
  completed_at?: string | null;
  reminders_sent: number;
  response?: Record<string, unknown>;
};

type ReminderDelivery = {
  id: number;
  reminder_type: string;
  recipient: string;
  application_id?: string | null;
  sent_at: string;
};

type ActivityLog = {
  id: number;
  actor_email?: string | null;
  actor_role?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

type OperationsTab = "alerts" | "references" | "templates" | "reminders" | "audit";

const blankTemplate = {
  id: "",
  name: "",
  category: "general",
  subject: "",
  body: "",
  isActive: true,
};

function candidateName(app?: Application | null) {
  return app?.name || app?.full_name || "Applicant";
}

export default function HrOperationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [references, setReferences] = useState<ReferenceRequest[]>([]);
  const [reminders, setReminders] = useState<ReminderDelivery[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [activeTab, setActiveTab] = useState<OperationsTab>("alerts");
  const [referenceForm, setReferenceForm] = useState({ applicationId: "", refereeName: "", refereeEmail: "", relationship: "", dueAt: "" });
  const [templateForm, setTemplateForm] = useState(blankTemplate);
  const [auditApplicationId, setAuditApplicationId] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const router = useRouter();

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function loadData() {
    const authToken = await token();
    const [applications, loadedJobs, operationsResponse] = await Promise.all([
      supabase.from("applications").select("*").order("submitted_at", { ascending: false }),
      loadJobs(supabase),
      fetch("/api/hr/operations", { headers: { Authorization: `Bearer ${authToken}` } }).catch(() => null),
    ]);
    if (applications.error) setMessage(applications.error.message);
    setApps((applications.data || []) as Application[]);
    setJobs(loadedJobs);
    if (operationsResponse?.ok) {
      const data = await operationsResponse.json();
      setTemplates(data.templates || []);
      setReferences(data.references || []);
      setReminders(data.reminders || []);
      setLogs(data.logs || []);
      setSetupRequired(Boolean(data.setupRequired));
    } else {
      const data = operationsResponse ? await operationsResponse.json().catch(() => ({})) : {};
      setMessage(data.error || "Operations data could not be loaded.");
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
      if (!["hr", "admin"].includes(role)) {
        router.replace(getRoleHome(role));
        return;
      }
      setCurrentUser(user);
      await loadData();
    };
    init();
  }, [router]);

  function roleTitle(app: Application) {
    return jobs.find((job) => String(job.id) === String(app.job_id))?.title || `Position ${app.job_id}`;
  }

  const alerts = useMemo(() => {
    const now = Date.now();
    const output: Array<{ level: "high" | "medium" | "info"; title: string; detail: string; applicationId?: string }> = [];
    apps.forEach((app) => {
      const status = String(app.status || "").toLowerCase();
      const submitted = app.submitted_at ? new Date(app.submitted_at).getTime() : now;
      if (now - submitted > 5 * 86400000 && !/(passed|rejected|not passed|interview|offer|onboard|withdrawn)/.test(status)) {
        output.push({ level: "high", title: "Overdue CV review", detail: `${candidateName(app)} · ${roleTitle(app)} · submitted over five days ago`, applicationId: String(app.id) });
      }
      if (app.interview_scheduled_at) {
        const interview = new Date(app.interview_scheduled_at).getTime();
        if (interview > now && interview - now <= 24 * 3600000) {
          output.push({ level: "medium", title: "Interview within 24 hours", detail: `${candidateName(app)} · ${new Date(interview).toLocaleString()}`, applicationId: String(app.id) });
        }
      }
      if (app.offer_status === "Generated" && app.offer_generated_at && now - new Date(app.offer_generated_at).getTime() > 3 * 86400000) {
        output.push({ level: "high", title: "Offer awaiting response", detail: `${candidateName(app)} has not responded after three days`, applicationId: String(app.id) });
      }
      if (app.onboarding_status) {
        const required = app.onboarding_required_documents || [];
        const uploaded = parseOnboardingDocuments(app.onboarding_documents);
        const missing = required.filter((label) => !uploaded.some((document) => document.label === label && document.status === "approved"));
        if (missing.length) output.push({ level: "medium", title: "Onboarding documents outstanding", detail: `${candidateName(app)} · ${missing.length} document${missing.length === 1 ? "" : "s"} pending`, applicationId: String(app.id) });
      }
    });
    references.forEach((reference) => {
      if (reference.status === "Pending" && reference.due_at && new Date(reference.due_at).getTime() < now) {
        const app = apps.find((item) => String(item.id) === String(reference.application_id));
        output.push({ level: "high", title: "Reference overdue", detail: `${reference.referee_name} · ${candidateName(app)}`, applicationId: reference.application_id });
      }
    });
    return output;
  }, [apps, jobs, references]);

  async function operationsAction(body: Record<string, unknown>) {
    const response = await fetch("/api/hr/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Operation failed.");
    return data;
  }

  async function sendReference(event: React.FormEvent) {
    event.preventDefault();
    setBusy("reference");
    setMessage("");
    try {
      await operationsAction({ action: "send-reference", ...referenceForm });
      setReferenceForm({ applicationId: "", refereeName: "", refereeEmail: "", relationship: "", dueAt: "" });
      setMessage("Reference request sent successfully.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy("");
    }
  }

  async function saveTemplate(event: React.FormEvent) {
    event.preventDefault();
    setBusy("template");
    try {
      await operationsAction({ action: "save-template", ...templateForm });
      setTemplateForm(blankTemplate);
      setMessage("Email template saved.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy("");
    }
  }

  async function deleteTemplate(id: string) {
    if (!window.confirm("Delete this email template?")) return;
    setBusy(`template-${id}`);
    try {
      await operationsAction({ action: "delete-template", id });
      setMessage("Email template deleted.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy("");
    }
  }

  async function runReminders() {
    setBusy("reminders");
    setMessage("");
    const response = await fetch("/api/reminders/run", {
      method: "POST",
      headers: { Authorization: `Bearer ${await token()}` },
    }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) : {};
    setBusy("");
    if (!response?.ok) {
      setMessage(data.error || "Reminder run failed.");
      return;
    }
    setMessage(`Reminder run completed: ${data.sent} sent, ${data.skipped} skipped.`);
    await loadData();
  }

  const auditLogs = useMemo(
    () => auditApplicationId ? logs.filter((log) => String(log.entity_id) === auditApplicationId) : logs,
    [auditApplicationId, logs]
  );

  function downloadAuditCsv() {
    const cell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const selectedApp = apps.find((app) => String(app.id) === auditApplicationId);
    const rows = [
      ["Timestamp", "Candidate", "Position", "Actor", "Role", "Action", "Description"],
      ...auditLogs.map((log) => [
        new Date(log.created_at).toLocaleString(),
        selectedApp ? candidateName(selectedApp) : "",
        selectedApp ? roleTitle(selectedApp) : "",
        log.actor_email || "System",
        log.actor_role || "",
        log.action,
        log.description,
      ]),
    ];
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF", rows.map((row) => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    link.download = `recruitment_audit_${auditApplicationId || "all"}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const tabs: Array<{ id: OperationsTab; label: string; count: number }> = [
    { id: "alerts", label: "Alerts", count: alerts.length },
    { id: "references", label: "References", count: references.filter((item) => item.status === "Pending").length },
    { id: "templates", label: "Email Templates", count: templates.length },
    { id: "reminders", label: "Reminders", count: reminders.length },
    { id: "audit", label: "Audit Reports", count: logs.length },
  ];

  if (loading) return <main className="app-shell"><p>Loading HR operations...</p></main>;

  return (
    <main className="app-shell">
      <div className="page-container">
        <header className="app-topbar">
          <div className="dashboard-brand-title">
            <UniversityBrand />
            <div>
              <p className="eyebrow">Human Resources</p>
              <h1 className="page-title">Recruitment Operations Center</h1>
              <p className="page-subtitle">References, reminders, templates, alerts, and auditable recruitment records.</p>
            </div>
          </div>
          <div className="topbar-actions">
            <UserBadge user={currentUser} label="HR account" onUserUpdated={setCurrentUser} />
            <button className="secondary-button" onClick={() => router.push(getUserRole(currentUser) === "admin" ? "/admin" : "/hr")}>Dashboard</button>
          </div>
        </header>

        {message && <div className="glass-card onboarding-message" role="status">{message}</div>}
        {setupRequired && <div className="glass-card onboarding-message">Run <strong>frontend/supabase/recruitment-operations.sql</strong> in Supabase, then refresh this page.</div>}

        <nav className="operations-tabs" aria-label="Recruitment operations">
          {tabs.map((tab) => (
            <button key={tab.id} data-active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
              <span>{tab.label}</span><strong>{tab.count}</strong>
            </button>
          ))}
        </nav>

        {activeTab === "alerts" && (
          <section className="glass-card ops-section">
            <div className="section-heading"><div><p className="eyebrow">Action Required</p><h2>Recruitment Alerts</h2><p className="status-note">Live alerts calculated from application and reference records.</p></div></div>
            <div className="operations-alert-list">
              {alerts.map((alert, index) => (
                <article key={`${alert.title}-${index}`} data-level={alert.level}>
                  <span />
                  <div><strong>{alert.title}</strong><p>{alert.detail}</p></div>
                </article>
              ))}
              {!alerts.length && <p className="status-note">No urgent recruitment alerts.</p>}
            </div>
          </section>
        )}

        {activeTab === "references" && (
          <div className="operations-two-column">
            <form className="glass-card ops-section" onSubmit={sendReference}>
              <p className="eyebrow">New Request</p><h2>Request a Reference</h2>
              <label className="control-label">Candidate
                <select className="input-field" value={referenceForm.applicationId} onChange={(event) => setReferenceForm({ ...referenceForm, applicationId: event.target.value })} required>
                  <option value="">Select applicant</option>
                  {apps.map((app) => <option key={app.id} value={app.id}>{candidateName(app)} · {roleTitle(app)}</option>)}
                </select>
              </label>
              <label className="control-label">Referee name<input className="input-field" value={referenceForm.refereeName} onChange={(event) => setReferenceForm({ ...referenceForm, refereeName: event.target.value })} required /></label>
              <label className="control-label">Referee email<input className="input-field" type="email" value={referenceForm.refereeEmail} onChange={(event) => setReferenceForm({ ...referenceForm, refereeEmail: event.target.value })} required /></label>
              <label className="control-label">Relationship<input className="input-field" value={referenceForm.relationship} onChange={(event) => setReferenceForm({ ...referenceForm, relationship: event.target.value })} placeholder="Former supervisor, lecturer..." /></label>
              <label className="control-label">Due date<input className="input-field" type="date" value={referenceForm.dueAt} onChange={(event) => setReferenceForm({ ...referenceForm, dueAt: event.target.value })} /></label>
              <button className="premium-button" disabled={busy === "reference"}>{busy === "reference" ? "Sending..." : "Send Secure Reference Request"}</button>
            </form>
            <section className="glass-card ops-section">
              <p className="eyebrow">Tracking</p><h2>Reference Requests</h2>
              <div className="reference-request-list">
                {references.map((reference) => {
                  const app = apps.find((item) => String(item.id) === String(reference.application_id));
                  return (
                    <details key={reference.id}>
                      <summary><span><strong>{candidateName(app)}</strong><small>{reference.referee_name} · {reference.referee_email}</small></span><em data-status={reference.status}>{reference.status}</em></summary>
                      <div>
                        <p>Relationship: {reference.relationship || "Not specified"}</p>
                        <p>Due: {reference.due_at ? new Date(reference.due_at).toLocaleString() : "Not set"}</p>
                        <p>Reminders sent: {reference.reminders_sent}</p>
                        {reference.status === "Completed" && reference.response && (
                          <div className="reference-response-summary">
                            <strong>Submitted response</strong>
                            {Object.entries(reference.response).map(([key, value]) => <p key={key}><span>{key.replace(/_/g, " ")}</span><b>{String(value)}</b></p>)}
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}
                {!references.length && <p className="status-note">No reference requests yet.</p>}
              </div>
            </section>
          </div>
        )}

        {activeTab === "templates" && (
          <div className="operations-two-column">
            <form className="glass-card ops-section" onSubmit={saveTemplate}>
              <p className="eyebrow">{templateForm.id ? "Edit Template" : "New Template"}</p><h2>Email Template</h2>
              <label className="control-label">Template name<input className="input-field" value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} required /></label>
              <label className="control-label">Category<select className="input-field" value={templateForm.category} onChange={(event) => setTemplateForm({ ...templateForm, category: event.target.value })}>{["general","reference","interview","rejection","offer","reminder","onboarding"].map((category) => <option key={category}>{category}</option>)}</select></label>
              <label className="control-label">Subject<input className="input-field" value={templateForm.subject} onChange={(event) => setTemplateForm({ ...templateForm, subject: event.target.value })} required /></label>
              <label className="control-label">Message<textarea className="input-field" rows={10} value={templateForm.body} onChange={(event) => setTemplateForm({ ...templateForm, body: event.target.value })} required /></label>
              <p className="status-note">Available placeholders include: {"{{candidate_name}}"}, {"{{job_title}}"}, {"{{interview_time}}"}, {"{{meeting_link}}"}, {"{{referee_name}}"}, {"{{reference_link}}"}.</p>
              <div className="operations-form-actions"><button className="premium-button" disabled={busy === "template"}>{busy === "template" ? "Saving..." : "Save Template"}</button>{templateForm.id && <button type="button" className="secondary-button" onClick={() => setTemplateForm(blankTemplate)}>Cancel</button>}</div>
            </form>
            <section className="glass-card ops-section">
              <p className="eyebrow">Library</p><h2>Saved Templates</h2>
              <div className="email-template-list">
                {templates.map((template) => (
                  <article key={template.id}>
                    <div><span className="status-pill">{template.category}</span><h3>{template.name}</h3><p>{template.subject}</p></div>
                    <div><button className="secondary-button" onClick={() => setTemplateForm({ id: template.id, name: template.name, category: template.category, subject: template.subject, body: template.body, isActive: template.is_active })}>Edit</button><button className="danger-button" disabled={busy === `template-${template.id}`} onClick={() => deleteTemplate(template.id)}>Delete</button></div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === "reminders" && (
          <section className="glass-card ops-section">
            <div className="section-heading"><div><p className="eyebrow">Automation</p><h2>Reminder Delivery</h2><p className="status-note">Hourly automation covers interviews approximately 24 hours away and references due within 48 hours.</p></div><button className="premium-button" onClick={runReminders} disabled={busy === "reminders"}>{busy === "reminders" ? "Running..." : "Run Reminders Now"}</button></div>
            <div className="reminder-history-list">
              {reminders.map((reminder) => <article key={reminder.id}><span className="status-pill">{reminder.reminder_type}</span><div><strong>{reminder.recipient}</strong><p className="status-note">Application {reminder.application_id || "N/A"}</p></div><time>{new Date(reminder.sent_at).toLocaleString()}</time></article>)}
              {!reminders.length && <p className="status-note">No reminder deliveries recorded.</p>}
            </div>
          </section>
        )}

        {activeTab === "audit" && (
          <section className="glass-card ops-section">
            <div className="section-heading"><div><p className="eyebrow">Accountability</p><h2>Application Audit Report</h2><p className="status-note">Review who changed, scored, contacted, or progressed an application.</p></div><button className="premium-button" onClick={downloadAuditCsv}>Download CSV</button></div>
            <select className="input-field audit-application-select" value={auditApplicationId} onChange={(event) => setAuditApplicationId(event.target.value)}>
              <option value="">All application activity</option>
              {apps.map((app) => <option key={app.id} value={app.id}>{candidateName(app)} · {roleTitle(app)}</option>)}
            </select>
            <div className="activity-log-list">
              {auditLogs.map((log) => <article className="activity-log-row" key={log.id}><span className="activity-log-marker" /><div><strong>{log.action.replace(/_/g, " ")}</strong><p>{log.description}</p></div><div><span>{log.actor_email || "System"}</span><small>{log.actor_role || "system"}</small></div><time>{new Date(log.created_at).toLocaleString()}</time></article>)}
              {!auditLogs.length && <p className="status-note">No matching audit activity.</p>}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

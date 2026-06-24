"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { getJobById } from "@/utils/jobs";
import {
  defaultOnboardingDocuments,
  generateStaffId,
  onboardingStepByName,
  onboardingStepBySlug,
  onboardingStepDetails,
  onboardingStepHref,
  parseOnboardingDocuments,
  type OnboardingDocument,
} from "@/utils/onboarding";
import UniversityBrand from "@/components/UniversityBrand";
import { validateRecruitmentFile } from "@/utils/application-lifecycle";
import { onboardingEmailForStep } from "@/utils/recruitment-insights";

type OnboardingApplication = {
  id: string | number;
  job_id: number;
  name?: string;
  full_name?: string;
  email?: string;
  status?: string;
  onboarding_status?: string | null;
  onboarding_required_documents?: string[] | null;
  onboarding_documents?: OnboardingDocument[] | string | null;
  onboarding_hr_notes?: string | null;
  orientation_details?: string | null;
  staff_id?: string | null;
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
};

function escapeHtml(value?: string | number | null) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
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

export default function OnboardingStepPage() {
  const params = useParams<{ applicationId: string; step: string }>();
  const router = useRouter();
  const [application, setApplication] = useState<OnboardingApplication | null>(null);
  const [role, setRole] = useState<"user" | "hr" | "admin">("user");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(defaultOnboardingDocuments[0]);
  const [file, setFile] = useState<File | null>(null);
  const [hrNotes, setHrNotes] = useState("");
  const [orientationDetails, setOrientationDetails] = useState("");
  const [staffId, setStaffId] = useState("");
  const [requiredDocumentSelection, setRequiredDocumentSelection] = useState<string[]>(defaultOnboardingDocuments);

  const pageStep = onboardingStepBySlug(params.step);
  const documents = useMemo(
    () => parseOnboardingDocuments(application?.onboarding_documents),
    [application?.onboarding_documents]
  );
  const requiredDocuments = application?.onboarding_required_documents?.length
    ? application.onboarding_required_documents
    : defaultOnboardingDocuments;
  const currentIndex = onboardingStepDetails.findIndex((step) => step.name === application?.onboarding_status);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function onboardingRequest(method: "GET" | "PATCH" | "POST", body?: Record<string, unknown>) {
    const authToken = await token();
    const response = await fetch(`/api/onboarding/${params.applicationId}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: method === "GET" ? undefined : JSON.stringify(body || {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Onboarding request failed.");
    return data;
  }

  async function loadRecord() {
    try {
      const data = await onboardingRequest("GET");
      setApplication(data.application);
      setRole(data.role);
      setHrNotes(data.application.onboarding_hr_notes || "");
      setOrientationDetails(data.application.orientation_details || "");
      setStaffId(data.application.staff_id || generateStaffId(params.applicationId));
      setRequiredDocumentSelection(
        data.application.onboarding_required_documents?.length
          ? data.application.onboarding_required_documents
          : defaultOnboardingDocuments
      );
    } catch (error: any) {
      setMessage(error.message || "Onboarding record could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecord();
  }, [params.applicationId]);

  async function updateRecord(updates: Record<string, unknown>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      const data = await onboardingRequest("PATCH", updates);
      setApplication(data.application);
      setMessage(success);
    } catch (error: any) {
      setMessage(error.message || "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function sendCompletionEmail(updatedApplication: OnboardingApplication) {
    if (!updatedApplication.email) return false;
    const staffIdValue = updatedApplication.staff_id || staffId || generateStaffId(params.applicationId);
    const email = onboardingEmailForStep("Completed", applicantName, roleName, {
      staffId: staffIdValue,
      orientationDetails: updatedApplication.orientation_details,
      portalUrl: `${window.location.origin}${onboardingStepHref(updatedApplication.id, "Completed")}`,
    });
    if (!email) return false;

    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: updatedApplication.email,
        subject: email.subject,
        html: email.html,
      }),
    });

    return response.ok;
  }

  async function saveHrUpdate() {
    if (!application) return;
    const nextStaffId = pageStep.slug === "completed" || pageStep.slug === "staff-account"
      ? staffId
      : application.staff_id;

    setBusy(true);
    setMessage("");
    try {
      const data = await onboardingRequest("PATCH", {
        onboarding_status: pageStep.name,
        onboarding_hr_notes: hrNotes,
        orientation_details: orientationDetails,
        staff_id: nextStaffId,
        status: pageStep.slug === "completed" ? "Hired / Onboarded" : "Awaiting Onboarding",
      });
      setApplication(data.application);

      if (pageStep.slug === "completed") {
        const emailSent = await sendCompletionEmail(data.application);
        setMessage(
          data.application.email
            ? emailSent
              ? "Onboarding completed. Final staff details were sent to the applicant by email and are available in the portal."
              : "Onboarding completed, but the final staff details email could not be sent."
            : "Onboarding completed, but the applicant has no email address on file."
        );
      } else {
        setMessage(`${pageStep.title} saved.`);
      }
    } catch (error: any) {
      setMessage(error.message || "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadDocument(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !application) {
      setMessage("Choose the document type and a file to upload.");
      return;
    }
    const validationError = validateRecruitmentFile(file, "document");
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const upload = await onboardingRequest("POST", {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });
      const { error } = await supabase.storage
        .from("onboarding-documents")
        .uploadToSignedUrl(upload.path, upload.token, file);
      if (error) throw error;

      const nextDocuments: OnboardingDocument[] = [
        ...documents.filter((document) => document.label !== selectedDocument),
        {
          id: crypto.randomUUID(),
          label: selectedDocument,
          path: upload.path,
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          status: "pending",
        },
      ];
      const data = await onboardingRequest("PATCH", { onboarding_documents: nextDocuments });
      setApplication(data.application);
      setFile(null);
      setMessage(`${selectedDocument} uploaded for HR review.`);
    } catch (error: any) {
      setMessage(error.message || "Document upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function openDocument(document: OnboardingDocument) {
    try {
      const data = await onboardingRequest("POST", { action: "signed-url", path: document.path });
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      setMessage(error.message || "Document could not be opened.");
    }
  }

  async function reviewDocument(documentId: string, status: "approved" | "rejected") {
    const nextDocuments = documents.map((document) =>
      document.id === documentId ? { ...document, status } : document
    );
    await updateRecord({ onboarding_documents: nextDocuments }, `Document marked ${status}.`);
  }

  function openAppointmentLetter() {
    if (!application?.offer_details) {
      setMessage("The appointment letter has not been generated yet.");
      return;
    }

    const details = application.offer_details;
    const letter = window.open("", "_blank");
    if (!letter) {
      setMessage("Allow pop-ups to open the appointment letter.");
      return;
    }

    letter.document.write(`<!doctype html>
      <html><head><title>Appointment Letter - ${escapeHtml(applicantName)}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#17211b;margin:0;padding:48px;line-height:1.6}
        .page{max-width:760px;margin:auto}.header{border-bottom:4px solid #08783f;padding-bottom:18px;margin-bottom:30px}
        h1{font-size:24px;margin:0;color:#08783f}.meta{color:#59645d;font-size:13px}.terms{background:#f4f7f5;padding:18px;margin:24px 0}
        .sign{margin-top:48px}.actions{position:fixed;right:20px;top:20px}@media print{.actions{display:none}body{padding:0}}
        button{background:#08783f;color:white;border:0;padding:10px 16px;font-weight:bold;cursor:pointer}
      </style></head><body><button class="actions" onclick="window.print()">Print / Save PDF</button><main class="page">
      <header class="header"><h1>Pentecost University</h1><p class="meta">P. O. Box KN 1739, Kaneshie, Accra - info@pentvars.edu.gh</p></header>
      <p>${new Date().toLocaleDateString()}</p>
      <p><strong>${escapeHtml(applicantName)}</strong><br>${escapeHtml(application.email || "")}</p>
      <h2>Offer of Appointment: ${escapeHtml(details.position || roleName)}</h2>
      <p>Dear ${escapeHtml(applicantName)},</p>
      <p>Pentecost University is pleased to offer you appointment as <strong>${escapeHtml(details.position || roleName)}</strong>, commencing on <strong>${escapeHtml(details.startDate || "the agreed date")}</strong>.</p>
      <div class="terms">
        <p><strong>Salary:</strong> ${escapeHtml(details.salary || "As communicated by HR")}</p>
        <p><strong>Probation:</strong> ${escapeHtml(details.probation || "Six months")}</p>
        <p><strong>Reporting officer:</strong> ${escapeHtml(details.reportingOfficer || "Head of Department")}</p>
        ${details.responseDeadline ? `<p><strong>Response deadline:</strong> ${escapeHtml(details.responseDeadline)}</p>` : ""}
        <p><strong>Staff ID:</strong> ${escapeHtml(application.staff_id || staffId || "To be confirmed")}</p>
      </div>
      ${details.additionalTerms ? `<p>${escapeHtml(details.additionalTerms).replace(/\n/g, "<br>")}</p>` : ""}
      <p>This appointment is subject to successful verification of your submitted documents, references, and compliance with University policies.</p>
      <div class="sign"><p>Yours faithfully,</p><p><strong>Human Resources Department</strong><br>Pentecost University</p></div>
      </main></body></html>`);
    letter.document.close();
    letter.opener = null;
  }

  if (loading) {
    return <main className="app-shell"><p>Loading onboarding...</p></main>;
  }

  if (!application) {
    return <main className="app-shell"><div className="glass-card ops-section">{message || "Onboarding record not found."}</div></main>;
  }

  const applicantName = application.name || application.full_name || "Applicant";
  const roleName = getJobById(application.job_id)?.title || `Position ${application.job_id}`;

  return (
    <main className="app-shell">
      <div className="page-container onboarding-page">
        <header className="app-topbar">
          <UniversityBrand />
          <div>
            <p className="eyebrow">{role === "user" ? "My Onboarding" : `${role === "admin" ? "Admin" : "HR"} Onboarding Workspace`}</p>
            <h1 className="page-title">{pageStep.title}</h1>
            <p className="page-subtitle">{applicantName} · {roleName}</p>
          </div>
          <button className="secondary-button" onClick={() => router.push(role === "admin" ? "/admin" : role === "hr" ? "/hr" : "/my-applications")}>
            Dashboard
          </button>
        </header>

        {message && <div className="glass-card onboarding-message">{message}</div>}

        <nav className="onboarding-step-nav" aria-label="Onboarding steps">
          {onboardingStepDetails.map((step, index) => (
            <button
              key={step.slug}
              type="button"
              data-active={step.slug === pageStep.slug}
              data-complete={index <= currentIndex}
              onClick={() => router.push(onboardingStepHref(application.id, step.name))}
            >
              <span>{index + 1}</span>
              {step.title}
            </button>
          ))}
        </nav>

        <section className="onboarding-workspace">
          <div className="glass-card ops-section onboarding-main-panel">
            <p className="eyebrow">Current Task</p>
            <h2>{pageStep.title}</h2>
            <p className="page-subtitle">{pageStep.applicantText}</p>

            {pageStep.slug === "offer-letter" && (
              <div className="onboarding-callout">
                <strong>Offer status</strong>
                <p>HR has started your formal onboarding for {roleName}. Review the offer sent to your email.</p>
              </div>
            )}

            {application.offer_details && (
              <div className="onboarding-callout onboarding-letter-preview">
                <div>
                  <strong>Generated Appointment Letter</strong>
                  <p className="status-note">
                    {application.offer_details.position || roleName} - {application.offer_status || "Generated"}
                  </p>
                </div>
                <div className="onboarding-final-grid">
                  <span>
                    <small>Start date</small>
                    <strong>{application.offer_details.startDate || "To be confirmed"}</strong>
                  </span>
                  <span>
                    <small>Salary</small>
                    <strong>{application.offer_details.salary || "As communicated by HR"}</strong>
                  </span>
                  <span>
                    <small>Reporting officer</small>
                    <strong>{application.offer_details.reportingOfficer || "Head of Department"}</strong>
                  </span>
                  <span>
                    <small>Staff ID</small>
                    <strong>{application.staff_id || staffId || "Pending"}</strong>
                  </span>
                </div>
                <button className="secondary-button" type="button" onClick={openAppointmentLetter}>
                  Open Appointment Letter
                </button>
              </div>
            )}

            {pageStep.slug === "offer-accepted" && role === "user" && (
              <button
                className="premium-button"
                disabled={busy || application.onboarding_status === "Offer Accepted"}
                onClick={() => updateRecord({ acceptOffer: true }, "Offer acceptance recorded.")}
              >
                {application.onboarding_status === "Offer Accepted" ? "Offer Accepted" : "Accept Offer"}
              </button>
            )}

            {(pageStep.slug === "offer-accepted" || pageStep.slug === "documents") && (
              <>
                {role !== "user" && pageStep.slug === "documents" && (
                  <div className="onboarding-requirements">
                    <div>
                      <strong>Required documents</strong>
                      <p className="status-note">Choose the documents this applicant must upload.</p>
                    </div>
                    <div className="onboarding-requirement-grid">
                      {defaultOnboardingDocuments.map((document) => (
                        <label key={document}>
                          <input
                            type="checkbox"
                            checked={requiredDocumentSelection.includes(document)}
                            onChange={(event) => {
                              setRequiredDocumentSelection((current) =>
                                event.target.checked
                                  ? [...current, document]
                                  : current.filter((item) => item !== document)
                              );
                            }}
                          />
                          <span>{document}</span>
                        </label>
                      ))}
                    </div>
                    <button
                      className="secondary-button"
                      disabled={busy || !requiredDocumentSelection.length}
                      onClick={() => updateRecord(
                        { onboarding_required_documents: requiredDocumentSelection },
                        "Applicant document requirements updated."
                      )}
                    >
                      Save Required Documents
                    </button>
                  </div>
                )}

                {role === "user" && (
                  <form className="onboarding-upload-form" onSubmit={uploadDocument}>
                    <select className="input-field" value={selectedDocument} onChange={(event) => setSelectedDocument(event.target.value)}>
                      {requiredDocuments.map((document) => <option key={document} value={document}>{document}</option>)}
                    </select>
                    <input className="input-field" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                    <button className="premium-button" disabled={busy}>{busy ? "Uploading..." : "Upload Document"}</button>
                  </form>
                )}

                <div className="onboarding-document-list">
                  {requiredDocuments.map((label) => {
                    const document = documents.find((item) => item.label === label);
                    return (
                      <article key={label}>
                        <div>
                          <strong>{label}</strong>
                          <p className="status-note">{document ? `${document.fileName} · ${document.status}` : "Not uploaded"}</p>
                        </div>
                        {document && (
                          <div className="onboarding-document-actions">
                            <button className="secondary-button" onClick={() => openDocument(document)}>View</button>
                            {role !== "user" && (
                              <>
                                {document.status === "approved" ? (
                                  <button className="secondary-button is-approved" disabled>Approved</button>
                                ) : (
                                  <button className="secondary-button" onClick={() => reviewDocument(document.id, "approved")}>Approve</button>
                                )}
                                {document.status === "rejected" ? (
                                  <button className="danger-button" disabled>Rejected</button>
                                ) : (
                                  <button className="danger-button" onClick={() => reviewDocument(document.id, "rejected")}>Reject</button>
                                )}
                              </>
                            )}
                            {role === "user" && document.status === "approved" && (
                              <button className="secondary-button is-approved" disabled>Approved</button>
                            )}
                            {role === "user" && document.status === "rejected" && (
                              <button className="danger-button" disabled>Rejected</button>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </>
            )}

            {pageStep.slug === "references" && (
              <div className="onboarding-callout">
                <strong>Reference review</strong>
                <p>HR will contact the referees supplied in the onboarding documents. Any follow-up appears in the HR notes.</p>
              </div>
            )}

            {pageStep.slug === "staff-account" && (
              <div className="onboarding-callout">
                <strong>{application.staff_id ? "Assigned staff ID" : "Proposed staff ID"}</strong>
                <p className="onboarding-staff-id">{application.staff_id || staffId}</p>
              </div>
            )}

            {pageStep.slug === "orientation" && (
              <div className="onboarding-callout">
                <strong>Orientation details</strong>
                <p>{application.orientation_details || "HR has not added the orientation date and venue yet."}</p>
              </div>
            )}

            {pageStep.slug === "completed" && (
              <div className="onboarding-callout onboarding-completion-package">
                <strong>Welcome to Pentecost University</strong>
                <p>Your onboarding has been completed. Keep these final appointment details for your records.</p>
                <div className="onboarding-final-grid">
                  <span>
                    <small>Staff ID</small>
                    <strong>{application.staff_id || staffId || "Pending"}</strong>
                  </span>
                  <span>
                    <small>Position</small>
                    <strong>{roleName}</strong>
                  </span>
                  <span>
                    <small>Applicant email</small>
                    <strong>{application.email || "Not recorded"}</strong>
                  </span>
                  <span>
                    <small>Status</small>
                    <strong>{application.status || "Hired / Onboarded"}</strong>
                  </span>
                </div>
                <div className="onboarding-letter-box">
                  <p className="eyebrow">Appointment Letter Summary</p>
                  <p>
                    Pentecost University confirms that {applicantName} has completed onboarding for {roleName}.
                    The assigned staff identity is {application.staff_id || staffId || "pending"}.
                  </p>
                  <p>{application.orientation_details || "Orientation and reporting details will be communicated by HR where applicable."}</p>
                </div>
              </div>
            )}
          </div>

          <aside className="glass-card ops-section onboarding-side-panel">
            <p className="eyebrow">Selected Step</p>
            <h3>{pageStep.title}</h3>
            <div className="onboarding-callout">
              <strong>Recorded progress</strong>
              <p>{application.onboarding_status || "Not started"}</p>
              {application.onboarding_status !== pageStep.name && (
                <p className="status-note">
                  You are viewing {pageStep.title}. The recorded stage changes only after HR or Admin saves this step.
                </p>
              )}
            </div>
            <p className="status-note">Application status: {application.status || "Awaiting update"}</p>

            {role !== "user" && (
              <>
                <label className="control-label">
                  HR notes
                  <textarea className="input-field" rows={5} value={hrNotes} onChange={(event) => setHrNotes(event.target.value)} />
                </label>
                {pageStep.slug === "orientation" && (
                  <label className="control-label">
                    Orientation details
                    <textarea className="input-field" rows={4} value={orientationDetails} onChange={(event) => setOrientationDetails(event.target.value)} />
                  </label>
                )}
                {(pageStep.slug === "staff-account" || pageStep.slug === "completed") && (
                  <label className="control-label">
                    Staff ID
                    <input className="input-field" value={staffId} onChange={(event) => setStaffId(event.target.value)} />
                  </label>
                )}
                <button
                  className="premium-button"
                  disabled={busy}
                  onClick={saveHrUpdate}
                >
                  Save HR Update
                </button>
              </>
            )}

            {application.onboarding_hr_notes && (
              <div className="onboarding-callout">
                <strong>HR notes</strong>
                <p>{application.onboarding_hr_notes}</p>
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}

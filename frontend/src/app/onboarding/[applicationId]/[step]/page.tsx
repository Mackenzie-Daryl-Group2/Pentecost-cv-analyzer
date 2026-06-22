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
};

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
            Back to dashboard
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
                                <button className="secondary-button" onClick={() => reviewDocument(document.id, "approved")}>Approve</button>
                                <button className="danger-button" onClick={() => reviewDocument(document.id, "rejected")}>Reject</button>
                              </>
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
              <div className="onboarding-callout">
                <strong>Welcome to Pentecost University</strong>
                <p>Your staff ID is <span className="onboarding-staff-id">{application.staff_id || "pending"}</span>.</p>
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
                  onClick={() => updateRecord({
                    onboarding_status: pageStep.name,
                    onboarding_hr_notes: hrNotes,
                    orientation_details: orientationDetails,
                    staff_id: pageStep.slug === "completed" || pageStep.slug === "staff-account" ? staffId : application.staff_id,
                    status: pageStep.slug === "completed" ? "Hired / Onboarded" : "Awaiting Onboarding",
                  }, `${pageStep.title} saved.`)}
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

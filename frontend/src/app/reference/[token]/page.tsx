"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import UniversityBrand from "@/components/UniversityBrand";

type ReferenceInfo = {
  reference: {
    refereeName: string;
    relationship?: string | null;
    status: string;
    dueAt?: string | null;
    completedAt?: string | null;
  };
  candidateName: string;
  jobTitle: string;
};

export default function ReferenceResponsePage() {
  const params = useParams<{ token: string }>();
  const [info, setInfo] = useState<ReferenceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    knownYears: "1",
    capacity: "",
    reliability: "3",
    communication: "3",
    integrity: "3",
    rehire: "",
    strengths: "",
    concerns: "",
    declaration: false,
  });

  useEffect(() => {
    fetch(`/api/references/${params.token}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setInfo(data);
        setSubmitted(data.reference.status === "Completed");
      })
      .catch((error) => setMessage(error.message || "Reference request could not be loaded."))
      .finally(() => setLoading(false));
  }, [params.token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setMessage("");
    const response = await fetch(`/api/references/${params.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) : {};
    setSending(false);
    if (!response?.ok) {
      setMessage(data.error || "Reference response could not be submitted.");
      return;
    }
    setSubmitted(true);
    setMessage("Thank you. Your confidential reference has been submitted to Pentecost University HR.");
  }

  if (loading) return <main className="app-shell"><p>Loading reference request...</p></main>;

  return (
    <main className="app-shell reference-public-page">
      <div className="reference-public-shell">
        <header className="app-topbar">
          <UniversityBrand />
          <div>
            <p className="eyebrow">Confidential Reference</p>
            <h1 className="page-title">Employment Reference Form</h1>
            <p className="page-subtitle">Submitted directly to the Human Resources Department.</p>
          </div>
        </header>

        {message && <div className="glass-card onboarding-message" role="status">{message}</div>}

        {!info ? (
          <section className="glass-card ops-section"><h2>Reference unavailable</h2><p className="status-note">The link may be invalid or expired.</p></section>
        ) : submitted ? (
          <section className="glass-card reference-complete">
            <span aria-hidden="true">✓</span>
            <h2>Reference submitted</h2>
            <p>Thank you, {info.reference.refereeName}. No further action is required.</p>
          </section>
        ) : (
          <form className="glass-card ops-section reference-response-form" onSubmit={submit}>
            <div className="reference-request-summary">
              <div><small>Candidate</small><strong>{info.candidateName}</strong></div>
              <div><small>Position</small><strong>{info.jobTitle}</strong></div>
              <div><small>Referee</small><strong>{info.reference.refereeName}</strong></div>
              <div><small>Due date</small><strong>{info.reference.dueAt ? new Date(info.reference.dueAt).toLocaleDateString() : "Not specified"}</strong></div>
            </div>

            <div className="reference-form-grid">
              <label className="control-label">
                Years you have known the candidate
                <input className="input-field" type="number" min="0" max="60" value={form.knownYears} onChange={(event) => setForm({ ...form, knownYears: event.target.value })} required />
              </label>
              <label className="control-label">
                Capacity in which you know the candidate
                <input className="input-field" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} placeholder="Supervisor, colleague, lecturer..." required />
              </label>
              {[
                ["Reliability", "reliability"],
                ["Communication", "communication"],
                ["Integrity", "integrity"],
              ].map(([label, key]) => (
                <label className="control-label" key={key}>
                  {label} (1–5)
                  <select className="input-field" value={(form as any)[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })}>
                    {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              ))}
              <label className="control-label">
                Would you employ or work with this candidate again?
                <select className="input-field" value={form.rehire} onChange={(event) => setForm({ ...form, rehire: event.target.value })} required>
                  <option value="">Select response</option>
                  <option value="Yes">Yes</option>
                  <option value="With reservations">With reservations</option>
                  <option value="No">No</option>
                </select>
              </label>
            </div>

            <label className="control-label">
              Main strengths
              <textarea className="input-field" rows={5} value={form.strengths} onChange={(event) => setForm({ ...form, strengths: event.target.value })} required />
            </label>
            <label className="control-label">
              Concerns or areas for development
              <textarea className="input-field" rows={4} value={form.concerns} onChange={(event) => setForm({ ...form, concerns: event.target.value })} />
            </label>
            <label className="reference-declaration">
              <input type="checkbox" checked={form.declaration} onChange={(event) => setForm({ ...form, declaration: event.target.checked })} required />
              <span>I confirm that this information is accurate to the best of my knowledge and may be used by Pentecost University for recruitment verification.</span>
            </label>
            <button className="premium-button" disabled={sending}>{sending ? "Submitting..." : "Submit Confidential Reference"}</button>
          </form>
        )}
      </div>
    </main>
  );
}

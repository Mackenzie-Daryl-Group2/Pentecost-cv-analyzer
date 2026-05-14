export type InterviewScoreForm = {
  communication: string;
  roleKnowledge: string;
  experience: string;
  cultureFit: string;
  notes: string;
};

export const emptyInterviewScoreForm: InterviewScoreForm = {
  communication: "",
  roleKnowledge: "",
  experience: "",
  cultureFit: "",
  notes: "",
};

export const onboardingSteps = [
  "Offer Letter Sent",
  "Offer Accepted",
  "Documents Verified",
  "References Checked",
  "Staff Account Created",
  "Orientation Scheduled",
  "Completed",
];

function clampScore(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(25, parsed));
}

export function interviewScoreTotal(score: InterviewScoreForm) {
  return clampScore(score.communication) + clampScore(score.roleKnowledge) + clampScore(score.experience) + clampScore(score.cultureFit);
}

export function interviewRecommendation(score: number | null) {
  if (score === null) {
    return {
      label: "Not scored",
      detail: "Interview panel score has not been recorded yet.",
    };
  }

  if (score >= 80) {
    return {
      label: "Strong hire",
      detail: "The candidate shows strong interview performance and should move quickly to final approval.",
    };
  }

  if (score >= 65) {
    return {
      label: "Recommended",
      detail: "The candidate meets the interview standard and can proceed to hiring review.",
    };
  }

  if (score >= 50) {
    return {
      label: "Hold for review",
      detail: "The candidate has partial fit. HR should compare them with stronger candidates before deciding.",
    };
  }

  return {
    label: "Do not proceed",
    detail: "The candidate did not meet the interview benchmark for this role.",
  };
}

export function parseInterviewScore(notes?: string | null) {
  const match = String(notes || "").match(/Interview score:\s*(\d{1,3})\/100/i);
  if (!match) return null;
  return Math.max(0, Math.min(100, Number(match[1])));
}

export function buildInterviewScoreNote(score: InterviewScoreForm) {
  const total = interviewScoreTotal(score);
  const recommendation = interviewRecommendation(total);

  return [
    `Interview score: ${total}/100`,
    `Communication: ${clampScore(score.communication)}/25`,
    `Role knowledge: ${clampScore(score.roleKnowledge)}/25`,
    `Experience: ${clampScore(score.experience)}/25`,
    `Culture fit: ${clampScore(score.cultureFit)}/25`,
    `AI recommendation: ${recommendation.label} - ${recommendation.detail}`,
    score.notes.trim() ? `Panel notes: ${score.notes.trim()}` : "",
  ].filter(Boolean).join("\n");
}

export function mergeInterviewScoreNote(existingNotes: string | null | undefined, scoreNote: string) {
  const cleaned = String(existingNotes || "")
    .replace(/\n?\s*Interview score:[\s\S]*?(?=\n\n|$)/i, "")
    .trim();

  return [cleaned, scoreNote].filter(Boolean).join("\n\n");
}

export function cvAiSummary(candidateName: string, roleTitle: string, similarity: number, status?: string | null) {
  const percent = Math.round(Number(similarity || 0) * 100);
  const normalizedStatus = String(status || "").toLowerCase();

  if (percent >= 80) {
    return `${candidateName} is a strong CV match for ${roleTitle}, with a ${percent}% requirement alignment. AI recommends interview priority.`;
  }

  if (percent >= 65 || normalizedStatus.includes("recommended")) {
    return `${candidateName} appears suitable for ${roleTitle}, with a ${percent}% match. AI recommends an interview with focused questions on any role gaps.`;
  }

  if (percent >= 50) {
    return `${candidateName} has a limited requirement match for ${roleTitle} at ${percent}%. AI recommends HR review before scheduling.`;
  }

  return `${candidateName} is currently below the preferred CV benchmark for ${roleTitle} at ${percent}%. AI does not recommend progressing without manual justification.`;
}

export function onboardingProgress(status?: string | null) {
  const value = String(status || "");
  const index = onboardingSteps.findIndex((step) => step.toLowerCase() === value.toLowerCase());
  return index < 0 ? -1 : index;
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

export function onboardingEmailForStep(step: string, candidateName: string, roleTitle: string) {
  const name = escapeHtml(candidateName || "Applicant");
  const role = escapeHtml(roleTitle || "the role");

  if (step === "Offer Letter Sent") {
    return {
      subject: "Pentecost University Offer Letter",
      html: `
        <h2>Offer Letter Sent</h2>
        <p>Hello ${name},</p>
        <p>Congratulations. Pentecost University has prepared your offer for <strong>${role}</strong>.</p>
        <p>Please review the offer details carefully and respond with your acceptance or any questions from HR.</p>
        <p>Regards,<br/>Pentecost University HR Department</p>
      `,
    };
  }

  if (step === "Orientation Scheduled") {
    return {
      subject: "Pentecost University Orientation Details",
      html: `
        <h2>Orientation Scheduled</h2>
        <p>Hello ${name},</p>
        <p>Your orientation for <strong>${role}</strong> has been scheduled.</p>
        <p>Please check in with HR for the confirmed time, venue or meeting link, and any documents you should bring.</p>
        <p>We look forward to welcoming you properly into the Pentecost University community.</p>
        <p>Regards,<br/>Pentecost University HR Department</p>
      `,
    };
  }

  if (step === "Completed") {
    return {
      subject: "Welcome to Pentecost University",
      html: `
        <h2>Onboarding Completed</h2>
        <p>Hello ${name},</p>
        <p>Your onboarding for <strong>${role}</strong> has been completed.</p>
        <p>Welcome to Pentecost University. We are pleased to have you joining the team and wish you a strong start.</p>
        <p>Regards,<br/>Pentecost University HR Department</p>
      `,
    };
  }

  return null;
}

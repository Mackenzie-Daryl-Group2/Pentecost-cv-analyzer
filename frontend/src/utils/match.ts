export type MatchDecision = {
  label: string;
  detail: string;
  tone: "strong" | "good" | "review" | "low";
  passed: boolean;
};

export function getMatchDecision(similarity: number | null | undefined): MatchDecision {
  const score = typeof similarity === "number" && Number.isFinite(similarity) ? similarity : 0;

  if (score >= 0.75) {
    return {
      label: "Strong alignment",
      detail: "The CV closely matches the key requirements for this role.",
      tone: "strong",
      passed: true,
    };
  }

  if (score >= 0.55) {
    return {
      label: "Meets initial screening",
      detail: "The CV matches enough requirements to move forward for HR review.",
      tone: "good",
      passed: true,
    };
  }

  if (score >= 0.35) {
    return {
      label: "Needs manual review",
      detail: "The CV has some relevant experience, but HR should review it manually.",
      tone: "review",
      passed: false,
    };
  }

  return {
    label: "Limited requirement match",
    detail: "The CV does not strongly reflect the stated requirements for this role.",
    tone: "low",
    passed: false,
  };
}

export function getMatchStyle(tone: MatchDecision["tone"]) {
  if (tone === "strong" || tone === "good") {
    return {
      background: "var(--success-bg)",
      color: "var(--accent-neon)",
      border: "1px solid var(--success-border)",
    };
  }

  if (tone === "review") {
    return {
      background: "rgba(255, 193, 7, 0.12)",
      color: "#ffd166",
      border: "1px solid rgba(255, 193, 7, 0.25)",
    };
  }

  return {
    background: "rgba(255, 255, 255, 0.06)",
    color: "rgba(255, 255, 255, 0.82)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
  };
}

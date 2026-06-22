export const applicationTimeline = [
  { key: "submitted", label: "Application Sent" },
  { key: "screening", label: "CV Screening" },
  { key: "interview", label: "Interview" },
  { key: "decision", label: "Final Decision" },
  { key: "onboarding", label: "Onboarding" },
] as const;

export function applicationProgress(status?: string | null, interviewDate?: string | null, onboardingStatus?: string | null) {
  const normalized = String(status || "").toLowerCase();
  if (onboardingStatus || normalized.includes("onboard") || normalized.includes("hired")) return 4;
  if (
    normalized.includes("interview passed") ||
    normalized.includes("interview not passed") ||
    normalized.includes("recommended for hire") ||
    normalized.includes("offer")
  ) return 3;
  if (interviewDate || normalized.includes("interview")) return 2;
  if (normalized && !normalized.includes("sent") && !normalized.includes("received")) return 1;
  return 0;
}

export function canWithdrawApplication(status?: string | null, onboardingStatus?: string | null) {
  const normalized = String(status || "").toLowerCase();
  return !onboardingStatus && !normalized.includes("withdrawn") && !normalized.includes("hired");
}

export function canReplaceCv(status?: string | null, interviewDate?: string | null) {
  const normalized = String(status || "").toLowerCase();
  return !interviewDate && !normalized.includes("withdrawn") && !normalized.includes("interview");
}

export function validateRecruitmentFile(file: File, kind: "cv" | "document" | "photo") {
  const limits = { cv: 8, document: 8, photo: 4 };
  const allowed = {
    cv: ["application/pdf"],
    document: ["application/pdf", "image/png", "image/jpeg"],
    photo: ["image/png", "image/jpeg", "image/webp"],
  };
  const maximumBytes = limits[kind] * 1024 * 1024;

  if (!allowed[kind].includes(file.type)) {
    return `${kind === "photo" ? "Photo" : "File"} type is not allowed.`;
  }
  if (file.size > maximumBytes) {
    return `File must be ${limits[kind]} MB or smaller.`;
  }
  return "";
}

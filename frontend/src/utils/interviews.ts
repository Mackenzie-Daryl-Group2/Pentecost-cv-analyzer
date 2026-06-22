function hasRecordedResult(value: unknown, status?: string | null) {
  if (value === true || value === false) return true;
  const normalizedValue = String(value ?? "").trim().toLowerCase();
  if (normalizedValue && normalizedValue !== "null" && normalizedValue !== "undefined") return true;

  const normalizedStatus = String(status || "").toLowerCase();
  return normalizedStatus.includes("interview passed")
    || normalizedStatus.includes("interview not passed")
    || normalizedStatus.includes("interview scored")
    || normalizedStatus.includes("rejected after interview")
    || normalizedStatus.includes("recommended for hire")
    || normalizedStatus.includes("awaiting onboarding")
    || normalizedStatus.includes("offer letter")
    || normalizedStatus.includes("hired");
}

export function canJoinInterview(
  scheduledAt?: string | null,
  meetLink?: string | null,
  interviewResult?: unknown,
  status?: string | null
) {
  if (!meetLink || !scheduledAt || hasRecordedResult(interviewResult, status)) return false;
  const scheduledTime = new Date(scheduledAt).getTime();
  return Number.isFinite(scheduledTime) && scheduledTime > Date.now();
}

export function interviewAccessMessage(scheduledAt?: string | null, interviewResult?: unknown, status?: string | null) {
  if (hasRecordedResult(interviewResult, status)) return "Interview completed";
  if (scheduledAt && new Date(scheduledAt).getTime() <= Date.now()) return "Interview time has passed";
  return "Meeting link unavailable";
}

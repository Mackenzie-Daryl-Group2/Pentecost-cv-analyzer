export type OnboardingDocument = {
  id: string;
  label: string;
  path: string;
  fileName: string;
  uploadedAt: string;
  status: "pending" | "approved" | "rejected";
  reviewNote?: string;
};

export const onboardingStepDetails = [
  {
    name: "Offer Letter Sent",
    slug: "offer-letter",
    title: "Offer Letter",
    applicantText: "Review the offer issued by HR before accepting the appointment.",
  },
  {
    name: "Offer Accepted",
    slug: "offer-accepted",
    title: "Offer Acceptance",
    applicantText: "Confirm acceptance and upload the signed offer letter.",
  },
  {
    name: "Documents Verified",
    slug: "documents",
    title: "Employment Documents",
    applicantText: "Upload the employment documents requested by HR for verification.",
  },
  {
    name: "References Checked",
    slug: "references",
    title: "Reference Checks",
    applicantText: "Provide accurate referee details and monitor the reference review.",
  },
  {
    name: "Staff Account Created",
    slug: "staff-account",
    title: "Staff Account",
    applicantText: "HR will prepare your institutional account and staff identity.",
  },
  {
    name: "Orientation Scheduled",
    slug: "orientation",
    title: "Orientation",
    applicantText: "Review the orientation date, venue, and reporting instructions.",
  },
  {
    name: "Completed",
    slug: "completed",
    title: "Onboarding Complete",
    applicantText: "Your onboarding is complete. Your staff ID and final details appear here.",
  },
] as const;

export const defaultOnboardingDocuments = [
  "Signed offer letter",
  "Ghana Card or passport",
  "Academic and professional certificates",
  "SSNIT card or SSNIT number",
  "Tax identification details",
  "Recent passport photograph",
  "Two referee contact details",
];

export function onboardingStepByName(name?: string | null) {
  return onboardingStepDetails.find((step) => step.name === name) || onboardingStepDetails[0];
}

export function onboardingStepBySlug(slug?: string | null) {
  return onboardingStepDetails.find((step) => step.slug === slug) || onboardingStepDetails[0];
}

export function onboardingStepHref(applicationId: string | number, stepName?: string | null) {
  return `/onboarding/${applicationId}/${onboardingStepByName(stepName).slug}`;
}

export function parseOnboardingDocuments(value: unknown): OnboardingDocument[] {
  if (Array.isArray(value)) return value as OnboardingDocument[];
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function generateStaffId(applicationId: string | number) {
  const year = new Date().getFullYear();
  const source = String(applicationId).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const suffix = source.slice(-6).padStart(6, "0");
  return `PU-${year}-${suffix}`;
}

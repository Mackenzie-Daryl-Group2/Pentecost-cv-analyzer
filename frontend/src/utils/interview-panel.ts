export type InterviewPanelScore = {
  id?: number;
  application_id: string;
  reviewer_id: string;
  reviewer_email?: string | null;
  reviewer_role: "hr" | "registrar" | "admin";
  communication: number;
  role_knowledge: number;
  experience: number;
  culture_fit: number;
  total_score: number;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export function compiledInterviewScore(scores: InterviewPanelScore[]) {
  if (!scores.length) return null;
  return Math.round(scores.reduce((total, score) => total + Number(score.total_score || 0), 0) / scores.length);
}

export function reviewerLabel(score: InterviewPanelScore) {
  if (score.reviewer_role === "hr") return "HR";
  if (score.reviewer_role === "registrar") return "Registrar";
  return "Administrator";
}

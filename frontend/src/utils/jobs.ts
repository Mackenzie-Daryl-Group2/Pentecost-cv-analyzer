export interface Job {
  id: number;
  title: string;
  description: string;
  requirements: string;
  salary: string;
  application_deadline?: string | null;
}

export const jobs: Job[] = [
  { id: 1, title: "Lecturer in Computer Science", description: "Teach software engineering and data structures in the Faculty of Computing", requirements: "PhD in Computer Science with teaching experience", salary: "50000" },
  { id: 2, title: "Lecturer in Information Systems", description: "Deliver database and enterprise systems courses in Faculty of Computing", requirements: "PhD or MSc with strong industry and academic experience", salary: "48000" },
  { id: 3, title: "Lecturer in Accounting", description: "Teach financial accounting and taxation in Business School", requirements: "PhD in Accounting or related professional certification", salary: "47000" },
  { id: 4, title: "Lecturer in Marketing", description: "Teach strategic marketing and digital marketing in Business School", requirements: "PhD or MSc in Marketing plus publications", salary: "46000" },
  { id: 5, title: "Lecturer in Nursing", description: "Teach clinical nursing and health assessment in Faculty of Health Sciences", requirements: "Master's degree in Nursing and license to practice", salary: "49000" },
  { id: 6, title: "Lecturer in Theology", description: "Teach biblical studies and ministry practice in Faculty of Theology", requirements: "Master's or PhD in Theology", salary: "45000" },
  { id: 7, title: "Lecturer in Education", description: "Teach curriculum and educational psychology in Faculty of Education", requirements: "Master's degree in Education and classroom experience", salary: "44000" },
  { id: 8, title: "Research Assistant - Engineering", description: "Support faculty research and lab documentation in Engineering Department", requirements: "MSc or BSc in Engineering with research skills", salary: "32000" },
  { id: 9, title: "Laboratory Technologist - Science", description: "Manage laboratory equipment and practical sessions in Science Department", requirements: "BSc in Laboratory Technology or related field", salary: "33000" },
  { id: 10, title: "Assistant Librarian", description: "Support cataloging and digital library services in University Library", requirements: "Bachelor's degree in Library and Information Science", salary: "30000" },
  { id: 11, title: "Admissions Officer", description: "Process applications and admissions records in Admissions Unit", requirements: "Bachelor's degree and admissions operations experience", salary: "31000" },
  { id: 12, title: "Examinations Officer", description: "Coordinate examination schedules and scripts in Academic Affairs", requirements: "Bachelor's degree and records management skills", salary: "32000" },
  { id: 13, title: "Procurement Officer", description: "Manage purchasing and vendor contracts in Procurement Department", requirements: "Bachelor's degree in Procurement or Supply Chain", salary: "34000" },
  { id: 14, title: "Human Resource Officer", description: "Support recruitment and staff welfare in HR Department", requirements: "Bachelor's degree in HRM and recruitment experience", salary: "35000" },
  { id: 15, title: "ICT Support Engineer", description: "Provide helpdesk and network support for ICT Directorate", requirements: "BSc in IT and troubleshooting expertise", salary: "36000" },
  { id: 16, title: "Systems Administrator", description: "Manage servers and campus systems in ICT Directorate", requirements: "BSc in Computer Science and systems administration experience", salary: "38000" },
  { id: 17, title: "Finance Officer", description: "Handle budgeting and payment processing in Finance Department", requirements: "Bachelor's degree in Finance or Accounting", salary: "36000" },
  { id: 18, title: "Internal Auditor", description: "Conduct compliance and risk audits for university units", requirements: "Professional accounting qualification and audit experience", salary: "39000" },
  { id: 19, title: "Public Relations Officer", description: "Coordinate communication and media engagements in PR Office", requirements: "Bachelor's degree in Communication and media relations skills", salary: "34000" },
  { id: 20, title: "Quality Assurance Officer", description: "Monitor program quality and accreditation compliance in QA Unit", requirements: "Master's degree in Education or QA experience", salary: "37000" },
  { id: 21, title: "Estate Officer", description: "Supervise facilities and maintenance operations in Estate Department", requirements: "Bachelor's degree in Building Technology or related field", salary: "33000" },
  { id: 22, title: "Security Supervisor", description: "Lead campus security operations and incident response", requirements: "Security management certification and supervisory experience", salary: "32000" },
  { id: 23, title: "Sports Coordinator", description: "Manage student sports and recreation programs in Student Affairs", requirements: "Degree in Sports Management or Physical Education", salary: "30000" },
  { id: 24, title: "Guidance and Counseling Officer", description: "Provide student counseling and psychosocial support in Student Affairs", requirements: "Master's degree in Counseling Psychology", salary: "35000" },
  { id: 25, title: "Administrative Assistant - Faculty Office", description: "Handle correspondence and scheduling in Faculty Offices", requirements: "Bachelor's degree and office administration experience", salary: "28000" },
];

function normalizeJob(job: any): Job {
  return {
    id: Number(job.id),
    title: String(job.title || ""),
    description: String(job.description || ""),
    requirements: String(job.requirements || ""),
    salary: String(job.salary || ""),
    application_deadline: job.application_deadline ? String(job.application_deadline) : null,
  };
}

export function mergeJobs(remoteJobs: any[] | null | undefined): Job[] {
  const merged = new Map<number, Job>();

  jobs.forEach((job) => merged.set(job.id, job));
  (remoteJobs || []).forEach((job) => {
    const normalized = normalizeJob(job);
    if (!Number.isFinite(normalized.id)) return;

    merged.set(normalized.id, normalized);
  });

  return Array.from(merged.values()).sort((a, b) => a.id - b.id);
}

export async function loadJobs(supabase: any): Promise<Job[]> {
  let { data, error } = await supabase
    .from("jobs")
    .select("id,title,description,requirements,salary,application_deadline")
    .order("id", { ascending: true });

  if (error && ["42703", "PGRST204"].includes(String(error.code || ""))) {
    const fallbackResponse = await supabase
      .from("jobs")
      .select("id,title,description,requirements,salary")
      .order("id", { ascending: true });
    data = fallbackResponse.data;
    error = fallbackResponse.error;
  }

  if (error || !data?.length) return jobs;
  return mergeJobs(data as any[]);
}

export async function loadJobById(supabase: any, jobId: string | number | null | undefined) {
  const numericId = Number(jobId);
  if (!Number.isFinite(numericId)) return null;

  let { data, error } = await supabase
    .from("jobs")
    .select("id,title,description,requirements,salary,application_deadline")
    .eq("id", numericId)
    .maybeSingle();

  if (error && ["42703", "PGRST204"].includes(String(error.code || ""))) {
    const fallbackResponse = await supabase
      .from("jobs")
      .select("id,title,description,requirements,salary")
      .eq("id", numericId)
      .maybeSingle();
    data = fallbackResponse.data;
    error = fallbackResponse.error;
  }

  if (!error && data) return normalizeJob(data);
  return getJobById(numericId);
}

export function getJobById(jobId: string | number | null | undefined) {
  const numericId = Number(jobId);
  return jobs.find((job) => job.id === numericId) || null;
}

export function isJobClosed(job: Job, now = new Date()) {
  if (!job.application_deadline) return false;
  const deadline = new Date(job.application_deadline);
  return !Number.isNaN(deadline.getTime()) && deadline.getTime() < now.getTime();
}

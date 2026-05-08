"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";

interface Job {
  id: number;
  title: string;
  description: string;
  requirements: string;
  salary: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
        return;
      }
      setUser(user);

      // Full list of jobs from CSV
      const allJobs: Job[] = [
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
      setJobs(allJobs);
      setLoading(false);
    };
    init();
  }, [router]);

  const handleApply = (jobId: number) => {
    router.push(`/apply?jobId=${jobId}`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <main style={{ padding: "40px", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ 
        width: "100%", 
        maxWidth: "1200px", 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "40px",
        padding: "20px 40px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: "20px",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.05)"
      }}>
        <div style={{ fontWeight: "800", fontSize: "1.2rem", color: "white" }}>
          PENTECOST <span style={{ color: "var(--accent-neon)", fontSize: "0.8rem", verticalAlign: "middle", marginLeft: "8px" }}>RECRUITER</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <button onClick={() => router.push("/jobs")} style={{ background: "none", border: "none", color: "white", fontWeight: "600" }}>Jobs</button>
          <button onClick={() => router.push("/my-applications")} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontWeight: "600" }}>Applications</button>
          <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>{user?.email}</span>
          <button onClick={handleLogout} style={{ background: "rgba(255,0,0,0.1)", color: "#ff8a80", border: "1px solid rgba(255,0,0,0.2)", padding: "8px 16px", borderRadius: "8px", fontSize: "0.85rem", fontWeight: "600" }}>Logout</button>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", width: "100%" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "8px" }}>Job Board</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "40px" }}>Showing all 25 active vacancies across faculties.</p>

        {loading ? (
          <p>Loading jobs...</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "24px" }}>
            {jobs.map((job) => (
              <div key={job.id} className="glass-card" style={{ padding: "32px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontSize: "1.25rem", color: "white", marginBottom: "16px" }}>{job.title}</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "20px" }}>{job.description}</p>
                  <div style={{ marginBottom: "24px" }}>
                    <p style={{ fontSize: "0.75rem", color: "var(--accent-neon)", fontWeight: "700", marginBottom: "8px" }}>REQUIREMENTS</p>
                    <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>{job.requirements}</p>
                  </div>
                </div>
                <button className="premium-button" style={{ width: "100%" }} onClick={() => handleApply(job.id)}>Apply Now</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

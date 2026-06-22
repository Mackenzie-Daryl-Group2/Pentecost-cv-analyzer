"use client";

import { useMemo, useState } from "react";

type ChatMessage = {
  sender: "bot" | "user";
  text: string;
  links?: Array<{ label: string; href: string }>;
};

const quickQuestions = [
  "Where is the campus?",
  "How do I contact the school?",
  "What faculties are available?",
  "What are the application steps?",
  "Where can I find policies?",
  "Where are current vacancies?",
];

const schoolLinks = {
  contact: "https://pentvars.edu.gh/contact-us/",
  admissions: "https://pentvars.edu.gh/admissions-procedure/",
  faculties: "https://pentvars.edu.gh/faculty/",
  handbook: "https://pentvars.edu.gh/resource/student-handbook/",
  resources: "https://pentvars.edu.gh/resources/",
  vacancies: "https://pentvars.edu.gh/vacancies/",
  staffDirectory: "https://pentvars.edu.gh/staff-directory/",
  directions: "https://pentvars.edu.gh/directions-to-campus/",
  website: "https://pentvars.edu.gh/",
};

function answerQuestion(question: string): ChatMessage {
  const q = question.toLowerCase();

  if (/(contact|phone|email|call|number|reach)/.test(q)) {
    return {
      sender: "bot",
      text: "Pentecost University lists info@pentvars.edu.gh, +233 28 309 4284, and +233 30 241 7057/8 as general contacts. Its postal address is P. O. Box KN 1739, Kaneshie, Accra.",
      links: [{ label: "Contact page", href: schoolLinks.contact }],
    };
  }

  if (/(where|location|campus|direction|address|sowutuom|kaneshie)/.test(q)) {
    return {
      sender: "bot",
      text: "Pentecost University lists its postal address as P. O. Box KN 1739, Kaneshie, Accra. For admissions by post, the university also mentions delivery at the Academic Affairs Office, Sowutuom Campus.",
      links: [
        { label: "Campus directions", href: schoolLinks.directions },
        { label: "Contact page", href: schoolLinks.contact },
      ],
    };
  }

  if (/(faculty|faculties|school|programme|program|course|academics|department)/.test(q)) {
    return {
      sender: "bot",
      text: "Pentecost University lists seven academic faculties or schools: Business Administration, Engineering Science and Computing, Theology Mission and Leadership, Health and Allied Sciences, Law, College of Foundation and Professional Studies, and Postgraduate Studies and Research.",
      links: [{ label: "Faculties", href: schoolLinks.faculties }],
    };
  }

  if (/(apply|application|admission|admissions|forms|certificate|passport|online)/.test(q)) {
    return {
      sender: "bot",
      text: "For online applications, the university says applicants should open Application Forms, choose Online Application, register for a login PIN, fill the forms, upload certified certificates/result slip and other relevant documents, upload a scanned passport-size photo, then submit.",
      links: [{ label: "Application procedure", href: schoolLinks.admissions }],
    };
  }

  if (/(policy|policies|regulation|regulations|handbook|conduct|discipline|rules|grievance|safety)/.test(q)) {
    return {
      sender: "bot",
      text: "The Student Handbook is the best place to start for school rules, student conduct, discipline, grievance procedures, campus safety, academic policies, and general regulations. For official decisions, confirm with HR, the Registrar, or the relevant university office.",
      links: [
        { label: "Student handbook", href: schoolLinks.handbook },
        { label: "University resources", href: schoolLinks.resources },
      ],
    };
  }

  if (/(job|jobs|vacancy|vacancies|career|recruitment|opening)/.test(q)) {
    return {
      sender: "bot",
      text: "Current opportunities should be confirmed on the Pentecost University vacancies page or in this recruitment portal. Vacancy deadlines and requirements can differ by position.",
      links: [{ label: "Official vacancies", href: schoolLinks.vacancies }],
    };
  }

  if (/(staff directory|staff member|employee|lecturer|office)/.test(q)) {
    return {
      sender: "bot",
      text: "Use the official staff directory to find publicly listed university staff and offices. Personal recruitment records should still be handled through HR.",
      links: [{ label: "Staff directory", href: schoolLinks.staffDirectory }],
    };
  }

  if (/(portal|library|e-learning|elearning|eportal|online service|opac|payment)/.test(q)) {
    return {
      sender: "bot",
      text: "The website lists online services including E-Learning, E-Library, undergraduate and postgraduate ePortals, Student Online Payment, and the Online Public Access Catalogue.",
      links: [{ label: "Pentecost University website", href: schoolLinks.website }],
    };
  }

  if (/(orientation|onboarding|new staff|offer|documents|references)/.test(q)) {
    return {
      sender: "bot",
      text: "For onboarding, follow the recruitment checklist: offer letter, offer acceptance, document verification, reference checks, staff account setup, orientation, then completion. HR should confirm dates, documents, venue, and reporting instructions.",
    };
  }

  return {
    sender: "bot",
    text: "I can help with Pentecost University contacts, campus location, admissions steps, faculties, online services, handbook/policy pointers, and onboarding questions. For official or personal records, please confirm with HR or the relevant university office.",
    links: [{ label: "Pentecost University website", href: schoolLinks.website }],
  };
}

export default function PentecostChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: "bot",
      text: "Hi, I can help with Pentecost University contacts, policies, admissions, campus information, and onboarding questions.",
    },
  ]);

  const latestBotLinks = useMemo(
    () => [...messages].reverse().find((message) => message.sender === "bot" && message.links?.length)?.links || [],
    [messages]
  );

  function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;

    setMessages((current) => [
      ...current,
      { sender: "user", text: trimmed },
      answerQuestion(trimmed),
    ]);
    setInput("");
  }

  return (
    <div className="chatbot-shell" data-open={isOpen}>
      {isOpen && (
        <section className="chatbot-panel" aria-label="Pentecost University help chatbot">
          <div className="chatbot-header">
            <div className="chatbot-brand-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 3 4 7l8 4 8-4-8-4Z" /><path d="M4 11l8 4 8-4" /><path d="M4 15l8 4 8-4" /></svg>
            </div>
            <div>
              <p className="eyebrow">Campus Help</p>
              <h2>Pentecost Assistant</h2>
              <p className="status-note">Public university information and onboarding guidance.</p>
            </div>
            <button type="button" className="modal-icon-button" onClick={() => setIsOpen(false)} aria-label="Close chatbot">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.map((message, index) => (
              <div key={`${message.sender}-${index}`} className="chat-message" data-sender={message.sender}>
                <p>{message.text}</p>
                {message.links?.length ? (
                  <div className="chat-links">
                    {message.links.map((link) => (
                      <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {input.trim() && (
            <div className="chat-quick">
              {quickQuestions.map((question) => (
                <button key={question} type="button" onClick={() => ask(question)}>
                  {question}
                </button>
              ))}
            </div>
          )}

          <form className="chatbot-form" onSubmit={(event) => { event.preventDefault(); ask(input); }}>
            <input
              className="input-field"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about policies, campus, admissions..."
              aria-label="Ask the Pentecost assistant"
            />
            <button type="submit" className="premium-button">Send</button>
          </form>

          {latestBotLinks.length ? (
            <p className="chatbot-source">Official public sources checked June 22, 2026. Follow the linked page for the latest authoritative details.</p>
          ) : null}
        </section>
      )}

      <button type="button" className="chatbot-toggle" onClick={() => setIsOpen((value) => !value)} aria-label="Open Pentecost assistant">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6a8 8 0 1 1 18-5Z" />
          <path d="M8 10h8" />
          <path d="M8 14h5" />
        </svg>
        <span>Help</span>
      </button>
    </div>
  );
}

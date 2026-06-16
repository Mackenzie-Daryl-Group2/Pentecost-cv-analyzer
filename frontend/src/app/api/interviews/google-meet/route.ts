import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "../../signup/_lib/server-env";

export const runtime = "nodejs";

type CalendarEvent = {
  id?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: string;
      uri?: string;
    }>;
  };
};

function env(name: string) {
  return String(getServerEnv(name) || "").trim();
}

function splitEmails(value: string) {
  return value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function extractMeetLink(event: CalendarEvent) {
  return (
    event.hangoutLink ||
    event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ||
    ""
  );
}

function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function googleErrorMessage(response: Response, rawBody: string) {
  const parsed = parseJson(rawBody) as
    | {
        error?: {
          message?: string;
          status?: string;
          errors?: Array<{ message?: string; reason?: string; domain?: string }>;
        };
      }
    | null;
  const googleReason = parsed?.error?.errors?.find((entry) => entry.message || entry.reason);
  const details = [
    parsed?.error?.message,
    googleReason?.message || googleReason?.reason,
    googleReason?.domain,
  ]
    .filter(Boolean)
    .join(": ");

  if (details && details.toLowerCase() !== "bad request") {
    return details;
  }

  const bodyPreview = rawBody.trim().slice(0, 500);
  return bodyPreview
    ? `Google Calendar rejected the request (${response.status} ${response.statusText}): ${bodyPreview}`
    : `Google Calendar rejected the request (${response.status} ${response.statusText}).`;
}

async function getAccessToken() {
  const clientId = env("GOOGLE_CLIENT_ID");
  const clientSecret = env("GOOGLE_CLIENT_SECRET");
  const refreshToken = env("GOOGLE_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Calendar credentials are not configured.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Google access token could not be created.");
  }

  return String(data.access_token);
}

async function fetchEvent(calendarId: string, eventId: string, accessToken: string) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  return response.ok ? ((await response.json()) as CalendarEvent) : null;
}

export async function POST(req: NextRequest) {
  try {
    const {
      candidateName,
      candidateEmail,
      candidatePhone,
      roleTitle,
      scheduledAt,
      notes,
      organizerEmail,
    } = await req.json();

    const start = new Date(String(scheduledAt || ""));
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: "A valid interview date and time is required." }, { status: 400 });
    }

    const accessToken = await getAccessToken();
    const calendarId = env("GOOGLE_CALENDAR_ID") || "primary";
    const timeZone = env("INTERVIEW_TIMEZONE") || "Africa/Accra";
    const durationMinutes = Number(env("INTERVIEW_DURATION_MINUTES") || 30);
    const end = new Date(start.getTime() + (Number.isFinite(durationMinutes) ? durationMinutes : 30) * 60 * 1000);
    const staffDashboardEmails = splitEmails(`${organizerEmail || ""},${env("INTERVIEW_STAKEHOLDER_EMAILS")}`);

    const eventBody = {
      summary: `Interview: ${String(candidateName || "Applicant")} - ${String(roleTitle || "Role")}`,
      description: [
        `Candidate: ${String(candidateName || "Applicant")}`,
        candidateEmail ? `Email: ${candidateEmail}` : "",
        candidatePhone ? `Phone: ${candidatePhone}` : "",
        notes ? `Notes: ${notes}` : "",
      ].filter(Boolean).join("\n"),
      start: { dateTime: start.toISOString(), timeZone },
      end: { dateTime: end.toISOString(), timeZone },
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      guestsCanInviteOthers: false,
      guestsCanModify: false,
    };

    const createResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=none`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      }
    );

    const rawEventBody = await createResponse.text();
    const event = (parseJson(rawEventBody) || {}) as CalendarEvent;
    if (!createResponse.ok) {
      throw new Error(googleErrorMessage(createResponse, rawEventBody));
    }

    let meetLink = extractMeetLink(event);
    if (!meetLink && event.id) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const refreshedEvent = await fetchEvent(calendarId, event.id, accessToken);
      if (refreshedEvent) {
        meetLink = extractMeetLink(refreshedEvent);
      }
    }

    if (!meetLink) {
      throw new Error("Google created the calendar event, but the Meet link was not ready yet. Try rescheduling in a moment.");
    }

    return NextResponse.json({
      success: true,
      meetLink,
      eventId: event.id,
      htmlLink: event.htmlLink,
      dashboardStaffEmails: staffDashboardEmails,
    });
  } catch (error: any) {
    console.error("Google Meet creation failed:", error);
    return NextResponse.json(
      { error: error.message || "Google Meet link could not be created." },
      { status: 500 }
    );
  }
}

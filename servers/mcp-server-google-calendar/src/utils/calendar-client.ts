import { google, calendar_v3 } from "googleapis";

/**
 * Creates a Google Calendar API client with the provided OAuth access token.
 * This is called per-request to support dynamic token authentication.
 */
export function createCalendarClient(accessToken: string): calendar_v3.Calendar {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  return google.calendar({ version: "v3", auth });
}

/**
 * Extracts Calendar access token from request headers.
 * Supports both x-calendar-token header and Authorization: Bearer token.
 */
export function extractCalendarToken(
  headers: Record<string, string | string[] | undefined>
): string | null {
  // Check x-calendar-token header first
  const calendarToken = headers["x-calendar-token"];
  if (calendarToken && typeof calendarToken === "string") {
    return calendarToken;
  }

  // Check Authorization header
  const authHeader = headers["authorization"];
  if (authHeader && typeof authHeader === "string") {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch) {
      return bearerMatch[1];
    }
  }

  return null;
}

/**
 * Format a date-time for Google Calendar API.
 * Accepts ISO string or Date object.
 */
export function formatDateTime(
  dateTime: string | Date,
  timeZone?: string
): { dateTime: string; timeZone?: string } {
  const dt = typeof dateTime === "string" ? dateTime : dateTime.toISOString();
  return timeZone ? { dateTime: dt, timeZone } : { dateTime: dt };
}

/**
 * Format a date for all-day events.
 * Returns date in YYYY-MM-DD format.
 */
export function formatDate(date: string | Date): { date: string } {
  const d = typeof date === "string" ? new Date(date) : date;
  const formatted = d.toISOString().split("T")[0];
  return { date: formatted };
}

/**
 * Parse event attendees from comma-separated string.
 */
export function parseAttendees(
  attendees: string | undefined
): calendar_v3.Schema$EventAttendee[] | undefined {
  if (!attendees) return undefined;

  return attendees
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email.length > 0)
    .map((email) => ({ email }));
}

/**
 * Format event for response.
 */
export function formatEvent(event: calendar_v3.Schema$Event): Record<string, unknown> {
  return {
    id: event.id,
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: event.start,
    end: event.end,
    status: event.status,
    htmlLink: event.htmlLink,
    created: event.created,
    updated: event.updated,
    creator: event.creator,
    organizer: event.organizer,
    attendees: event.attendees?.map((a) => ({
      email: a.email,
      displayName: a.displayName,
      responseStatus: a.responseStatus,
      organizer: a.organizer,
      self: a.self,
    })),
    recurrence: event.recurrence,
    recurringEventId: event.recurringEventId,
    colorId: event.colorId,
    visibility: event.visibility,
    conferenceData: event.conferenceData
      ? {
          conferenceId: event.conferenceData.conferenceId,
          conferenceSolution: event.conferenceData.conferenceSolution,
          entryPoints: event.conferenceData.entryPoints,
        }
      : undefined,
    reminders: event.reminders,
  };
}

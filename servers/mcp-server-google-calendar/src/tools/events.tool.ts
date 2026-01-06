import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createCalendarClient, formatEvent, parseAttendees } from "../utils/calendar-client.js";
import { logger } from "../utils/logger.js";

/**
 * List events from a calendar.
 */
server.tool(
  "calendar_list_events",
  {
    calendarId: z.string().optional().describe("Calendar ID (default: 'primary')"),
    timeMin: z.string().optional().describe("Start of time range (ISO 8601 format)"),
    timeMax: z.string().optional().describe("End of time range (ISO 8601 format)"),
    maxResults: z.number().min(1).max(2500).optional().describe("Maximum number of events (default 10)"),
    q: z.string().optional().describe("Free text search terms"),
    singleEvents: z.boolean().optional().describe("Expand recurring events into instances (default true)"),
    orderBy: z.enum(["startTime", "updated"]).optional().describe("Order by (requires singleEvents=true for startTime)"),
    pageToken: z.string().optional().describe("Page token for pagination"),
  },
  async ({ calendarId = "primary", timeMin, timeMax, maxResults = 10, q, singleEvents = true, orderBy, pageToken }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Calendar token available" }] };
    }

    try {
      const calendar = createCalendarClient(token);
      const response = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        maxResults,
        q,
        singleEvents,
        orderBy: orderBy || (singleEvents ? "startTime" : undefined),
        pageToken,
      });

      const events = response.data.items || [];
      const result = {
        events: events.map(formatEvent),
        nextPageToken: response.data.nextPageToken,
        summary: response.data.summary,
        timeZone: response.data.timeZone,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list events", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing events: ${message}` }] };
    }
  }
);

/**
 * Get a specific event by ID.
 */
server.tool(
  "calendar_get_event",
  {
    calendarId: z.string().optional().describe("Calendar ID (default: 'primary')"),
    eventId: z.string().describe("The event ID to retrieve"),
  },
  async ({ calendarId = "primary", eventId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Calendar token available" }] };
    }

    try {
      const calendar = createCalendarClient(token);
      const response = await calendar.events.get({
        calendarId,
        eventId,
      });

      return { content: [{ type: "text", text: JSON.stringify(formatEvent(response.data), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get event", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting event: ${message}` }] };
    }
  }
);

/**
 * Create a new event.
 */
server.tool(
  "calendar_create_event",
  {
    calendarId: z.string().optional().describe("Calendar ID (default: 'primary')"),
    summary: z.string().describe("Event title"),
    description: z.string().optional().describe("Event description"),
    location: z.string().optional().describe("Event location"),
    startDateTime: z.string().describe("Start date-time (ISO 8601 format)"),
    endDateTime: z.string().describe("End date-time (ISO 8601 format)"),
    timeZone: z.string().optional().describe("Time zone (e.g., 'America/New_York')"),
    isAllDay: z.boolean().optional().describe("Set to true for all-day events"),
    attendees: z.string().optional().describe("Comma-separated list of attendee emails"),
    sendUpdates: z.enum(["all", "externalOnly", "none"]).optional().describe("Who to send notifications to"),
    colorId: z.string().optional().describe("Event color ID (1-11)"),
    visibility: z.enum(["default", "public", "private", "confidential"]).optional().describe("Event visibility"),
    recurrence: z.array(z.string()).optional().describe("Recurrence rules (RRULE format)"),
  },
  async ({
    calendarId = "primary",
    summary,
    description,
    location,
    startDateTime,
    endDateTime,
    timeZone,
    isAllDay,
    attendees,
    sendUpdates,
    colorId,
    visibility,
    recurrence,
  }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Calendar token available" }] };
    }

    try {
      const calendar = createCalendarClient(token);

      const eventBody: Record<string, unknown> = {
        summary,
        description,
        location,
        colorId,
        visibility,
        recurrence,
        attendees: parseAttendees(attendees),
      };

      if (isAllDay) {
        // All-day events use date instead of dateTime
        eventBody.start = { date: startDateTime.split("T")[0] };
        eventBody.end = { date: endDateTime.split("T")[0] };
      } else {
        eventBody.start = timeZone ? { dateTime: startDateTime, timeZone } : { dateTime: startDateTime };
        eventBody.end = timeZone ? { dateTime: endDateTime, timeZone } : { dateTime: endDateTime };
      }

      const response = await calendar.events.insert({
        calendarId,
        sendUpdates,
        requestBody: eventBody,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                event: formatEvent(response.data),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create event", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating event: ${message}` }] };
    }
  }
);

/**
 * Update an existing event.
 */
server.tool(
  "calendar_update_event",
  {
    calendarId: z.string().optional().describe("Calendar ID (default: 'primary')"),
    eventId: z.string().describe("The event ID to update"),
    summary: z.string().optional().describe("Event title"),
    description: z.string().optional().describe("Event description"),
    location: z.string().optional().describe("Event location"),
    startDateTime: z.string().optional().describe("Start date-time (ISO 8601 format)"),
    endDateTime: z.string().optional().describe("End date-time (ISO 8601 format)"),
    timeZone: z.string().optional().describe("Time zone (e.g., 'America/New_York')"),
    isAllDay: z.boolean().optional().describe("Set to true for all-day events"),
    attendees: z.string().optional().describe("Comma-separated list of attendee emails"),
    sendUpdates: z.enum(["all", "externalOnly", "none"]).optional().describe("Who to send notifications to"),
    colorId: z.string().optional().describe("Event color ID (1-11)"),
    visibility: z.enum(["default", "public", "private", "confidential"]).optional().describe("Event visibility"),
  },
  async ({
    calendarId = "primary",
    eventId,
    summary,
    description,
    location,
    startDateTime,
    endDateTime,
    timeZone,
    isAllDay,
    attendees,
    sendUpdates,
    colorId,
    visibility,
  }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Calendar token available" }] };
    }

    try {
      const calendar = createCalendarClient(token);

      // First get the existing event
      const existingEvent = await calendar.events.get({ calendarId, eventId });
      const eventBody: Record<string, unknown> = { ...existingEvent.data };

      // Update only provided fields
      if (summary !== undefined) eventBody.summary = summary;
      if (description !== undefined) eventBody.description = description;
      if (location !== undefined) eventBody.location = location;
      if (colorId !== undefined) eventBody.colorId = colorId;
      if (visibility !== undefined) eventBody.visibility = visibility;
      if (attendees !== undefined) eventBody.attendees = parseAttendees(attendees);

      if (startDateTime && endDateTime) {
        if (isAllDay) {
          eventBody.start = { date: startDateTime.split("T")[0] };
          eventBody.end = { date: endDateTime.split("T")[0] };
        } else {
          eventBody.start = timeZone ? { dateTime: startDateTime, timeZone } : { dateTime: startDateTime };
          eventBody.end = timeZone ? { dateTime: endDateTime, timeZone } : { dateTime: endDateTime };
        }
      }

      const response = await calendar.events.update({
        calendarId,
        eventId,
        sendUpdates,
        requestBody: eventBody,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                event: formatEvent(response.data),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update event", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating event: ${message}` }] };
    }
  }
);

/**
 * Delete an event.
 */
server.tool(
  "calendar_delete_event",
  {
    calendarId: z.string().optional().describe("Calendar ID (default: 'primary')"),
    eventId: z.string().describe("The event ID to delete"),
    sendUpdates: z.enum(["all", "externalOnly", "none"]).optional().describe("Who to send cancellation notifications to"),
  },
  async ({ calendarId = "primary", eventId, sendUpdates }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Calendar token available" }] };
    }

    try {
      const calendar = createCalendarClient(token);
      await calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates,
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, eventId, deleted: true }, null, 2) }],
      };
    } catch (error) {
      logger.error("Failed to delete event", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting event: ${message}` }] };
    }
  }
);

/**
 * Quick add event from natural language text.
 */
server.tool(
  "calendar_quick_add",
  {
    calendarId: z.string().optional().describe("Calendar ID (default: 'primary')"),
    text: z.string().describe("Natural language event description (e.g., 'Lunch with John tomorrow at noon')"),
    sendUpdates: z.enum(["all", "externalOnly", "none"]).optional().describe("Who to send notifications to"),
  },
  async ({ calendarId = "primary", text, sendUpdates }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Calendar token available" }] };
    }

    try {
      const calendar = createCalendarClient(token);
      const response = await calendar.events.quickAdd({
        calendarId,
        text,
        sendUpdates,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                event: formatEvent(response.data),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to quick add event", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error quick adding event: ${message}` }] };
    }
  }
);

logger.info("Google Calendar event tools registered");

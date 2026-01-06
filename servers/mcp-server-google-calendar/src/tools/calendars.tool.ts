import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createCalendarClient } from "../utils/calendar-client.js";
import { logger } from "../utils/logger.js";

/**
 * List all calendars accessible by the user.
 */
server.tool(
  "calendar_list_calendars",
  {
    showHidden: z.boolean().optional().describe("Whether to show hidden calendars"),
    showDeleted: z.boolean().optional().describe("Whether to include deleted calendars"),
  },
  async ({ showHidden, showDeleted }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Calendar token available" }] };
    }

    try {
      const calendar = createCalendarClient(token);
      const response = await calendar.calendarList.list({
        showHidden,
        showDeleted,
      });

      const calendars = response.data.items || [];
      const result = calendars.map((cal) => ({
        id: cal.id,
        summary: cal.summary,
        description: cal.description,
        timeZone: cal.timeZone,
        colorId: cal.colorId,
        backgroundColor: cal.backgroundColor,
        foregroundColor: cal.foregroundColor,
        accessRole: cal.accessRole,
        primary: cal.primary,
        selected: cal.selected,
      }));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list calendars", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing calendars: ${message}` }] };
    }
  }
);

/**
 * Get a specific calendar by ID.
 */
server.tool(
  "calendar_get_calendar",
  {
    calendarId: z.string().describe("Calendar ID to retrieve"),
  },
  async ({ calendarId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Calendar token available" }] };
    }

    try {
      const calendar = createCalendarClient(token);
      const response = await calendar.calendars.get({
        calendarId,
      });

      const cal = response.data;
      const result = {
        id: cal.id,
        summary: cal.summary,
        description: cal.description,
        timeZone: cal.timeZone,
        location: cal.location,
        etag: cal.etag,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to get calendar", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting calendar: ${message}` }] };
    }
  }
);

/**
 * Create a new calendar.
 */
server.tool(
  "calendar_create_calendar",
  {
    summary: z.string().describe("Calendar name"),
    description: z.string().optional().describe("Calendar description"),
    timeZone: z.string().optional().describe("Time zone (e.g., 'America/New_York')"),
    location: z.string().optional().describe("Geographic location"),
  },
  async ({ summary, description, timeZone, location }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Calendar token available" }] };
    }

    try {
      const calendar = createCalendarClient(token);
      const response = await calendar.calendars.insert({
        requestBody: {
          summary,
          description,
          timeZone,
          location,
        },
      });

      const cal = response.data;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                calendar: {
                  id: cal.id,
                  summary: cal.summary,
                  description: cal.description,
                  timeZone: cal.timeZone,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create calendar", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating calendar: ${message}` }] };
    }
  }
);

/**
 * Update an existing calendar.
 */
server.tool(
  "calendar_update_calendar",
  {
    calendarId: z.string().describe("Calendar ID to update"),
    summary: z.string().optional().describe("Calendar name"),
    description: z.string().optional().describe("Calendar description"),
    timeZone: z.string().optional().describe("Time zone (e.g., 'America/New_York')"),
    location: z.string().optional().describe("Geographic location"),
  },
  async ({ calendarId, summary, description, timeZone, location }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Calendar token available" }] };
    }

    try {
      const calendar = createCalendarClient(token);

      // Get existing calendar first
      const existing = await calendar.calendars.get({ calendarId });
      const requestBody: Record<string, unknown> = { ...existing.data };

      // Update only provided fields
      if (summary !== undefined) requestBody.summary = summary;
      if (description !== undefined) requestBody.description = description;
      if (timeZone !== undefined) requestBody.timeZone = timeZone;
      if (location !== undefined) requestBody.location = location;

      const response = await calendar.calendars.update({
        calendarId,
        requestBody,
      });

      const cal = response.data;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                calendar: {
                  id: cal.id,
                  summary: cal.summary,
                  description: cal.description,
                  timeZone: cal.timeZone,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update calendar", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating calendar: ${message}` }] };
    }
  }
);

/**
 * Delete a calendar.
 */
server.tool(
  "calendar_delete_calendar",
  {
    calendarId: z.string().describe("Calendar ID to delete (cannot delete primary calendar)"),
  },
  async ({ calendarId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Calendar token available" }] };
    }

    if (calendarId === "primary") {
      return { content: [{ type: "text", text: "Error: Cannot delete the primary calendar" }] };
    }

    try {
      const calendar = createCalendarClient(token);
      await calendar.calendars.delete({
        calendarId,
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, calendarId, deleted: true }, null, 2) }],
      };
    } catch (error) {
      logger.error("Failed to delete calendar", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting calendar: ${message}` }] };
    }
  }
);

logger.info("Google Calendar calendar tools registered");

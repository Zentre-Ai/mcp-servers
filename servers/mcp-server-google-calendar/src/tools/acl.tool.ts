import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createCalendarClient } from "../utils/calendar-client.js";
import { logger } from "../utils/logger.js";

/**
 * List access control rules for a calendar.
 */
server.tool(
  "calendar_list_acl",
  {
    calendarId: z.string().optional().describe("Calendar ID (default: 'primary')"),
    showDeleted: z.boolean().optional().describe("Whether to include deleted ACL rules"),
  },
  async ({ calendarId = "primary", showDeleted }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Calendar token available" }] };
    }

    try {
      const calendar = createCalendarClient(token);
      const response = await calendar.acl.list({
        calendarId,
        showDeleted,
      });

      const rules = response.data.items || [];
      const result = rules.map((rule) => ({
        id: rule.id,
        role: rule.role,
        scope: rule.scope,
        etag: rule.etag,
      }));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list ACL", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing ACL: ${message}` }] };
    }
  }
);

/**
 * Add an access control rule to share a calendar.
 */
server.tool(
  "calendar_add_acl",
  {
    calendarId: z.string().optional().describe("Calendar ID (default: 'primary')"),
    role: z.enum(["none", "freeBusyReader", "reader", "writer", "owner"]).describe("Access role to grant"),
    scopeType: z.enum(["default", "user", "group", "domain"]).describe("Type of scope"),
    scopeValue: z.string().optional().describe("Email address or domain (required for user, group, domain scopes)"),
    sendNotifications: z.boolean().optional().describe("Whether to send notifications about the calendar sharing change"),
  },
  async ({ calendarId = "primary", role, scopeType, scopeValue, sendNotifications }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Calendar token available" }] };
    }

    // Validate scope value is provided when needed
    if (scopeType !== "default" && !scopeValue) {
      return {
        content: [{ type: "text", text: "Error: scopeValue is required for user, group, and domain scope types" }],
      };
    }

    try {
      const calendar = createCalendarClient(token);

      const scope: { type: string; value?: string } = { type: scopeType };
      if (scopeValue) {
        scope.value = scopeValue;
      }

      const response = await calendar.acl.insert({
        calendarId,
        sendNotifications,
        requestBody: {
          role,
          scope,
        },
      });

      const rule = response.data;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                aclRule: {
                  id: rule.id,
                  role: rule.role,
                  scope: rule.scope,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to add ACL", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error adding ACL: ${message}` }] };
    }
  }
);

/**
 * Remove an access control rule from a calendar.
 */
server.tool(
  "calendar_remove_acl",
  {
    calendarId: z.string().optional().describe("Calendar ID (default: 'primary')"),
    ruleId: z.string().describe("ACL rule ID to remove (e.g., 'user:email@example.com')"),
  },
  async ({ calendarId = "primary", ruleId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Calendar token available" }] };
    }

    try {
      const calendar = createCalendarClient(token);
      await calendar.acl.delete({
        calendarId,
        ruleId,
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, ruleId, removed: true }, null, 2) }],
      };
    } catch (error) {
      logger.error("Failed to remove ACL", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error removing ACL: ${message}` }] };
    }
  }
);

logger.info("Google Calendar ACL tools registered");

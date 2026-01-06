import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { grafanaRequest } from "../utils/grafana-client.js";
import { logger } from "../utils/logger.js";

const ONCALL_API_BASE = "/api/plugins/grafana-oncall-app/resources/api/v1";

/**
 * List OnCall schedules.
 */
server.tool(
  "grafana_list_oncall_schedules",
  {
    teamId: z.string().optional().describe("Filter by team ID"),
    scheduleId: z.string().optional().describe("Get specific schedule by ID"),
  },
  async ({ teamId, scheduleId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      let path = `${ONCALL_API_BASE}/schedules`;
      const params = new URLSearchParams();
      if (teamId) params.append("team_id", teamId);
      if (scheduleId) path = `${ONCALL_API_BASE}/schedules/${scheduleId}`;

      const queryString = params.toString();
      const fullPath = scheduleId ? path : queryString ? `${path}?${queryString}` : path;

      const result = await grafanaRequest<Record<string, unknown>>(auth, fullPath);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list OnCall schedules", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing OnCall schedules: ${message}` }] };
    }
  }
);

/**
 * Get OnCall shift details.
 */
server.tool(
  "grafana_get_oncall_shift",
  {
    shiftId: z.string().describe("Shift ID"),
  },
  async ({ shiftId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `${ONCALL_API_BASE}/on_call_shifts/${shiftId}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get OnCall shift", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting OnCall shift: ${message}` }] };
    }
  }
);

/**
 * Get current on-call users for a schedule.
 */
server.tool(
  "grafana_get_current_oncall_users",
  {
    scheduleId: z.string().describe("Schedule ID"),
  },
  async ({ scheduleId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const schedule = await grafanaRequest<Record<string, unknown>>(
        auth,
        `${ONCALL_API_BASE}/schedules/${scheduleId}`
      );

      // Extract on-call now information
      const onCallNow = schedule.on_call_now || [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                scheduleId,
                scheduleName: schedule.name,
                onCallUsers: onCallNow,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get current OnCall users", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting current OnCall users: ${message}` }] };
    }
  }
);

/**
 * List OnCall teams.
 */
server.tool(
  "grafana_list_oncall_teams",
  {
    page: z.number().optional().describe("Page number for pagination"),
    perPage: z.number().optional().describe("Results per page"),
  },
  async ({ page, perPage }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const params = new URLSearchParams();
      if (page) params.append("page", page.toString());
      if (perPage) params.append("perpage", perPage.toString());

      const queryString = params.toString();
      const path = queryString
        ? `${ONCALL_API_BASE}/teams?${queryString}`
        : `${ONCALL_API_BASE}/teams`;

      const result = await grafanaRequest<Record<string, unknown>>(auth, path);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list OnCall teams", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing OnCall teams: ${message}` }] };
    }
  }
);

/**
 * List OnCall users.
 */
server.tool(
  "grafana_list_oncall_users",
  {
    userId: z.string().optional().describe("Get specific user by ID"),
    username: z.string().optional().describe("Filter by username"),
  },
  async ({ userId, username }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      let path = `${ONCALL_API_BASE}/users`;
      const params = new URLSearchParams();

      if (userId) {
        path = `${ONCALL_API_BASE}/users/${userId}`;
      } else if (username) {
        params.append("username", username);
      }

      const queryString = params.toString();
      const fullPath = userId ? path : queryString ? `${path}?${queryString}` : path;

      const result = await grafanaRequest<Record<string, unknown>>(auth, fullPath);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list OnCall users", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing OnCall users: ${message}` }] };
    }
  }
);

/**
 * List OnCall alert groups.
 */
server.tool(
  "grafana_list_alert_groups",
  {
    alertGroupId: z.string().optional().describe("Get specific alert group by ID"),
    routeId: z.string().optional().describe("Filter by route ID"),
    integrationId: z.string().optional().describe("Filter by integration ID"),
    state: z.enum(["new", "acknowledged", "resolved", "silenced"]).optional().describe("Filter by state"),
    teamId: z.string().optional().describe("Filter by team ID"),
    startedAt: z.string().optional().describe("Filter by start time (RFC3339)"),
    labels: z.array(z.string()).optional().describe("Filter by labels (key=value format)"),
  },
  async ({ alertGroupId, routeId, integrationId, state, teamId, startedAt, labels }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      let path = `${ONCALL_API_BASE}/alert_groups`;
      const params = new URLSearchParams();

      if (alertGroupId) {
        path = `${ONCALL_API_BASE}/alert_groups/${alertGroupId}`;
      } else {
        if (routeId) params.append("route_id", routeId);
        if (integrationId) params.append("integration_id", integrationId);
        if (state) params.append("state", state);
        if (teamId) params.append("team_id", teamId);
        if (startedAt) params.append("started_at", startedAt);
        if (labels) labels.forEach((l) => params.append("label", l));
      }

      const queryString = params.toString();
      const fullPath = alertGroupId ? path : queryString ? `${path}?${queryString}` : path;

      const result = await grafanaRequest<Record<string, unknown>>(auth, fullPath);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list alert groups", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing alert groups: ${message}` }] };
    }
  }
);

/**
 * Get specific alert group.
 */
server.tool(
  "grafana_get_alert_group",
  {
    alertGroupId: z.string().describe("Alert group ID"),
  },
  async ({ alertGroupId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `${ONCALL_API_BASE}/alert_groups/${alertGroupId}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get alert group", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting alert group: ${message}` }] };
    }
  }
);

logger.info("Grafana OnCall tools registered");

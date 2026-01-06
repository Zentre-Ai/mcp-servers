import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { grafanaRequest } from "../utils/grafana-client.js";
import { logger } from "../utils/logger.js";

/**
 * List teams.
 */
server.tool(
  "grafana_list_teams",
  {
    query: z.string().optional().describe("Search query for team name"),
    page: z.number().optional().describe("Page number"),
    perPage: z.number().optional().describe("Results per page"),
  },
  async ({ query, page, perPage }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const params = new URLSearchParams();
      if (query) params.append("query", query);
      if (page) params.append("page", page.toString());
      if (perPage) params.append("perpage", perPage.toString());

      const result = await grafanaRequest<{ teams: Array<Record<string, unknown>>; totalCount: number }>(
        auth,
        `/api/teams/search?${params.toString()}`
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
      logger.error("Failed to list teams", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing teams: ${message}` }] };
    }
  }
);

/**
 * List users by organization.
 */
server.tool(
  "grafana_list_users_by_org",
  {
    page: z.number().optional().describe("Page number"),
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

      const result = await grafanaRequest<Array<Record<string, unknown>>>(
        auth,
        `/api/org/users?${params.toString()}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ users: result, total: result.length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list org users", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing org users: ${message}` }] };
    }
  }
);

/**
 * List all RBAC roles.
 */
server.tool(
  "grafana_list_all_roles",
  {
    delegatable: z.boolean().optional().describe("Only show roles that can be delegated"),
  },
  async ({ delegatable }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const params = new URLSearchParams();
      if (delegatable !== undefined) params.append("delegatable", delegatable.toString());

      const result = await grafanaRequest<Array<Record<string, unknown>>>(
        auth,
        `/api/access-control/roles?${params.toString()}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ roles: result, total: result.length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list roles", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing roles: ${message}` }] };
    }
  }
);

/**
 * Get role details by UID.
 */
server.tool(
  "grafana_get_role_details",
  {
    roleUid: z.string().describe("Role UID"),
  },
  async ({ roleUid }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `/api/access-control/roles/${roleUid}`
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
      logger.error("Failed to get role details", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting role details: ${message}` }] };
    }
  }
);

/**
 * Get role assignments.
 */
server.tool(
  "grafana_get_role_assignments",
  {
    roleUid: z.string().describe("Role UID"),
  },
  async ({ roleUid }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `/api/access-control/roles/${roleUid}/assignments`
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
      logger.error("Failed to get role assignments", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting role assignments: ${message}` }] };
    }
  }
);

/**
 * List roles for users.
 */
server.tool(
  "grafana_list_user_roles",
  {
    userIds: z.array(z.number()).describe("List of user IDs"),
  },
  async ({ userIds }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        "/api/access-control/users/roles/search",
        {
          method: "POST",
          body: JSON.stringify({ userIds }),
        }
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
      logger.error("Failed to list user roles", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing user roles: ${message}` }] };
    }
  }
);

/**
 * List roles for teams.
 */
server.tool(
  "grafana_list_team_roles",
  {
    teamIds: z.array(z.number()).describe("List of team IDs"),
  },
  async ({ teamIds }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        "/api/access-control/teams/roles/search",
        {
          method: "POST",
          body: JSON.stringify({ teamIds }),
        }
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
      logger.error("Failed to list team roles", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing team roles: ${message}` }] };
    }
  }
);

/**
 * Get resource permissions.
 */
server.tool(
  "grafana_get_resource_permissions",
  {
    resourceType: z.enum(["dashboards", "datasources", "folders", "teams", "serviceaccounts"]).describe("Resource type"),
    resourceId: z.string().describe("Resource ID or UID"),
  },
  async ({ resourceType, resourceId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const result = await grafanaRequest<Array<Record<string, unknown>>>(
        auth,
        `/api/access-control/${resourceType}/${resourceId}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ permissions: result, total: result.length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get resource permissions", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting resource permissions: ${message}` }] };
    }
  }
);

/**
 * Get resource permission description.
 */
server.tool(
  "grafana_get_resource_description",
  {
    resourceType: z.enum(["dashboards", "datasources", "folders", "teams", "serviceaccounts"]).describe("Resource type"),
  },
  async ({ resourceType }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `/api/access-control/${resourceType}/description`
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
      logger.error("Failed to get resource description", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting resource description: ${message}` }] };
    }
  }
);

logger.info("Grafana admin tools registered");

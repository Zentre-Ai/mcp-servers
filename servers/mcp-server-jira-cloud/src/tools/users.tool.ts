import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createJiraCloudClient, formatUser } from "../utils/jira-cloud-client.js";
import { logger } from "../utils/logger.js";

/**
 * Get current user info.
 */
server.tool(
  "jira_cloud_get_myself",
  {},
  async () => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira Cloud credentials available" }] };
    }

    try {
      const client = createJiraCloudClient(auth);
      const user = await client.get<Record<string, unknown>>("/myself");

      return { content: [{ type: "text", text: JSON.stringify(formatUser(user), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get current user", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting current user: ${message}` }] };
    }
  }
);

/**
 * Get a user by account ID.
 */
server.tool(
  "jira_cloud_get_user",
  {
    accountId: z.string().describe("User account ID"),
  },
  async ({ accountId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira Cloud credentials available" }] };
    }

    try {
      const client = createJiraCloudClient(auth);
      const user = await client.get<Record<string, unknown>>("/user", { accountId });

      return { content: [{ type: "text", text: JSON.stringify(formatUser(user), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get user", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting user: ${message}` }] };
    }
  }
);

/**
 * Search for users.
 */
server.tool(
  "jira_cloud_search_users",
  {
    query: z.string().describe("Search query (name, email, or username)"),
    maxResults: z.number().optional().describe("Maximum number of results (default 50)"),
    startAt: z.number().optional().describe("Index of first result"),
  },
  async ({ query, maxResults, startAt }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira Cloud credentials available" }] };
    }

    try {
      const client = createJiraCloudClient(auth);
      const users = await client.get<Array<Record<string, unknown>>>("/user/search", {
        query,
        maxResults,
        startAt,
      });

      const result = users.map(formatUser);

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to search users", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error searching users: ${message}` }] };
    }
  }
);

/**
 * Find users assignable to an issue.
 */
server.tool(
  "jira_cloud_assignable_users",
  {
    issueKey: z.string().optional().describe("Issue key to find assignable users for"),
    project: z.string().optional().describe("Project key to find assignable users for"),
    query: z.string().optional().describe("Filter by user name or email"),
    maxResults: z.number().optional().describe("Maximum number of results (default 50)"),
  },
  async ({ issueKey, project, query, maxResults }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira Cloud credentials available" }] };
    }

    if (!issueKey && !project) {
      return { content: [{ type: "text", text: "Error: Either issueKey or project must be provided" }] };
    }

    try {
      const client = createJiraCloudClient(auth);

      const params: Record<string, string | number | undefined> = { maxResults };

      if (issueKey) {
        params.issueKey = issueKey;
      }
      if (project) {
        params.project = project;
      }
      if (query) {
        params.query = query;
      }

      const users = await client.get<Array<Record<string, unknown>>>("/user/assignable/search", params);

      const result = users.map(formatUser);

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to find assignable users", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error finding assignable users: ${message}` }] };
    }
  }
);

/**
 * Get project members/roles.
 */
server.tool(
  "jira_cloud_get_project_roles",
  {
    projectIdOrKey: z.string().describe("Project key or ID"),
  },
  async ({ projectIdOrKey }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira Cloud credentials available" }] };
    }

    try {
      const client = createJiraCloudClient(auth);
      const roles = await client.get<Record<string, string>>(`/project/${projectIdOrKey}/role`);

      // roles is an object with role names as keys and URLs as values
      // We need to fetch each role to get the actors
      const roleDetails = await Promise.all(
        Object.entries(roles).map(async ([roleName, roleUrl]) => {
          try {
            // Extract role ID from URL
            const roleId = roleUrl.split("/").pop();
            const role = await client.get<Record<string, unknown>>(
              `/project/${projectIdOrKey}/role/${roleId}`
            );

            const actors = ((role.actors || []) as Array<Record<string, unknown>>).map((a) => ({
              id: a.id,
              displayName: a.displayName,
              type: a.type,
              actorUser: a.actorUser,
              actorGroup: a.actorGroup,
            }));

            return {
              name: roleName,
              id: role.id,
              description: role.description,
              actors,
            };
          } catch {
            return { name: roleName, error: "Failed to fetch role details" };
          }
        })
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ projectIdOrKey, roles: roleDetails }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get project roles", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting project roles: ${message}` }] };
    }
  }
);

logger.info("Jira Cloud user tools registered");

import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createGitLabClient, formatUser, formatGroup } from "../utils/gitlab-client.js";
import { logger } from "../utils/logger.js";

/**
 * Get current authenticated user.
 */
server.tool("gitlab_get_current_user", {}, async () => {
  const auth = getCurrentAuth();
  if (!auth) {
    return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
  }

  try {
    const client = createGitLabClient(auth);
    const user = await client.get<Record<string, unknown>>("/user");

    return { content: [{ type: "text", text: JSON.stringify(formatUser(user), null, 2) }] };
  } catch (error) {
    logger.error("Failed to get current user", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { content: [{ type: "text", text: `Error getting current user: ${message}` }] };
  }
});

/**
 * Get a user by ID.
 */
server.tool(
  "gitlab_get_user",
  {
    userId: z.number().describe("User ID"),
  },
  async ({ userId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const user = await client.get<Record<string, unknown>>(`/users/${userId}`);

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
  "gitlab_search_users",
  {
    search: z.string().describe("Search query (username, name, or email)"),
    perPage: z.number().optional().describe("Number of results per page (default 20, max 100)"),
    page: z.number().optional().describe("Page number (default 1)"),
  },
  async ({ search, perPage, page }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const users = await client.get<Array<Record<string, unknown>>>("/users", {
        search,
        per_page: perPage,
        page,
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
 * List groups.
 */
server.tool(
  "gitlab_list_groups",
  {
    search: z.string().optional().describe("Search query for group name"),
    owned: z.boolean().optional().describe("Limit to groups owned by current user"),
    minAccessLevel: z
      .number()
      .optional()
      .describe("Minimum access level (10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner)"),
    topLevelOnly: z.boolean().optional().describe("Limit to top-level groups only"),
    perPage: z.number().optional().describe("Number of results per page (default 20, max 100)"),
    page: z.number().optional().describe("Page number (default 1)"),
  },
  async ({ search, owned, minAccessLevel, topLevelOnly, perPage, page }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const groups = await client.get<Array<Record<string, unknown>>>("/groups", {
        search,
        owned,
        min_access_level: minAccessLevel,
        top_level_only: topLevelOnly,
        per_page: perPage,
        page,
      });

      const result = groups.map(formatGroup);

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list groups", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing groups: ${message}` }] };
    }
  }
);

/**
 * Get a group by ID or path.
 */
server.tool(
  "gitlab_get_group",
  {
    groupId: z.string().describe("Group ID or URL-encoded path"),
    withProjects: z.boolean().optional().describe("Include group projects"),
  },
  async ({ groupId, withProjects }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(groupId);
      const group = await client.get<Record<string, unknown>>(`/groups/${encodedId}`, {
        with_projects: withProjects,
      });

      return { content: [{ type: "text", text: JSON.stringify(formatGroup(group), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get group", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting group: ${message}` }] };
    }
  }
);

logger.info("GitLab user tools registered");

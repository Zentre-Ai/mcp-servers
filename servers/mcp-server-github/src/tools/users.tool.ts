import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createGitHubClient, formatUser } from "../utils/github-client.js";
import { logger } from "../utils/logger.js";

/**
 * Get authenticated user info.
 */
server.tool(
  "github_get_me",
  {},
  async () => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.users.getAuthenticated();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatUser(response.data as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get authenticated user", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting authenticated user: ${message}` }] };
    }
  }
);

/**
 * Get a user by username.
 */
server.tool(
  "github_get_user",
  {
    username: z.string().describe("GitHub username"),
  },
  async ({ username }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.users.getByUsername({ username });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatUser(response.data as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get user", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting user: ${message}` }] };
    }
  }
);

/**
 * List organization members.
 */
server.tool(
  "github_list_org_members",
  {
    org: z.string().describe("Organization name"),
    filter: z.enum(["2fa_disabled", "all"]).optional().describe("Filter members"),
    role: z.enum(["all", "admin", "member"]).optional().describe("Filter by role"),
    perPage: z.number().optional().describe("Results per page (max 100)"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ org, filter, role, perPage, page }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.orgs.listMembers({
        org,
        filter: filter as "2fa_disabled" | "all" | undefined,
        role: role as "all" | "admin" | "member" | undefined,
        per_page: perPage,
        page,
      });

      const result = response.data.map((u) => ({
        id: u.id,
        login: u.login,
        avatarUrl: u.avatar_url,
        url: u.html_url,
        type: u.type,
        siteAdmin: u.site_admin,
      }));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list org members", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing org members: ${message}` }] };
    }
  }
);

/**
 * Search for users.
 */
server.tool(
  "github_search_users",
  {
    query: z.string().describe("Search query (e.g., 'fullname:John type:user')"),
    sort: z.enum(["followers", "repositories", "joined"]).optional().describe("Sort field"),
    order: z.enum(["asc", "desc"]).optional().describe("Sort order"),
    perPage: z.number().optional().describe("Results per page (max 100)"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ query, sort, order, perPage, page }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.search.users({
        q: query,
        sort: sort as "followers" | "repositories" | "joined" | undefined,
        order: order as "asc" | "desc" | undefined,
        per_page: perPage,
        page,
      });

      const result = {
        totalCount: response.data.total_count,
        incompleteResults: response.data.incomplete_results,
        items: response.data.items.map((u) => ({
          id: u.id,
          login: u.login,
          avatarUrl: u.avatar_url,
          url: u.html_url,
          type: u.type,
          score: u.score,
        })),
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to search users", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error searching users: ${message}` }] };
    }
  }
);

logger.info("GitHub user tools registered");

import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createSlackClient, formatUser } from "../utils/slack-client.js";
import { logger } from "../utils/logger.js";

/**
 * List users in the workspace.
 */
server.tool(
  "slack_list_users",
  {
    limit: z.number().min(1).max(1000).optional().describe("Number of users to return (default 100)"),
    cursor: z.string().optional().describe("Pagination cursor"),
    includeLocale: z.boolean().optional().describe("Include locale information"),
  },
  async ({ limit = 100, cursor, includeLocale }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.users.list({
        limit,
        cursor,
        include_locale: includeLocale,
      });

      const users = (response.members || []) as Record<string, unknown>[];
      const result = {
        users: users.map(formatUser),
        nextCursor: response.response_metadata?.next_cursor,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list users", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing users: ${message}` }] };
    }
  }
);

/**
 * Get user info.
 */
server.tool(
  "slack_get_user",
  {
    user: z.string().describe("User ID to get info for"),
    includeLocale: z.boolean().optional().describe("Include locale information"),
  },
  async ({ user, includeLocale }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.users.info({
        user,
        include_locale: includeLocale,
      });

      const userData = response.user as Record<string, unknown>;
      return { content: [{ type: "text", text: JSON.stringify(formatUser(userData), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get user", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting user: ${message}` }] };
    }
  }
);

/**
 * Look up user by email.
 */
server.tool(
  "slack_lookup_user_by_email",
  {
    email: z.string().email().describe("Email address to look up"),
  },
  async ({ email }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.users.lookupByEmail({
        email,
      });

      const userData = response.user as Record<string, unknown>;
      return { content: [{ type: "text", text: JSON.stringify(formatUser(userData), null, 2) }] };
    } catch (error) {
      logger.error("Failed to lookup user", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error looking up user: ${message}` }] };
    }
  }
);

/**
 * Get user presence.
 */
server.tool(
  "slack_get_user_presence",
  {
    user: z.string().describe("User ID to get presence for"),
  },
  async ({ user }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.users.getPresence({
        user,
      });

      const result = {
        userId: user,
        presence: response.presence,
        online: response.online,
        autoAway: response.auto_away,
        manualAway: response.manual_away,
        connectionCount: response.connection_count,
        lastActivity: response.last_activity,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to get presence", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting presence: ${message}` }] };
    }
  }
);

/**
 * Get the current authenticated user.
 */
server.tool(
  "slack_get_me",
  {},
  async () => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.auth.test();

      const result = {
        userId: response.user_id,
        user: response.user,
        teamId: response.team_id,
        team: response.team,
        botId: response.bot_id,
        isEnterpriseInstall: response.is_enterprise_install,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to get current user", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting current user: ${message}` }] };
    }
  }
);

/**
 * Open or get a direct message channel with a user.
 */
server.tool(
  "slack_open_dm",
  {
    users: z.string().describe("Comma-separated list of user IDs (1 for DM, multiple for group DM)"),
    returnIm: z.boolean().optional().describe("Return the full IM object"),
  },
  async ({ users, returnIm }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.conversations.open({
        users,
        return_im: returnIm,
      });

      const channelData = response.channel as Record<string, unknown>;
      const result = {
        success: true,
        channel: {
          id: channelData.id,
          created: channelData.created,
          isIm: channelData.is_im,
          isMpim: channelData.is_mpim,
          user: channelData.user,
        },
        alreadyOpen: response.already_open,
        noOp: response.no_op,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to open DM", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error opening DM: ${message}` }] };
    }
  }
);

logger.info("Slack user tools registered");

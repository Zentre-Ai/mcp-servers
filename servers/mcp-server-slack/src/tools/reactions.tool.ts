import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createSlackClient } from "../utils/slack-client.js";
import { logger } from "../utils/logger.js";

/**
 * Add a reaction to a message.
 */
server.tool(
  "slack_add_reaction",
  {
    channel: z.string().describe("Channel ID where the message exists"),
    timestamp: z.string().describe("Timestamp of the message to react to"),
    name: z.string().describe("Emoji name without colons (e.g., 'thumbsup', 'heart', 'rocket')"),
  },
  async ({ channel, timestamp, name }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      await client.reactions.add({
        channel,
        timestamp,
        name,
      });

      return {
        content: [
          { type: "text", text: JSON.stringify({ success: true, channel, timestamp, reaction: name }, null, 2) },
        ],
      };
    } catch (error) {
      logger.error("Failed to add reaction", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error adding reaction: ${message}` }] };
    }
  }
);

/**
 * Remove a reaction from a message.
 */
server.tool(
  "slack_remove_reaction",
  {
    channel: z.string().describe("Channel ID where the message exists"),
    timestamp: z.string().describe("Timestamp of the message"),
    name: z.string().describe("Emoji name without colons (e.g., 'thumbsup', 'heart', 'rocket')"),
  },
  async ({ channel, timestamp, name }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      await client.reactions.remove({
        channel,
        timestamp,
        name,
      });

      return {
        content: [
          { type: "text", text: JSON.stringify({ success: true, channel, timestamp, removed: name }, null, 2) },
        ],
      };
    } catch (error) {
      logger.error("Failed to remove reaction", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error removing reaction: ${message}` }] };
    }
  }
);

/**
 * Get reactions for a message.
 */
server.tool(
  "slack_get_reactions",
  {
    channel: z.string().describe("Channel ID where the message exists"),
    timestamp: z.string().describe("Timestamp of the message"),
    full: z.boolean().optional().describe("Get full user objects instead of just IDs"),
  },
  async ({ channel, timestamp, full }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.reactions.get({
        channel,
        timestamp,
        full,
      });

      const message = response.message as Record<string, unknown>;
      const reactions = (message?.reactions || []) as Array<{ name: string; count: number; users: string[] }>;

      const result = {
        channel: response.channel,
        message: {
          ts: message?.ts,
          text: message?.text,
          user: message?.user,
        },
        reactions: reactions.map((r) => ({
          name: r.name,
          count: r.count,
          users: r.users,
        })),
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to get reactions", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting reactions: ${message}` }] };
    }
  }
);

/**
 * List items reacted to by a user.
 */
server.tool(
  "slack_list_user_reactions",
  {
    user: z.string().optional().describe("User ID (defaults to current user)"),
    count: z.number().min(1).max(1000).optional().describe("Number of items per page (default 100)"),
    page: z.number().optional().describe("Page number"),
    full: z.boolean().optional().describe("Get full user objects instead of just IDs"),
  },
  async ({ user, count = 100, page, full }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.reactions.list({
        user,
        count,
        page,
        full,
      });

      const items = (response.items || []) as Array<{
        type: string;
        channel?: string;
        message?: Record<string, unknown>;
      }>;

      const result = {
        items: items.map((item) => ({
          type: item.type,
          channel: item.channel,
          message: item.message
            ? {
                ts: item.message.ts,
                text: item.message.text,
                user: item.message.user,
                reactions: item.message.reactions,
              }
            : undefined,
        })),
        paging: response.paging,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list reactions", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing reactions: ${message}` }] };
    }
  }
);

logger.info("Slack reaction tools registered");

import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createSlackClient, formatMessage } from "../utils/slack-client.js";
import { logger } from "../utils/logger.js";

/**
 * Send a message to a channel.
 */
server.tool(
  "slack_post_message",
  {
    channel: z.string().describe("Channel ID or name (e.g., 'C1234567890' or '#general')"),
    text: z.string().describe("Message text (supports Slack markdown)"),
    threadTs: z.string().optional().describe("Thread timestamp to reply to"),
    unfurlLinks: z.boolean().optional().describe("Enable link previews"),
    unfurlMedia: z.boolean().optional().describe("Enable media previews"),
  },
  async ({ channel, text, threadTs, unfurlLinks, unfurlMedia }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.chat.postMessage({
        channel,
        text,
        thread_ts: threadTs,
        unfurl_links: unfurlLinks,
        unfurl_media: unfurlMedia,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                channel: response.channel,
                ts: response.ts,
                message: response.message ? formatMessage(response.message as Record<string, unknown>) : undefined,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to post message", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error posting message: ${message}` }] };
    }
  }
);

/**
 * Update an existing message.
 */
server.tool(
  "slack_update_message",
  {
    channel: z.string().describe("Channel ID where the message exists"),
    ts: z.string().describe("Timestamp of the message to update"),
    text: z.string().describe("New message text"),
  },
  async ({ channel, ts, text }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.chat.update({
        channel,
        ts,
        text,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                channel: response.channel,
                ts: response.ts,
                text: response.text,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update message", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating message: ${message}` }] };
    }
  }
);

/**
 * Delete a message.
 */
server.tool(
  "slack_delete_message",
  {
    channel: z.string().describe("Channel ID where the message exists"),
    ts: z.string().describe("Timestamp of the message to delete"),
  },
  async ({ channel, ts }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      await client.chat.delete({
        channel,
        ts,
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, channel, ts, deleted: true }, null, 2) }],
      };
    } catch (error) {
      logger.error("Failed to delete message", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting message: ${message}` }] };
    }
  }
);

/**
 * Get conversation history (messages from a channel).
 */
server.tool(
  "slack_get_history",
  {
    channel: z.string().describe("Channel ID to get history from"),
    limit: z.number().min(1).max(1000).optional().describe("Number of messages to return (default 20)"),
    oldest: z.string().optional().describe("Start of time range (Unix timestamp)"),
    latest: z.string().optional().describe("End of time range (Unix timestamp)"),
    inclusive: z.boolean().optional().describe("Include messages with oldest/latest timestamps"),
    cursor: z.string().optional().describe("Pagination cursor"),
  },
  async ({ channel, limit = 20, oldest, latest, inclusive, cursor }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.conversations.history({
        channel,
        limit,
        oldest,
        latest,
        inclusive,
        cursor,
      });

      const messages = (response.messages || []) as Record<string, unknown>[];
      const result = {
        messages: messages.map(formatMessage),
        hasMore: response.has_more,
        nextCursor: response.response_metadata?.next_cursor,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to get history", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting history: ${message}` }] };
    }
  }
);

/**
 * Get thread replies.
 */
server.tool(
  "slack_get_thread",
  {
    channel: z.string().describe("Channel ID where the thread exists"),
    ts: z.string().describe("Timestamp of the parent message"),
    limit: z.number().min(1).max(1000).optional().describe("Number of replies to return (default 20)"),
    cursor: z.string().optional().describe("Pagination cursor"),
    inclusive: z.boolean().optional().describe("Include the parent message"),
  },
  async ({ channel, ts, limit = 20, cursor, inclusive = true }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.conversations.replies({
        channel,
        ts,
        limit,
        cursor,
        inclusive,
      });

      const messages = (response.messages || []) as Record<string, unknown>[];
      const result = {
        messages: messages.map(formatMessage),
        hasMore: response.has_more,
        nextCursor: response.response_metadata?.next_cursor,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to get thread", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting thread: ${message}` }] };
    }
  }
);

/**
 * Search messages.
 */
server.tool(
  "slack_search_messages",
  {
    query: z.string().describe("Search query (supports Slack search syntax)"),
    count: z.number().min(1).max(100).optional().describe("Number of results per page (default 20)"),
    sort: z.enum(["score", "timestamp"]).optional().describe("Sort order"),
    sortDir: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ query, count = 20, sort, sortDir, page }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.search.messages({
        query,
        count,
        sort,
        sort_dir: sortDir,
        page,
      });

      const matches = (response.messages?.matches || []) as Array<Record<string, unknown>>;
      const result = {
        query,
        total: response.messages?.total,
        matches: matches.map((m) => ({
          channel: m.channel,
          ts: m.ts,
          text: m.text,
          user: m.user,
          username: m.username,
          permalink: m.permalink,
        })),
        paging: response.messages?.paging,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to search messages", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error searching messages: ${message}` }] };
    }
  }
);

logger.info("Slack message tools registered");

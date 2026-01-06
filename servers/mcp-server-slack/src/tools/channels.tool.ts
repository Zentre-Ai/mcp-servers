import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createSlackClient, formatChannel } from "../utils/slack-client.js";
import { logger } from "../utils/logger.js";

/**
 * List channels in the workspace.
 */
server.tool(
  "slack_list_channels",
  {
    types: z.string().optional().describe("Comma-separated channel types: public_channel, private_channel, mpim, im"),
    excludeArchived: z.boolean().optional().describe("Exclude archived channels (default true)"),
    limit: z.number().min(1).max(1000).optional().describe("Number of channels to return (default 100)"),
    cursor: z.string().optional().describe("Pagination cursor"),
  },
  async ({ types = "public_channel,private_channel", excludeArchived = true, limit = 100, cursor }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.conversations.list({
        types,
        exclude_archived: excludeArchived,
        limit,
        cursor,
      });

      const channels = (response.channels || []) as Record<string, unknown>[];
      const result = {
        channels: channels.map(formatChannel),
        nextCursor: response.response_metadata?.next_cursor,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list channels", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing channels: ${message}` }] };
    }
  }
);

/**
 * Get channel info.
 */
server.tool(
  "slack_get_channel",
  {
    channel: z.string().describe("Channel ID to get info for"),
    includeNumMembers: z.boolean().optional().describe("Include member count"),
  },
  async ({ channel, includeNumMembers = true }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.conversations.info({
        channel,
        include_num_members: includeNumMembers,
      });

      const channelData = response.channel as Record<string, unknown>;
      return { content: [{ type: "text", text: JSON.stringify(formatChannel(channelData), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get channel", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting channel: ${message}` }] };
    }
  }
);

/**
 * Create a new channel.
 */
server.tool(
  "slack_create_channel",
  {
    name: z.string().describe("Channel name (lowercase, no spaces, max 80 chars)"),
    isPrivate: z.boolean().optional().describe("Create as private channel"),
  },
  async ({ name, isPrivate = false }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.conversations.create({
        name,
        is_private: isPrivate,
      });

      const channelData = response.channel as Record<string, unknown>;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                channel: formatChannel(channelData),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create channel", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating channel: ${message}` }] };
    }
  }
);

/**
 * Archive a channel.
 */
server.tool(
  "slack_archive_channel",
  {
    channel: z.string().describe("Channel ID to archive"),
  },
  async ({ channel }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      await client.conversations.archive({
        channel,
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, channel, archived: true }, null, 2) }],
      };
    } catch (error) {
      logger.error("Failed to archive channel", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error archiving channel: ${message}` }] };
    }
  }
);

/**
 * Unarchive a channel.
 */
server.tool(
  "slack_unarchive_channel",
  {
    channel: z.string().describe("Channel ID to unarchive"),
  },
  async ({ channel }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      await client.conversations.unarchive({
        channel,
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, channel, unarchived: true }, null, 2) }],
      };
    } catch (error) {
      logger.error("Failed to unarchive channel", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error unarchiving channel: ${message}` }] };
    }
  }
);

/**
 * Invite users to a channel.
 */
server.tool(
  "slack_invite_to_channel",
  {
    channel: z.string().describe("Channel ID to invite to"),
    users: z.string().describe("Comma-separated list of user IDs to invite"),
  },
  async ({ channel, users }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.conversations.invite({
        channel,
        users,
      });

      const channelData = response.channel as Record<string, unknown>;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                channel: formatChannel(channelData),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to invite to channel", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error inviting to channel: ${message}` }] };
    }
  }
);

/**
 * Kick a user from a channel.
 */
server.tool(
  "slack_kick_from_channel",
  {
    channel: z.string().describe("Channel ID to kick from"),
    user: z.string().describe("User ID to kick"),
  },
  async ({ channel, user }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      await client.conversations.kick({
        channel,
        user,
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, channel, user, removed: true }, null, 2) }],
      };
    } catch (error) {
      logger.error("Failed to kick from channel", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error kicking from channel: ${message}` }] };
    }
  }
);

/**
 * Get channel members.
 */
server.tool(
  "slack_get_channel_members",
  {
    channel: z.string().describe("Channel ID to get members from"),
    limit: z.number().min(1).max(1000).optional().describe("Number of members to return (default 100)"),
    cursor: z.string().optional().describe("Pagination cursor"),
  },
  async ({ channel, limit = 100, cursor }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.conversations.members({
        channel,
        limit,
        cursor,
      });

      const result = {
        members: response.members,
        nextCursor: response.response_metadata?.next_cursor,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to get channel members", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting channel members: ${message}` }] };
    }
  }
);

/**
 * Set channel topic.
 */
server.tool(
  "slack_set_channel_topic",
  {
    channel: z.string().describe("Channel ID"),
    topic: z.string().describe("New channel topic (max 250 chars)"),
  },
  async ({ channel, topic }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.conversations.setTopic({
        channel,
        topic,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, channel: response.channel, topic }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to set topic", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error setting topic: ${message}` }] };
    }
  }
);

/**
 * Set channel purpose.
 */
server.tool(
  "slack_set_channel_purpose",
  {
    channel: z.string().describe("Channel ID"),
    purpose: z.string().describe("New channel purpose (max 250 chars)"),
  },
  async ({ channel, purpose }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Slack token available" }] };
    }

    try {
      const client = createSlackClient(token);
      const response = await client.conversations.setPurpose({
        channel,
        purpose,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, channel: response.channel, purpose }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to set purpose", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error setting purpose: ${message}` }] };
    }
  }
);

logger.info("Slack channel tools registered");

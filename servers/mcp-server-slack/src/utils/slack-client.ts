import { WebClient } from "@slack/web-api";

/**
 * Creates a Slack Web API client with the provided bot token.
 * This is called per-request to support dynamic token authentication.
 */
export function createSlackClient(token: string): WebClient {
  return new WebClient(token);
}

/**
 * Extracts Slack token from request headers.
 * Supports both x-slack-token header and Authorization: Bearer token.
 */
export function extractSlackToken(
  headers: Record<string, string | string[] | undefined>
): string | null {
  // Check x-slack-token header first
  const slackToken = headers["x-slack-token"];
  if (slackToken && typeof slackToken === "string") {
    return slackToken;
  }

  // Check Authorization header
  const authHeader = headers["authorization"];
  if (authHeader && typeof authHeader === "string") {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch) {
      return bearerMatch[1];
    }
  }

  return null;
}

/**
 * Format a Slack message for response.
 */
export function formatMessage(message: Record<string, unknown>): Record<string, unknown> {
  return {
    ts: message.ts,
    text: message.text,
    user: message.user,
    channel: message.channel,
    type: message.type,
    subtype: message.subtype,
    threadTs: message.thread_ts,
    replyCount: message.reply_count,
    reactions: message.reactions,
    attachments: message.attachments,
    blocks: message.blocks,
    edited: message.edited,
  };
}

/**
 * Format a Slack channel for response.
 */
export function formatChannel(channel: Record<string, unknown>): Record<string, unknown> {
  return {
    id: channel.id,
    name: channel.name,
    isChannel: channel.is_channel,
    isGroup: channel.is_group,
    isIm: channel.is_im,
    isMpim: channel.is_mpim,
    isPrivate: channel.is_private,
    isArchived: channel.is_archived,
    isMember: channel.is_member,
    topic: channel.topic,
    purpose: channel.purpose,
    numMembers: channel.num_members,
    created: channel.created,
    creator: channel.creator,
  };
}

/**
 * Format a Slack user for response.
 */
export function formatUser(user: Record<string, unknown>): Record<string, unknown> {
  const profile = (user.profile || {}) as Record<string, unknown>;
  return {
    id: user.id,
    name: user.name,
    realName: user.real_name,
    displayName: profile.display_name,
    email: profile.email,
    title: profile.title,
    phone: profile.phone,
    isAdmin: user.is_admin,
    isOwner: user.is_owner,
    isBot: user.is_bot,
    isAppUser: user.is_app_user,
    deleted: user.deleted,
    teamId: user.team_id,
    tz: user.tz,
    tzLabel: user.tz_label,
    statusText: profile.status_text,
    statusEmoji: profile.status_emoji,
    image72: profile.image_72,
  };
}

/**
 * Parse channel input - accepts channel ID or name.
 * If name is provided without #, prepends it.
 */
export function normalizeChannel(channel: string): string {
  // If it looks like a channel ID (starts with C, D, or G), return as-is
  if (/^[CDG][A-Z0-9]+$/.test(channel)) {
    return channel;
  }
  // Otherwise, ensure it has # prefix for channel name lookup
  return channel.startsWith("#") ? channel : `#${channel}`;
}

import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createGmailClient, decodeBase64Url, createRawEmail } from "../utils/gmail-client.js";
import { logger } from "../utils/logger.js";

/**
 * List messages in the user's mailbox.
 */
server.tool(
  "gmail_list_messages",
  {
    maxResults: z.number().min(1).max(500).optional().describe("Maximum number of messages to return (1-500, default 10)"),
    labelIds: z.array(z.string()).optional().describe("Only return messages with labels that match all of these label IDs"),
    q: z.string().optional().describe("Gmail search query (same as Gmail search box)"),
    pageToken: z.string().optional().describe("Page token for pagination"),
    includeSpamTrash: z.boolean().optional().describe("Include messages from SPAM and TRASH"),
  },
  async ({ maxResults = 10, labelIds, q, pageToken, includeSpamTrash }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Gmail token available" }] };
    }

    try {
      const gmail = createGmailClient(token);
      const response = await gmail.users.messages.list({
        userId: "me",
        maxResults,
        labelIds,
        q,
        pageToken,
        includeSpamTrash,
      });

      const messages = response.data.messages || [];
      const result = {
        messages: messages.map((m) => ({ id: m.id, threadId: m.threadId })),
        nextPageToken: response.data.nextPageToken,
        resultSizeEstimate: response.data.resultSizeEstimate,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list messages", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing messages: ${message}` }] };
    }
  }
);

/**
 * Get a specific message by ID.
 */
server.tool(
  "gmail_get_message",
  {
    messageId: z.string().describe("The ID of the message to retrieve"),
    format: z.enum(["minimal", "full", "raw", "metadata"]).optional().describe("Format of the message (default: full)"),
    metadataHeaders: z.array(z.string()).optional().describe("Headers to include when format is metadata"),
  },
  async ({ messageId, format = "full", metadataHeaders }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Gmail token available" }] };
    }

    try {
      const gmail = createGmailClient(token);
      const response = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format,
        metadataHeaders,
      });

      const message = response.data;

      // Extract common headers
      const headers = message.payload?.headers || [];
      const getHeader = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value;

      // Extract body
      let body = "";
      if (message.payload?.body?.data) {
        body = decodeBase64Url(message.payload.body.data);
      } else if (message.payload?.parts) {
        const textPart = message.payload.parts.find((p) => p.mimeType === "text/plain");
        if (textPart?.body?.data) {
          body = decodeBase64Url(textPart.body.data);
        } else {
          const htmlPart = message.payload.parts.find((p) => p.mimeType === "text/html");
          if (htmlPart?.body?.data) {
            body = decodeBase64Url(htmlPart.body.data);
          }
        }
      }

      const result = {
        id: message.id,
        threadId: message.threadId,
        labelIds: message.labelIds,
        snippet: message.snippet,
        from: getHeader("From"),
        to: getHeader("To"),
        cc: getHeader("Cc"),
        subject: getHeader("Subject"),
        date: getHeader("Date"),
        body: body.substring(0, 10000), // Limit body length
        internalDate: message.internalDate,
        sizeEstimate: message.sizeEstimate,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to get message", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting message: ${message}` }] };
    }
  }
);

/**
 * Send an email message.
 */
server.tool(
  "gmail_send_message",
  {
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body content"),
    cc: z.string().optional().describe("CC recipients (comma-separated)"),
    bcc: z.string().optional().describe("BCC recipients (comma-separated)"),
    isHtml: z.boolean().optional().describe("Set to true if body is HTML content"),
  },
  async ({ to, subject, body, cc, bcc, isHtml }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Gmail token available" }] };
    }

    try {
      const gmail = createGmailClient(token);

      const raw = createRawEmail({
        to,
        subject,
        body,
        cc,
        bcc,
        contentType: isHtml ? "text/html" : "text/plain",
      });

      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                messageId: response.data.id,
                threadId: response.data.threadId,
                labelIds: response.data.labelIds,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to send message", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error sending message: ${message}` }] };
    }
  }
);

/**
 * Search messages using Gmail search syntax.
 */
server.tool(
  "gmail_search_messages",
  {
    query: z.string().describe("Gmail search query (e.g., 'from:user@example.com', 'subject:hello', 'is:unread')"),
    maxResults: z.number().min(1).max(500).optional().describe("Maximum number of messages to return (default 10)"),
    pageToken: z.string().optional().describe("Page token for pagination"),
  },
  async ({ query, maxResults = 10, pageToken }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Gmail token available" }] };
    }

    try {
      const gmail = createGmailClient(token);
      const response = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults,
        pageToken,
      });

      const messages = response.data.messages || [];

      // Fetch details for each message
      const detailedMessages = await Promise.all(
        messages.slice(0, 20).map(async (m) => {
          try {
            const detail = await gmail.users.messages.get({
              userId: "me",
              id: m.id!,
              format: "metadata",
              metadataHeaders: ["From", "To", "Subject", "Date"],
            });
            const headers = detail.data.payload?.headers || [];
            const getHeader = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value;
            return {
              id: m.id,
              threadId: m.threadId,
              from: getHeader("From"),
              to: getHeader("To"),
              subject: getHeader("Subject"),
              date: getHeader("Date"),
              snippet: detail.data.snippet,
              labelIds: detail.data.labelIds,
            };
          } catch {
            return { id: m.id, threadId: m.threadId, error: "Failed to fetch details" };
          }
        })
      );

      const result = {
        messages: detailedMessages,
        nextPageToken: response.data.nextPageToken,
        resultSizeEstimate: response.data.resultSizeEstimate,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to search messages", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error searching messages: ${message}` }] };
    }
  }
);

/**
 * Move a message to trash.
 */
server.tool(
  "gmail_trash_message",
  {
    messageId: z.string().describe("The ID of the message to trash"),
  },
  async ({ messageId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Gmail token available" }] };
    }

    try {
      const gmail = createGmailClient(token);
      const response = await gmail.users.messages.trash({
        userId: "me",
        id: messageId,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, messageId: response.data.id, labelIds: response.data.labelIds }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to trash message", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error trashing message: ${message}` }] };
    }
  }
);

/**
 * Untrash a message.
 */
server.tool(
  "gmail_untrash_message",
  {
    messageId: z.string().describe("The ID of the message to untrash"),
  },
  async ({ messageId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Gmail token available" }] };
    }

    try {
      const gmail = createGmailClient(token);
      const response = await gmail.users.messages.untrash({
        userId: "me",
        id: messageId,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, messageId: response.data.id, labelIds: response.data.labelIds }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to untrash message", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error untrashing message: ${message}` }] };
    }
  }
);

/**
 * Modify message labels (add or remove).
 */
server.tool(
  "gmail_modify_labels",
  {
    messageId: z.string().describe("The ID of the message to modify"),
    addLabelIds: z.array(z.string()).optional().describe("Label IDs to add to the message"),
    removeLabelIds: z.array(z.string()).optional().describe("Label IDs to remove from the message"),
  },
  async ({ messageId, addLabelIds, removeLabelIds }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Gmail token available" }] };
    }

    try {
      const gmail = createGmailClient(token);
      const response = await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          addLabelIds,
          removeLabelIds,
        },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, messageId: response.data.id, labelIds: response.data.labelIds }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to modify labels", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error modifying labels: ${message}` }] };
    }
  }
);

/**
 * Permanently delete a message.
 */
server.tool(
  "gmail_delete_message",
  {
    messageId: z.string().describe("The ID of the message to permanently delete"),
  },
  async ({ messageId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Gmail token available" }] };
    }

    try {
      const gmail = createGmailClient(token);
      await gmail.users.messages.delete({
        userId: "me",
        id: messageId,
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, messageId, deleted: true }, null, 2) }],
      };
    } catch (error) {
      logger.error("Failed to delete message", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting message: ${message}` }] };
    }
  }
);

logger.info("Gmail email tools registered");

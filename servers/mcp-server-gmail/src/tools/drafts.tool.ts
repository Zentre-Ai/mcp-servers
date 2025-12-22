import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createGmailClient, decodeBase64Url, createRawEmail } from "../utils/gmail-client.js";
import { logger } from "../utils/logger.js";

/**
 * List drafts in the user's mailbox.
 */
server.tool(
  "gmail_list_drafts",
  {
    maxResults: z.number().min(1).max(500).optional().describe("Maximum number of drafts to return (default 10)"),
    pageToken: z.string().optional().describe("Page token for pagination"),
    q: z.string().optional().describe("Gmail search query to filter drafts"),
    includeSpamTrash: z.boolean().optional().describe("Include drafts from SPAM and TRASH"),
  },
  async ({ maxResults = 10, pageToken, q, includeSpamTrash }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Gmail token available" }] };
    }

    try {
      const gmail = createGmailClient(token);
      const response = await gmail.users.drafts.list({
        userId: "me",
        maxResults,
        pageToken,
        q,
        includeSpamTrash,
      });

      const drafts = response.data.drafts || [];
      const result = {
        drafts: drafts.map((d) => ({
          id: d.id,
          messageId: d.message?.id,
          threadId: d.message?.threadId,
        })),
        nextPageToken: response.data.nextPageToken,
        resultSizeEstimate: response.data.resultSizeEstimate,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list drafts", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing drafts: ${message}` }] };
    }
  }
);

/**
 * Get a specific draft by ID.
 */
server.tool(
  "gmail_get_draft",
  {
    draftId: z.string().describe("The ID of the draft to retrieve"),
    format: z.enum(["minimal", "full", "raw", "metadata"]).optional().describe("Format of the draft message (default: full)"),
  },
  async ({ draftId, format = "full" }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Gmail token available" }] };
    }

    try {
      const gmail = createGmailClient(token);
      const response = await gmail.users.drafts.get({
        userId: "me",
        id: draftId,
        format,
      });

      const draft = response.data;
      const message = draft.message;
      const headers = message?.payload?.headers || [];
      const getHeader = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value;

      // Extract body
      let body = "";
      if (message?.payload?.body?.data) {
        body = decodeBase64Url(message.payload.body.data);
      } else if (message?.payload?.parts) {
        const textPart = message.payload.parts.find((p) => p.mimeType === "text/plain");
        if (textPart?.body?.data) {
          body = decodeBase64Url(textPart.body.data);
        }
      }

      const result = {
        id: draft.id,
        messageId: message?.id,
        threadId: message?.threadId,
        labelIds: message?.labelIds,
        from: getHeader("From"),
        to: getHeader("To"),
        cc: getHeader("Cc"),
        subject: getHeader("Subject"),
        body: body.substring(0, 10000),
        snippet: message?.snippet,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to get draft", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting draft: ${message}` }] };
    }
  }
);

/**
 * Create a new draft.
 */
server.tool(
  "gmail_create_draft",
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

      const response = await gmail.users.drafts.create({
        userId: "me",
        requestBody: {
          message: { raw },
        },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                draftId: response.data.id,
                messageId: response.data.message?.id,
                threadId: response.data.message?.threadId,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create draft", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating draft: ${message}` }] };
    }
  }
);

/**
 * Update an existing draft.
 */
server.tool(
  "gmail_update_draft",
  {
    draftId: z.string().describe("The ID of the draft to update"),
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body content"),
    cc: z.string().optional().describe("CC recipients (comma-separated)"),
    bcc: z.string().optional().describe("BCC recipients (comma-separated)"),
    isHtml: z.boolean().optional().describe("Set to true if body is HTML content"),
  },
  async ({ draftId, to, subject, body, cc, bcc, isHtml }) => {
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

      const response = await gmail.users.drafts.update({
        userId: "me",
        id: draftId,
        requestBody: {
          message: { raw },
        },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                draftId: response.data.id,
                messageId: response.data.message?.id,
                threadId: response.data.message?.threadId,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update draft", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating draft: ${message}` }] };
    }
  }
);

/**
 * Send a draft.
 */
server.tool(
  "gmail_send_draft",
  {
    draftId: z.string().describe("The ID of the draft to send"),
  },
  async ({ draftId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Gmail token available" }] };
    }

    try {
      const gmail = createGmailClient(token);
      const response = await gmail.users.drafts.send({
        userId: "me",
        requestBody: {
          id: draftId,
        },
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
      logger.error("Failed to send draft", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error sending draft: ${message}` }] };
    }
  }
);

/**
 * Delete a draft.
 */
server.tool(
  "gmail_delete_draft",
  {
    draftId: z.string().describe("The ID of the draft to delete"),
  },
  async ({ draftId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Gmail token available" }] };
    }

    try {
      const gmail = createGmailClient(token);
      await gmail.users.drafts.delete({
        userId: "me",
        id: draftId,
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, draftId, deleted: true }, null, 2) }],
      };
    } catch (error) {
      logger.error("Failed to delete draft", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting draft: ${message}` }] };
    }
  }
);

logger.info("Gmail draft tools registered");

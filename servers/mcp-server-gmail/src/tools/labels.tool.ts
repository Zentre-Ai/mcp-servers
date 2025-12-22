import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createGmailClient } from "../utils/gmail-client.js";
import { logger } from "../utils/logger.js";

/**
 * List all labels in the user's mailbox.
 */
server.tool(
  "gmail_list_labels",
  {},
  async () => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Gmail token available" }] };
    }

    try {
      const gmail = createGmailClient(token);
      const response = await gmail.users.labels.list({
        userId: "me",
      });

      const labels = response.data.labels || [];
      const result = labels.map((label) => ({
        id: label.id,
        name: label.name,
        type: label.type,
        messageListVisibility: label.messageListVisibility,
        labelListVisibility: label.labelListVisibility,
      }));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list labels", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing labels: ${message}` }] };
    }
  }
);

/**
 * Get a specific label by ID.
 */
server.tool(
  "gmail_get_label",
  {
    labelId: z.string().describe("The ID of the label to retrieve"),
  },
  async ({ labelId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Gmail token available" }] };
    }

    try {
      const gmail = createGmailClient(token);
      const response = await gmail.users.labels.get({
        userId: "me",
        id: labelId,
      });

      const label = response.data;
      const result = {
        id: label.id,
        name: label.name,
        type: label.type,
        messageListVisibility: label.messageListVisibility,
        labelListVisibility: label.labelListVisibility,
        messagesTotal: label.messagesTotal,
        messagesUnread: label.messagesUnread,
        threadsTotal: label.threadsTotal,
        threadsUnread: label.threadsUnread,
        color: label.color,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to get label", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting label: ${message}` }] };
    }
  }
);

/**
 * Create a new label.
 */
server.tool(
  "gmail_create_label",
  {
    name: z.string().describe("The display name of the label"),
    messageListVisibility: z.enum(["show", "hide"]).optional().describe("Visibility in message list (default: show)"),
    labelListVisibility: z.enum(["labelShow", "labelShowIfUnread", "labelHide"]).optional().describe("Visibility in label list (default: labelShow)"),
    backgroundColor: z.string().optional().describe("Background color in hex format (e.g., #ffffff)"),
    textColor: z.string().optional().describe("Text color in hex format (e.g., #000000)"),
  },
  async ({ name, messageListVisibility, labelListVisibility, backgroundColor, textColor }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Gmail token available" }] };
    }

    try {
      const gmail = createGmailClient(token);

      const requestBody: Record<string, unknown> = {
        name,
        messageListVisibility: messageListVisibility || "show",
        labelListVisibility: labelListVisibility || "labelShow",
      };

      if (backgroundColor || textColor) {
        requestBody.color = {
          backgroundColor,
          textColor,
        };
      }

      const response = await gmail.users.labels.create({
        userId: "me",
        requestBody,
      });

      const label = response.data;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                id: label.id,
                name: label.name,
                type: label.type,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create label", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating label: ${message}` }] };
    }
  }
);

/**
 * Update an existing label.
 */
server.tool(
  "gmail_update_label",
  {
    labelId: z.string().describe("The ID of the label to update"),
    name: z.string().optional().describe("New display name for the label"),
    messageListVisibility: z.enum(["show", "hide"]).optional().describe("Visibility in message list"),
    labelListVisibility: z.enum(["labelShow", "labelShowIfUnread", "labelHide"]).optional().describe("Visibility in label list"),
    backgroundColor: z.string().optional().describe("Background color in hex format (e.g., #ffffff)"),
    textColor: z.string().optional().describe("Text color in hex format (e.g., #000000)"),
  },
  async ({ labelId, name, messageListVisibility, labelListVisibility, backgroundColor, textColor }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Gmail token available" }] };
    }

    try {
      const gmail = createGmailClient(token);

      const requestBody: Record<string, unknown> = {};

      if (name) requestBody.name = name;
      if (messageListVisibility) requestBody.messageListVisibility = messageListVisibility;
      if (labelListVisibility) requestBody.labelListVisibility = labelListVisibility;
      if (backgroundColor || textColor) {
        requestBody.color = {
          backgroundColor,
          textColor,
        };
      }

      const response = await gmail.users.labels.update({
        userId: "me",
        id: labelId,
        requestBody,
      });

      const label = response.data;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                id: label.id,
                name: label.name,
                type: label.type,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update label", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating label: ${message}` }] };
    }
  }
);

/**
 * Delete a label.
 */
server.tool(
  "gmail_delete_label",
  {
    labelId: z.string().describe("The ID of the label to delete"),
  },
  async ({ labelId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Gmail token available" }] };
    }

    try {
      const gmail = createGmailClient(token);
      await gmail.users.labels.delete({
        userId: "me",
        id: labelId,
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, labelId, deleted: true }, null, 2) }],
      };
    } catch (error) {
      logger.error("Failed to delete label", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting label: ${message}` }] };
    }
  }
);

logger.info("Gmail label tools registered");

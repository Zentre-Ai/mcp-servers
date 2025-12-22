import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createNotionClient } from "../utils/notion-client.js";
import { logger } from "../utils/logger.js";

/**
 * Retrieve comments on a block or page.
 */
server.tool(
  "notion_retrieve_comments",
  {
    block_id: z
      .string()
      .describe("The ID of the block or page to get comments from"),
    page_size: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe("Number of results to return (max 100)"),
    start_cursor: z
      .string()
      .optional()
      .describe("Pagination cursor for next page of results"),
  },
  async ({ block_id, page_size, start_cursor }) => {
    const token = getCurrentToken();
    if (!token) {
      return {
        content: [{ type: "text", text: "Error: No Notion token provided" }],
        isError: true,
      };
    }

    try {
      logger.debug("Retrieving comments", { block_id });
      const notion = createNotionClient(token);

      const response = await notion.comments.list({
        block_id,
        page_size,
        start_cursor,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Retrieve comments failed", error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Create a comment on a page or in a discussion thread.
 */
server.tool(
  "notion_create_comment",
  {
    parent_type: z
      .enum(["page_id", "discussion_id"])
      .describe("Type of parent: page_id or discussion_id"),
    parent_id: z.string().describe("ID of the parent page or discussion"),
    rich_text: z
      .array(z.record(z.unknown()))
      .describe("Rich text content for the comment"),
  },
  async ({ parent_type, parent_id, rich_text }) => {
    const token = getCurrentToken();
    if (!token) {
      return {
        content: [{ type: "text", text: "Error: No Notion token provided" }],
        isError: true,
      };
    }

    try {
      logger.debug("Creating comment", { parent_type, parent_id });
      const notion = createNotionClient(token);

      const parent =
        parent_type === "page_id"
          ? { page_id: parent_id }
          : { discussion_id: parent_id };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await notion.comments.create({
        parent,
        rich_text,
      } as any);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Create comment failed", error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

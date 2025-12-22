import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createNotionClient } from "../utils/notion-client.js";
import { logger } from "../utils/logger.js";

/**
 * Retrieve block children (page content).
 */
server.tool(
  "notion_retrieve_block_children",
  {
    block_id: z
      .string()
      .describe("The ID of the block (or page) to get children from"),
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
      logger.debug("Retrieving block children", { block_id });
      const notion = createNotionClient(token);

      const response = await notion.blocks.children.list({
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
      logger.error("Retrieve block children failed", error);
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
 * Append blocks to a page or block.
 */
server.tool(
  "notion_append_block_children",
  {
    block_id: z
      .string()
      .describe("The ID of the block (or page) to append children to"),
    children: z
      .array(z.record(z.unknown()))
      .describe("Array of block objects to append"),
    after: z
      .string()
      .optional()
      .describe("ID of existing block to insert new blocks after"),
  },
  async ({ block_id, children, after }) => {
    const token = getCurrentToken();
    if (!token) {
      return {
        content: [{ type: "text", text: "Error: No Notion token provided" }],
        isError: true,
      };
    }

    try {
      logger.debug("Appending block children", { block_id });
      const notion = createNotionClient(token);

      const response = await notion.blocks.children.append({
        block_id,
        children: children as Parameters<
          typeof notion.blocks.children.append
        >[0]["children"],
        after,
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
      logger.error("Append block children failed", error);
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
 * Retrieve a single block by ID.
 */
server.tool(
  "notion_retrieve_block",
  {
    block_id: z.string().describe("The ID of the block to retrieve"),
  },
  async ({ block_id }) => {
    const token = getCurrentToken();
    if (!token) {
      return {
        content: [{ type: "text", text: "Error: No Notion token provided" }],
        isError: true,
      };
    }

    try {
      logger.debug("Retrieving block", { block_id });
      const notion = createNotionClient(token);

      const response = await notion.blocks.retrieve({ block_id });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Retrieve block failed", error);
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
 * Update a block.
 */
server.tool(
  "notion_update_block",
  {
    block_id: z.string().describe("The ID of the block to update"),
    block_data: z
      .record(z.unknown())
      .describe("Block type and content to update (e.g., { paragraph: { rich_text: [...] } })"),
    archived: z
      .boolean()
      .optional()
      .describe("Set to true to archive (delete) the block"),
  },
  async ({ block_id, block_data, archived }) => {
    const token = getCurrentToken();
    if (!token) {
      return {
        content: [{ type: "text", text: "Error: No Notion token provided" }],
        isError: true,
      };
    }

    try {
      logger.debug("Updating block", { block_id });
      const notion = createNotionClient(token);

      const response = await notion.blocks.update({
        block_id,
        ...block_data,
        archived,
      } as Parameters<typeof notion.blocks.update>[0]);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Update block failed", error);
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

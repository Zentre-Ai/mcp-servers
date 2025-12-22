import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createNotionClient } from "../utils/notion-client.js";
import { logger } from "../utils/logger.js";

/**
 * Search across pages and databases in the workspace.
 */
server.tool(
  "notion_search",
  {
    query: z.string().optional().describe("Search query string"),
    filter: z
      .enum(["page", "database"])
      .optional()
      .describe("Filter results by object type"),
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
  async ({ query, filter, page_size, start_cursor }) => {
    const token = getCurrentToken();
    if (!token) {
      return {
        content: [{ type: "text", text: "Error: No Notion token provided" }],
        isError: true,
      };
    }

    try {
      logger.debug("Searching Notion", { query, filter });
      const notion = createNotionClient(token);

      const response = await notion.search({
        query,
        filter: filter ? { property: "object", value: filter } : undefined,
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
      logger.error("Search failed", error);
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

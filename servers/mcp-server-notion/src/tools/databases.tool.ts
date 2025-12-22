import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createNotionClient } from "../utils/notion-client.js";
import { logger } from "../utils/logger.js";

/**
 * Retrieve a database schema by ID.
 */
server.tool(
  "notion_retrieve_database",
  {
    database_id: z.string().describe("The ID of the database to retrieve"),
  },
  async ({ database_id }) => {
    const token = getCurrentToken();
    if (!token) {
      return {
        content: [{ type: "text", text: "Error: No Notion token provided" }],
        isError: true,
      };
    }

    try {
      logger.debug("Retrieving database", { database_id });
      const notion = createNotionClient(token);

      const response = await notion.databases.retrieve({ database_id });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Retrieve database failed", error);
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
 * Query a database with filters and sorting.
 */
server.tool(
  "notion_query_database",
  {
    database_id: z.string().describe("The ID of the database to query"),
    filter: z
      .record(z.unknown())
      .optional()
      .describe("Filter conditions as JSON object"),
    sorts: z
      .array(z.record(z.unknown()))
      .optional()
      .describe("Sort conditions as array of sort objects"),
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
  async ({ database_id, filter, sorts, page_size, start_cursor }) => {
    const token = getCurrentToken();
    if (!token) {
      return {
        content: [{ type: "text", text: "Error: No Notion token provided" }],
        isError: true,
      };
    }

    try {
      logger.debug("Querying database", { database_id });
      const notion = createNotionClient(token);

      const response = await notion.databases.query({
        database_id,
        filter: filter as Parameters<typeof notion.databases.query>[0]["filter"],
        sorts: sorts as Parameters<typeof notion.databases.query>[0]["sorts"],
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
      logger.error("Query database failed", error);
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

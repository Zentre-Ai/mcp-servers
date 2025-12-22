import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createNotionClient } from "../utils/notion-client.js";
import { logger } from "../utils/logger.js";

/**
 * Retrieve a page by ID.
 */
server.tool(
  "notion_retrieve_page",
  {
    page_id: z.string().describe("The ID of the page to retrieve"),
  },
  async ({ page_id }) => {
    const token = getCurrentToken();
    if (!token) {
      return {
        content: [{ type: "text", text: "Error: No Notion token provided" }],
        isError: true,
      };
    }

    try {
      logger.debug("Retrieving page", { page_id });
      const notion = createNotionClient(token);

      const response = await notion.pages.retrieve({ page_id });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Retrieve page failed", error);
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
 * Create a new page.
 */
server.tool(
  "notion_create_page",
  {
    parent_type: z
      .enum(["database_id", "page_id"])
      .describe("Type of parent: database_id or page_id"),
    parent_id: z.string().describe("ID of the parent database or page"),
    properties: z
      .record(z.unknown())
      .describe("Page properties as JSON object"),
    children: z
      .array(z.record(z.unknown()))
      .optional()
      .describe("Array of block objects for page content"),
  },
  async ({ parent_type, parent_id, properties, children }) => {
    const token = getCurrentToken();
    if (!token) {
      return {
        content: [{ type: "text", text: "Error: No Notion token provided" }],
        isError: true,
      };
    }

    try {
      logger.debug("Creating page", { parent_type, parent_id });
      const notion = createNotionClient(token);

      const parent =
        parent_type === "database_id"
          ? { database_id: parent_id }
          : { page_id: parent_id };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await notion.pages.create({
        parent,
        properties,
        children,
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
      logger.error("Create page failed", error);
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
 * Update page properties.
 */
server.tool(
  "notion_update_page",
  {
    page_id: z.string().describe("The ID of the page to update"),
    properties: z
      .record(z.unknown())
      .describe("Page properties to update as JSON object"),
    archived: z
      .boolean()
      .optional()
      .describe("Set to true to archive (soft-delete) the page"),
  },
  async ({ page_id, properties, archived }) => {
    const token = getCurrentToken();
    if (!token) {
      return {
        content: [{ type: "text", text: "Error: No Notion token provided" }],
        isError: true,
      };
    }

    try {
      logger.debug("Updating page", { page_id });
      const notion = createNotionClient(token);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await notion.pages.update({
        page_id,
        properties,
        archived,
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
      logger.error("Update page failed", error);
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

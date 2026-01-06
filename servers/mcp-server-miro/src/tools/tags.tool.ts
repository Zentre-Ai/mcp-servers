import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createMiroClient, formatTag } from "../utils/miro-client.js";
import { logger } from "../utils/logger.js";

/**
 * List all tags on a board.
 */
server.tool(
  "miro_list_tags",
  {
    boardId: z.string().describe("Board ID"),
    limit: z.number().optional().describe("Maximum number of results"),
    offset: z.string().optional().describe("Pagination offset"),
  },
  async ({ boardId, limit, offset }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const params: Record<string, unknown> = {};
      if (limit) params.limit = limit;
      if (offset) params.offset = offset;

      const { body } = await client.getTagsFromBoard(boardId, params);
      const tags = (body.data || []).map((t: unknown) => formatTag(t as Record<string, unknown>));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ total: body.total, tags }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list tags", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing tags: ${message}` }] };
    }
  }
);

/**
 * Get a specific tag.
 */
server.tool(
  "miro_get_tag",
  {
    boardId: z.string().describe("Board ID"),
    tagId: z.string().describe("Tag ID"),
  },
  async ({ boardId, tagId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const { body: tag } = await client.getTag(boardId, tagId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatTag(tag as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get tag", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting tag: ${message}` }] };
    }
  }
);

/**
 * Create a new tag.
 */
server.tool(
  "miro_create_tag",
  {
    boardId: z.string().describe("Board ID"),
    title: z.string().describe("Tag title"),
    fillColor: z.string().optional().describe("Tag color (e.g., 'red', 'blue', '#FF0000')"),
  },
  async ({ boardId, title, fillColor }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = { title };
      if (fillColor) data.fillColor = fillColor;

      const { body: tag } = await client.createTag(boardId, data as any);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatTag(tag as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create tag", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating tag: ${message}` }] };
    }
  }
);

/**
 * Update a tag.
 */
server.tool(
  "miro_update_tag",
  {
    boardId: z.string().describe("Board ID"),
    tagId: z.string().describe("Tag ID"),
    title: z.string().optional().describe("New title"),
    fillColor: z.string().optional().describe("New color"),
  },
  async ({ boardId, tagId, title, fillColor }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {};
      if (title) data.title = title;
      if (fillColor) data.fillColor = fillColor;

      const { body: tag } = await client.updateTag(boardId, tagId, data);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatTag(tag as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update tag", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating tag: ${message}` }] };
    }
  }
);

/**
 * Delete a tag.
 */
server.tool(
  "miro_delete_tag",
  {
    boardId: z.string().describe("Board ID"),
    tagId: z.string().describe("Tag ID"),
  },
  async ({ boardId, tagId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      await client.deleteTag(boardId, tagId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Tag ${tagId} deleted` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete tag", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting tag: ${message}` }] };
    }
  }
);

/**
 * Attach a tag to an item.
 */
server.tool(
  "miro_attach_tag",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Item ID"),
    tagId: z.string().describe("Tag ID"),
  },
  async ({ boardId, itemId, tagId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      await client.attachTagToItem(boardId, itemId, tagId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Tag ${tagId} attached to item ${itemId}` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to attach tag", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error attaching tag: ${message}` }] };
    }
  }
);

/**
 * Detach a tag from an item.
 */
server.tool(
  "miro_detach_tag",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Item ID"),
    tagId: z.string().describe("Tag ID"),
  },
  async ({ boardId, itemId, tagId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      await client.removeTagFromItem(boardId, itemId, tagId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Tag ${tagId} detached from item ${itemId}` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to detach tag", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error detaching tag: ${message}` }] };
    }
  }
);

/**
 * Get tags attached to an item.
 */
server.tool(
  "miro_get_item_tags",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Item ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const { body } = await client.getTagsFromItem(boardId, itemId);
      const tags = (body.tags || []).map((t: unknown) => formatTag(t as Record<string, unknown>));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ itemId, tags }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get item tags", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting item tags: ${message}` }] };
    }
  }
);

logger.info("Miro tag tools registered");

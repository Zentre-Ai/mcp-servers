import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createMiroClient, formatItem } from "../utils/miro-client.js";
import { logger } from "../utils/logger.js";

/**
 * List all items on a board.
 */
server.tool(
  "miro_list_items",
  {
    boardId: z.string().describe("Board ID"),
    type: z.string().optional().describe("Filter by item type"),
    limit: z.number().optional().describe("Maximum number of results"),
    cursor: z.string().optional().describe("Pagination cursor"),
  },
  async ({ boardId, type, limit, cursor }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const params: Record<string, unknown> = {};
      if (type) params.type = type;
      if (limit) params.limit = limit;
      if (cursor) params.cursor = cursor;

      const { body } = await client.getItems(boardId, params);
      const items = (body.data || []).map((i: unknown) => formatItem(i as Record<string, unknown>));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ total: body.total, items, cursor: body.cursor }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list items", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing items: ${message}` }] };
    }
  }
);

/**
 * Get a specific item.
 */
server.tool(
  "miro_get_item",
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
      const { body: item } = await client.getSpecificItem(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get item", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting item: ${message}` }] };
    }
  }
);

/**
 * Update item position.
 */
server.tool(
  "miro_update_item_position",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Item ID"),
    x: z.number().describe("X position"),
    y: z.number().describe("Y position"),
    origin: z.enum(["center"]).optional().describe("Position origin"),
  },
  async ({ boardId, itemId, x, y, origin }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const position: Record<string, unknown> = { x, y };
      if (origin) position.origin = origin;

      const { body: item } = await client.updateItemPositionOrParent(boardId, itemId, { position });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update item position", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating item position: ${message}` }] };
    }
  }
);

/**
 * Delete an item.
 */
server.tool(
  "miro_delete_item",
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
      await client.deleteItem(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Item ${itemId} deleted` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete item", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting item: ${message}` }] };
    }
  }
);

/**
 * Create an app card.
 */
server.tool(
  "miro_create_app_card",
  {
    boardId: z.string().describe("Board ID"),
    title: z.string().describe("Card title"),
    description: z.string().optional().describe("Card description"),
    x: z.number().optional().describe("X position"),
    y: z.number().optional().describe("Y position"),
    status: z.enum(["disconnected", "connected", "disabled"]).optional().describe("App card status"),
  },
  async ({ boardId, title, description, x, y, status }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {
        data: { title, description, status: status || "connected" },
      };
      if (x !== undefined && y !== undefined) {
        data.position = { x, y };
      }

      const { body: item } = await client.createAppCardItem(boardId, data as any);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create app card", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating app card: ${message}` }] };
    }
  }
);

/**
 * Get an app card.
 */
server.tool(
  "miro_get_app_card",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("App card ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const { body: item } = await client.getAppCardItem(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get app card", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting app card: ${message}` }] };
    }
  }
);

/**
 * Update an app card.
 */
server.tool(
  "miro_update_app_card",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("App card ID"),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    status: z.enum(["disconnected", "connected", "disabled"]).optional().describe("New status"),
  },
  async ({ boardId, itemId, title, description, status }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {};
      if (title) data.title = title;
      if (description) data.description = description;
      if (status) data.status = status;

      const { body: item } = await client.updateAppCardItem(boardId, itemId, { data });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update app card", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating app card: ${message}` }] };
    }
  }
);

/**
 * Delete an app card.
 */
server.tool(
  "miro_delete_app_card",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("App card ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      await client.deleteAppCardItem(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `App card ${itemId} deleted` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete app card", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting app card: ${message}` }] };
    }
  }
);

/**
 * Create a card.
 */
server.tool(
  "miro_create_card",
  {
    boardId: z.string().describe("Board ID"),
    title: z.string().describe("Card title"),
    description: z.string().optional().describe("Card description"),
    dueDate: z.string().optional().describe("Due date (ISO 8601)"),
    x: z.number().optional().describe("X position"),
    y: z.number().optional().describe("Y position"),
  },
  async ({ boardId, title, description, dueDate, x, y }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {
        data: { title, description, dueDate },
      };
      if (x !== undefined && y !== undefined) {
        data.position = { x, y };
      }

      const { body: item } = await client.createCardItem(boardId, data as any);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create card", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating card: ${message}` }] };
    }
  }
);

/**
 * Get a card.
 */
server.tool(
  "miro_get_card",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Card ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const { body: item } = await client.getCardItem(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get card", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting card: ${message}` }] };
    }
  }
);

/**
 * Update a card.
 */
server.tool(
  "miro_update_card",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Card ID"),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    dueDate: z.string().optional().describe("New due date"),
  },
  async ({ boardId, itemId, title, description, dueDate }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {};
      if (title) data.title = title;
      if (description) data.description = description;
      if (dueDate) data.dueDate = dueDate;

      const { body: item } = await client.updateCardItem(boardId, itemId, { data });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update card", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating card: ${message}` }] };
    }
  }
);

/**
 * Delete a card.
 */
server.tool(
  "miro_delete_card",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Card ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      await client.deleteCardItem(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Card ${itemId} deleted` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete card", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting card: ${message}` }] };
    }
  }
);

/**
 * Create a sticky note.
 */
server.tool(
  "miro_create_sticky_note",
  {
    boardId: z.string().describe("Board ID"),
    content: z.string().describe("Sticky note content"),
    shape: z.enum(["square", "rectangle"]).optional().describe("Shape"),
    x: z.number().optional().describe("X position"),
    y: z.number().optional().describe("Y position"),
    width: z.number().optional().describe("Width"),
  },
  async ({ boardId, content, shape, x, y, width }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {
        data: { content, shape: shape || "square" },
      };
      if (x !== undefined && y !== undefined) {
        data.position = { x, y };
      }
      if (width) {
        data.geometry = { width };
      }

      const { body: item } = await client.createStickyNoteItem(boardId, data as any);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create sticky note", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating sticky note: ${message}` }] };
    }
  }
);

/**
 * Get a sticky note.
 */
server.tool(
  "miro_get_sticky_note",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Sticky note ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const { body: item } = await client.getStickyNoteItem(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get sticky note", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting sticky note: ${message}` }] };
    }
  }
);

/**
 * Update a sticky note.
 */
server.tool(
  "miro_update_sticky_note",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Sticky note ID"),
    content: z.string().optional().describe("New content"),
    shape: z.enum(["square", "rectangle"]).optional().describe("New shape"),
  },
  async ({ boardId, itemId, content, shape }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {};
      if (content) data.content = content;
      if (shape) data.shape = shape;

      const { body: item } = await client.updateStickyNoteItem(boardId, itemId, { data });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update sticky note", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating sticky note: ${message}` }] };
    }
  }
);

/**
 * Delete a sticky note.
 */
server.tool(
  "miro_delete_sticky_note",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Sticky note ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      await client.deleteStickyNoteItem(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Sticky note ${itemId} deleted` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete sticky note", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting sticky note: ${message}` }] };
    }
  }
);

logger.info("Miro item tools registered");

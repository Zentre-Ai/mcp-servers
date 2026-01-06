import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createMiroClient, formatItem } from "../utils/miro-client.js";
import { logger } from "../utils/logger.js";

/**
 * Create a shape.
 */
server.tool(
  "miro_create_shape",
  {
    boardId: z.string().describe("Board ID"),
    shape: z.enum(["rectangle", "circle", "triangle", "wedge_round_rectangle_callout", "round_rectangle", "rhombus", "parallelogram", "star", "right_arrow", "left_arrow", "pentagon", "hexagon", "octagon", "trapezoid", "flow_chart_predefined_process", "left_right_arrow", "cloud", "left_brace", "right_brace", "cross", "can"]).describe("Shape type"),
    content: z.string().optional().describe("Text content"),
    x: z.number().optional().describe("X position"),
    y: z.number().optional().describe("Y position"),
    width: z.number().optional().describe("Width"),
    height: z.number().optional().describe("Height"),
  },
  async ({ boardId, shape, content, x, y, width, height }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {
        data: { shape, content },
      };
      if (x !== undefined && y !== undefined) {
        data.position = { x, y };
      }
      if (width || height) {
        data.geometry = { width, height };
      }

      const { body: item } = await client.createShapeItem(boardId, data as any);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create shape", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating shape: ${message}` }] };
    }
  }
);

/**
 * Get a shape.
 */
server.tool(
  "miro_get_shape",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Shape ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const { body: item } = await client.getShapeItem(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get shape", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting shape: ${message}` }] };
    }
  }
);

/**
 * Update a shape.
 */
server.tool(
  "miro_update_shape",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Shape ID"),
    content: z.string().optional().describe("New content"),
  },
  async ({ boardId, itemId, content }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {};
      if (content) data.content = content;

      const { body: item } = await client.updateShapeItem(boardId, itemId, { data });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update shape", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating shape: ${message}` }] };
    }
  }
);

/**
 * Delete a shape.
 */
server.tool(
  "miro_delete_shape",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Shape ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      await client.deleteShapeItem(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Shape ${itemId} deleted` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete shape", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting shape: ${message}` }] };
    }
  }
);

/**
 * Create a text item.
 */
server.tool(
  "miro_create_text",
  {
    boardId: z.string().describe("Board ID"),
    content: z.string().describe("Text content (supports HTML)"),
    x: z.number().optional().describe("X position"),
    y: z.number().optional().describe("Y position"),
    width: z.number().optional().describe("Width"),
    rotation: z.number().optional().describe("Rotation angle"),
  },
  async ({ boardId, content, x, y, width, rotation }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {
        data: { content },
      };
      if (x !== undefined && y !== undefined) {
        data.position = { x, y };
      }
      if (width) {
        data.geometry = { width, rotation };
      }

      const { body: item } = await client.createTextItem(boardId, data as any);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create text", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating text: ${message}` }] };
    }
  }
);

/**
 * Get a text item.
 */
server.tool(
  "miro_get_text",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Text item ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const { body: item } = await client.getTextItem(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get text", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting text: ${message}` }] };
    }
  }
);

/**
 * Update a text item.
 */
server.tool(
  "miro_update_text",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Text item ID"),
    content: z.string().optional().describe("New content"),
  },
  async ({ boardId, itemId, content }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {};
      if (content) data.content = content;

      const { body: item } = await client.updateTextItem(boardId, itemId, { data } as any);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update text", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating text: ${message}` }] };
    }
  }
);

/**
 * Delete a text item.
 */
server.tool(
  "miro_delete_text",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Text item ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      await client.deleteTextItem(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Text ${itemId} deleted` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete text", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting text: ${message}` }] };
    }
  }
);

/**
 * Create a frame.
 */
server.tool(
  "miro_create_frame",
  {
    boardId: z.string().describe("Board ID"),
    title: z.string().optional().describe("Frame title"),
    x: z.number().optional().describe("X position"),
    y: z.number().optional().describe("Y position"),
    width: z.number().optional().describe("Width"),
    height: z.number().optional().describe("Height"),
  },
  async ({ boardId, title, x, y, width, height }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {
        data: { title, format: "custom" },
      };
      if (x !== undefined && y !== undefined) {
        data.position = { x, y };
      }
      if (width || height) {
        data.geometry = { width: width || 800, height: height || 600 };
      }

      const { body: item } = await client.createFrameItem(boardId, data as any);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create frame", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating frame: ${message}` }] };
    }
  }
);

/**
 * Get a frame.
 */
server.tool(
  "miro_get_frame",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Frame ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const { body: item } = await client.getFrameItem(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get frame", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting frame: ${message}` }] };
    }
  }
);

/**
 * Update a frame.
 */
server.tool(
  "miro_update_frame",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Frame ID"),
    title: z.string().optional().describe("New title"),
  },
  async ({ boardId, itemId, title }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {};
      if (title) data.title = title;

      const { body: item } = await client.updateFrameItem(boardId, itemId, { data });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update frame", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating frame: ${message}` }] };
    }
  }
);

/**
 * Delete a frame.
 */
server.tool(
  "miro_delete_frame",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Frame ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      await client.deleteFrameItem(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Frame ${itemId} deleted` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete frame", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting frame: ${message}` }] };
    }
  }
);

// Note: Document tools removed - documentItem methods not available in low-level API

logger.info("Miro shape tools registered");

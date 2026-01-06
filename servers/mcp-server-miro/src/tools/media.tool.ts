import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createMiroClient, formatItem } from "../utils/miro-client.js";
import { logger } from "../utils/logger.js";

/**
 * Create an image from URL.
 */
server.tool(
  "miro_create_image_from_url",
  {
    boardId: z.string().describe("Board ID"),
    url: z.string().describe("Image URL"),
    title: z.string().optional().describe("Image title"),
    x: z.number().optional().describe("X position"),
    y: z.number().optional().describe("Y position"),
    width: z.number().optional().describe("Width"),
  },
  async ({ boardId, url, title, x, y, width }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {
        data: { url, title },
      };
      if (x !== undefined && y !== undefined) {
        data.position = { x, y };
      }
      if (width) {
        data.geometry = { width };
      }

      const { body: item } = await client.createImageItemUsingUrl(boardId, data as any);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create image from URL", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating image: ${message}` }] };
    }
  }
);

/**
 * Get an image.
 */
server.tool(
  "miro_get_image",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Image ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const { body: item } = await client.getImageItem(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get image", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting image: ${message}` }] };
    }
  }
);

/**
 * Update an image.
 */
server.tool(
  "miro_update_image",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Image ID"),
    title: z.string().optional().describe("New title"),
    url: z.string().optional().describe("New image URL"),
  },
  async ({ boardId, itemId, title, url }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {};
      if (title) data.title = title;
      if (url) data.url = url;

      const { body: item } = await client.updateImageItemUsingUrl(boardId, itemId, { data } as any);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update image", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating image: ${message}` }] };
    }
  }
);

/**
 * Delete an image.
 */
server.tool(
  "miro_delete_image",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Image ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      await client.deleteImageItem(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Image ${itemId} deleted` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete image", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting image: ${message}` }] };
    }
  }
);

/**
 * Create an embed.
 */
server.tool(
  "miro_create_embed",
  {
    boardId: z.string().describe("Board ID"),
    url: z.string().describe("URL to embed"),
    mode: z.enum(["inline", "modal"]).optional().describe("Embed mode"),
    x: z.number().optional().describe("X position"),
    y: z.number().optional().describe("Y position"),
    width: z.number().optional().describe("Width"),
    height: z.number().optional().describe("Height"),
  },
  async ({ boardId, url, mode, x, y, width, height }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {
        data: { url, mode: mode || "inline" },
      };
      if (x !== undefined && y !== undefined) {
        data.position = { x, y };
      }
      if (width || height) {
        data.geometry = { width, height };
      }

      const { body: item } = await client.createEmbedItem(boardId, data as any);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create embed", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating embed: ${message}` }] };
    }
  }
);

/**
 * Get an embed.
 */
server.tool(
  "miro_get_embed",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Embed ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const { body: item } = await client.getEmbedItem(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get embed", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting embed: ${message}` }] };
    }
  }
);

/**
 * Update an embed.
 */
server.tool(
  "miro_update_embed",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Embed ID"),
    url: z.string().optional().describe("New URL"),
    mode: z.enum(["inline", "modal"]).optional().describe("New mode"),
  },
  async ({ boardId, itemId, url, mode }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {};
      if (url) data.url = url;
      if (mode) data.mode = mode;

      const { body: item } = await client.updateEmbedItem(boardId, itemId, { data } as any);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatItem(item as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update embed", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating embed: ${message}` }] };
    }
  }
);

/**
 * Delete an embed.
 */
server.tool(
  "miro_delete_embed",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Embed ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      await client.deleteEmbedItem(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Embed ${itemId} deleted` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete embed", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting embed: ${message}` }] };
    }
  }
);

logger.info("Miro media tools registered");

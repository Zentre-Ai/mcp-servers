import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createMiroClient } from "../utils/miro-client.js";
import { logger } from "../utils/logger.js";

const itemSchema = z.object({
  type: z.enum(["sticky_note", "card", "shape", "text", "frame"]).describe("Item type"),
  data: z.record(z.unknown()).describe("Item data"),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }).optional().describe("Position"),
  geometry: z.object({
    width: z.number().optional(),
    height: z.number().optional(),
  }).optional().describe("Size"),
  style: z.record(z.unknown()).optional().describe("Style properties"),
  parent: z.object({
    id: z.string(),
  }).optional().describe("Parent frame"),
});

/**
 * Create multiple items at once.
 */
server.tool(
  "miro_create_items_bulk",
  {
    boardId: z.string().describe("Board ID"),
    items: z.array(itemSchema).describe("Array of items to create"),
  },
  async ({ boardId, items }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const results: Record<string, unknown>[] = [];
      const errors: { index: number; error: string }[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        try {
          let result: unknown;
          const data: Record<string, unknown> = {
            data: item.data,
          };
          if (item.position) data.position = item.position;
          if (item.geometry) data.geometry = item.geometry;
          if (item.style) data.style = item.style;
          if (item.parent) data.parent = item.parent;

          switch (item.type) {
            case "sticky_note":
              result = await client.createStickyNoteItem(boardId, data as any);
              break;
            case "card":
              result = await client.createCardItem(boardId, data as any);
              break;
            case "shape":
              result = await client.createShapeItem(boardId, data as any);
              break;
            case "text":
              result = await client.createTextItem(boardId, data as any);
              break;
            case "frame":
              result = await client.createFrameItem(boardId, data as any);
              break;
            default:
              throw new Error(`Unsupported item type: ${item.type}`);
          }
          results.push({ index: i, type: item.type, item: result });
        } catch (err) {
          errors.push({ index: i, error: err instanceof Error ? err.message : "Unknown error" });
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: errors.length === 0,
              created: results.length,
              failed: errors.length,
              results,
              errors: errors.length > 0 ? errors : undefined,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create items in bulk", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating items in bulk: ${message}` }] };
    }
  }
);

/**
 * Create items from a JSON file/data.
 */
server.tool(
  "miro_create_items_bulk_file",
  {
    boardId: z.string().describe("Board ID"),
    jsonData: z.string().describe("JSON string containing array of items to create"),
  },
  async ({ boardId, jsonData }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      let items: unknown[];
      try {
        items = JSON.parse(jsonData);
        if (!Array.isArray(items)) {
          throw new Error("JSON data must be an array of items");
        }
      } catch (parseError) {
        return {
          content: [
            {
              type: "text",
              text: `Error parsing JSON: ${parseError instanceof Error ? parseError.message : "Invalid JSON"}`,
            },
          ],
        };
      }

      const client = createMiroClient(token);
      const results: Record<string, unknown>[] = [];
      const errors: { index: number; error: string }[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i] as Record<string, unknown>;
        try {
          let result: unknown;
          const itemType = item.type as string;
          const data: Record<string, unknown> = {
            data: item.data,
          };
          if (item.position) data.position = item.position;
          if (item.geometry) data.geometry = item.geometry;
          if (item.style) data.style = item.style;
          if (item.parent) data.parent = item.parent;

          switch (itemType) {
            case "sticky_note":
              result = await client.createStickyNoteItem(boardId, data as any);
              break;
            case "card":
              result = await client.createCardItem(boardId, data as any);
              break;
            case "shape":
              result = await client.createShapeItem(boardId, data as any);
              break;
            case "text":
              result = await client.createTextItem(boardId, data as any);
              break;
            case "frame":
              result = await client.createFrameItem(boardId, data as any);
              break;
            default:
              throw new Error(`Unsupported item type: ${itemType}`);
          }
          results.push({ index: i, type: itemType, item: result });
        } catch (err) {
          errors.push({ index: i, error: err instanceof Error ? err.message : "Unknown error" });
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: errors.length === 0,
              created: results.length,
              failed: errors.length,
              results,
              errors: errors.length > 0 ? errors : undefined,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create items from file", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating items from file: ${message}` }] };
    }
  }
);

logger.info("Miro bulk tools registered");

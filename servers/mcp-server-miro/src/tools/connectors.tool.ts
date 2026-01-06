import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createMiroClient, formatConnector } from "../utils/miro-client.js";
import { logger } from "../utils/logger.js";

/**
 * List all connectors on a board.
 */
server.tool(
  "miro_list_connectors",
  {
    boardId: z.string().describe("Board ID"),
    limit: z.number().optional().describe("Maximum number of results"),
    cursor: z.string().optional().describe("Pagination cursor"),
  },
  async ({ boardId, limit, cursor }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const params: Record<string, unknown> = {};
      if (limit) params.limit = limit;
      if (cursor) params.cursor = cursor;

      const { body } = await client.getConnectors(boardId, params);
      const connectors = (body.data || []).map((c: unknown) => formatConnector(c as Record<string, unknown>));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ total: body.total, connectors, cursor: body.cursor }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list connectors", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing connectors: ${message}` }] };
    }
  }
);

/**
 * Get a specific connector.
 */
server.tool(
  "miro_get_connector",
  {
    boardId: z.string().describe("Board ID"),
    connectorId: z.string().describe("Connector ID"),
  },
  async ({ boardId, connectorId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const { body: connector } = await client.getConnector(boardId, connectorId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatConnector(connector as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get connector", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting connector: ${message}` }] };
    }
  }
);

/**
 * Create a connector between two items.
 */
server.tool(
  "miro_create_connector",
  {
    boardId: z.string().describe("Board ID"),
    startItemId: z.string().describe("Start item ID"),
    endItemId: z.string().describe("End item ID"),
    shape: z.enum(["straight", "elbowed", "curved"]).optional().describe("Connector shape"),
    startPosition: z.object({
      x: z.number(),
      y: z.number(),
    }).optional().describe("Start position on item"),
    endPosition: z.object({
      x: z.number(),
      y: z.number(),
    }).optional().describe("End position on item"),
  },
  async ({ boardId, startItemId, endItemId, shape, startPosition, endPosition }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {
        startItem: { id: startItemId },
        endItem: { id: endItemId },
        shape: shape || "curved",
      };
      if (startPosition) {
        (data.startItem as Record<string, unknown>).position = startPosition;
      }
      if (endPosition) {
        (data.endItem as Record<string, unknown>).position = endPosition;
      }

      const { body: connector } = await client.createConnector(boardId, data as any);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatConnector(connector as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create connector", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating connector: ${message}` }] };
    }
  }
);

/**
 * Update a connector.
 */
server.tool(
  "miro_update_connector",
  {
    boardId: z.string().describe("Board ID"),
    connectorId: z.string().describe("Connector ID"),
    shape: z.enum(["straight", "elbowed", "curved"]).optional().describe("New shape"),
    startItemId: z.string().optional().describe("New start item ID"),
    endItemId: z.string().optional().describe("New end item ID"),
  },
  async ({ boardId, connectorId, shape, startItemId, endItemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {};
      if (shape) data.shape = shape;
      if (startItemId) data.startItem = { id: startItemId };
      if (endItemId) data.endItem = { id: endItemId };

      const { body: connector } = await client.updateConnector(boardId, connectorId, data);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatConnector(connector as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update connector", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating connector: ${message}` }] };
    }
  }
);

/**
 * Delete a connector.
 */
server.tool(
  "miro_delete_connector",
  {
    boardId: z.string().describe("Board ID"),
    connectorId: z.string().describe("Connector ID"),
  },
  async ({ boardId, connectorId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      await client.deleteConnector(boardId, connectorId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Connector ${connectorId} deleted` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete connector", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting connector: ${message}` }] };
    }
  }
);

logger.info("Miro connector tools registered");

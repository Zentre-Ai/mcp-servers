import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createMiroClient } from "../utils/miro-client.js";
import { logger } from "../utils/logger.js";

/**
 * Create a mindmap node.
 */
server.tool(
  "miro_create_mindmap_node",
  {
    boardId: z.string().describe("Board ID"),
    nodeView: z.object({
      content: z.string().describe("Text content of the node"),
    }).describe("Node view data"),
    parentId: z.string().optional().describe("Parent node ID (omit for root)"),
    x: z.number().optional().describe("X position (for root nodes)"),
    y: z.number().optional().describe("Y position (for root nodes)"),
  },
  async ({ boardId, nodeView, parentId, x, y }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {
        data: { nodeView },
      };
      if (parentId) {
        data.parent = { id: parentId };
      }
      if (x !== undefined && y !== undefined) {
        data.position = { x, y };
      }

      const { body: node } = await client.createMindmapNodesExperimental(boardId, data as any);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(node, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create mindmap node", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating mindmap node: ${message}` }] };
    }
  }
);

/**
 * Get a mindmap node.
 */
server.tool(
  "miro_get_mindmap_node",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Mindmap node ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const { body: node } = await client.getMindmapNodeExperimental(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(node, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get mindmap node", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting mindmap node: ${message}` }] };
    }
  }
);

/**
 * List all mindmap nodes on a board.
 */
server.tool(
  "miro_list_mindmap_nodes",
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
      const params: Record<string, unknown> = {
        type: "mindmap_node",
      };
      if (limit) params.limit = limit;
      if (cursor) params.cursor = cursor;

      const { body } = await client.getItems(boardId, params);
      const nodes = body.data || [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ total: body.total, nodes, cursor: body.cursor }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list mindmap nodes", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing mindmap nodes: ${message}` }] };
    }
  }
);

/**
 * Delete a mindmap node.
 */
server.tool(
  "miro_delete_mindmap_node",
  {
    boardId: z.string().describe("Board ID"),
    itemId: z.string().describe("Mindmap node ID"),
  },
  async ({ boardId, itemId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      await client.deleteMindmapNodeExperimental(boardId, itemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Mindmap node ${itemId} deleted` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete mindmap node", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting mindmap node: ${message}` }] };
    }
  }
);

logger.info("Miro mindmap tools registered");

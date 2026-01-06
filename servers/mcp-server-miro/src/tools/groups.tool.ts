import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createMiroClient, formatGroup } from "../utils/miro-client.js";
import { logger } from "../utils/logger.js";

/**
 * List all groups on a board.
 */
server.tool(
  "miro_list_groups",
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

      const { body } = await client.getAllGroups(boardId, params);
      const groups = ((body as any).data || []).map((g: unknown) => formatGroup(g as Record<string, unknown>));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ groups }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list groups", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing groups: ${message}` }] };
    }
  }
);

/**
 * Get a specific group.
 */
server.tool(
  "miro_get_group",
  {
    boardId: z.string().describe("Board ID"),
    groupId: z.string().describe("Group ID"),
  },
  async ({ boardId, groupId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const { body: group } = await client.getGroupById(boardId, groupId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatGroup(group as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get group", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting group: ${message}` }] };
    }
  }
);

/**
 * Create a group from items.
 */
server.tool(
  "miro_create_group",
  {
    boardId: z.string().describe("Board ID"),
    itemIds: z.array(z.string()).describe("Array of item IDs to group"),
  },
  async ({ boardId, itemIds }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data = {
        items: itemIds.map((id) => ({ id })),
      };

      const { body: group } = await client.createGroup(boardId, data as any);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatGroup(group as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create group", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating group: ${message}` }] };
    }
  }
);

/**
 * Update a group.
 */
server.tool(
  "miro_update_group",
  {
    boardId: z.string().describe("Board ID"),
    groupId: z.string().describe("Group ID"),
    itemIds: z.array(z.string()).describe("New array of item IDs"),
  },
  async ({ boardId, groupId, itemIds }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data = {
        items: itemIds.map((id) => ({ id })),
      };

      const { body: group } = await client.updateGroup(boardId, groupId, data as any);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatGroup(group as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update group", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating group: ${message}` }] };
    }
  }
);

/**
 * Delete a group.
 */
server.tool(
  "miro_delete_group",
  {
    boardId: z.string().describe("Board ID"),
    groupId: z.string().describe("Group ID"),
  },
  async ({ boardId, groupId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      await client.deleteGroup(boardId, groupId, false);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Group ${groupId} deleted` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete group", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting group: ${message}` }] };
    }
  }
);

/**
 * Get items in a group.
 */
server.tool(
  "miro_get_group_items",
  {
    boardId: z.string().describe("Board ID"),
    groupId: z.string().describe("Group ID"),
  },
  async ({ boardId, groupId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const { body } = await client.getItemsByGroupId(boardId, groupId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ groupId, items: (body as any).data || [] }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get group items", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting group items: ${message}` }] };
    }
  }
);

/**
 * Ungroup items.
 */
server.tool(
  "miro_ungroup_items",
  {
    boardId: z.string().describe("Board ID"),
    groupId: z.string().describe("Group ID"),
  },
  async ({ boardId, groupId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      await client.deleteGroup(boardId, groupId, false);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Group ${groupId} ungrouped` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to ungroup items", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error ungrouping items: ${message}` }] };
    }
  }
);

logger.info("Miro group tools registered");

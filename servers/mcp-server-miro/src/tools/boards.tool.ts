import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createMiroClient, formatBoard } from "../utils/miro-client.js";
import { logger } from "../utils/logger.js";

/**
 * List all boards accessible to the user.
 */
server.tool(
  "miro_list_boards",
  {
    teamId: z.string().optional().describe("Filter by team ID"),
    query: z.string().optional().describe("Search query"),
    limit: z.number().optional().describe("Maximum number of results"),
    offset: z.string().optional().describe("Pagination offset"),
  },
  async ({ teamId, query, limit, offset }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const params: Record<string, unknown> = {};
      if (teamId) params.team_id = teamId;
      if (query) params.query = query;
      if (limit) params.limit = limit;
      if (offset) params.offset = offset;

      const { body } = await client.getBoards(params);
      const boards = (body.data || []).map((b: unknown) => formatBoard(b as Record<string, unknown>));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ total: body.total, boards }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list boards", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing boards: ${message}` }] };
    }
  }
);

/**
 * Get a specific board by ID.
 */
server.tool(
  "miro_get_board",
  {
    boardId: z.string().describe("Board ID"),
  },
  async ({ boardId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const { body } = await client.getSpecificBoard(boardId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatBoard(body as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get board", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting board: ${message}` }] };
    }
  }
);

/**
 * Create a new board.
 */
server.tool(
  "miro_create_board",
  {
    name: z.string().describe("Board name"),
    description: z.string().optional().describe("Board description"),
    teamId: z.string().optional().describe("Team ID to create board in"),
    sharingPolicy: z
      .enum(["private", "view", "comment", "edit"])
      .optional()
      .describe("Sharing policy"),
  },
  async ({ name, description, teamId, sharingPolicy }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const boardData: Record<string, unknown> = { name };
      if (description) boardData.description = description;
      if (teamId) boardData.teamId = teamId;
      if (sharingPolicy) {
        boardData.sharingPolicy = { access: sharingPolicy };
      }

      const { body } = await client.createBoard(boardData);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatBoard(body as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create board", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating board: ${message}` }] };
    }
  }
);

/**
 * Update a board.
 */
server.tool(
  "miro_update_board",
  {
    boardId: z.string().describe("Board ID"),
    name: z.string().optional().describe("New board name"),
    description: z.string().optional().describe("New description"),
    sharingPolicy: z
      .enum(["private", "view", "comment", "edit"])
      .optional()
      .describe("New sharing policy"),
  },
  async ({ boardId, name, description, sharingPolicy }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const updateData: Record<string, unknown> = {};
      if (name) updateData.name = name;
      if (description) updateData.description = description;
      if (sharingPolicy) {
        updateData.sharingPolicy = { access: sharingPolicy };
      }

      const { body } = await client.updateBoard(boardId, updateData);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatBoard(body as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update board", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating board: ${message}` }] };
    }
  }
);

/**
 * Delete a board.
 */
server.tool(
  "miro_delete_board",
  {
    boardId: z.string().describe("Board ID"),
  },
  async ({ boardId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      await client.deleteBoard(boardId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Board ${boardId} deleted` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete board", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting board: ${message}` }] };
    }
  }
);

/**
 * Copy a board.
 */
server.tool(
  "miro_copy_board",
  {
    boardId: z.string().describe("Board ID to copy"),
    name: z.string().optional().describe("New board name"),
    teamId: z.string().optional().describe("Team ID for the copy"),
  },
  async ({ boardId, name, teamId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const copyData: Record<string, unknown> = {};
      if (name) copyData.name = name;
      if (teamId) copyData.teamId = teamId;

      const { body } = await client.copyBoard(boardId, copyData);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatBoard(body as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to copy board", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error copying board: ${message}` }] };
    }
  }
);

logger.info("Miro board tools registered");

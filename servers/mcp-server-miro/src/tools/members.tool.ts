import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createMiroClient } from "../utils/miro-client.js";
import { logger } from "../utils/logger.js";

/**
 * List all board members.
 */
server.tool(
  "miro_list_board_members",
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

      const { body } = await client.getBoardMembers(boardId, params);
      const members = ((body as any).data || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        type: m.type,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ total: (body as any).total, members }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list board members", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing board members: ${message}` }] };
    }
  }
);

/**
 * Get a specific board member.
 */
server.tool(
  "miro_get_board_member",
  {
    boardId: z.string().describe("Board ID"),
    memberId: z.string().describe("Member ID"),
  },
  async ({ boardId, memberId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const { body: member } = await client.getSpecificBoardMember(boardId, memberId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(member, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get board member", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting board member: ${message}` }] };
    }
  }
);

/**
 * Share a board with a user.
 */
server.tool(
  "miro_share_board",
  {
    boardId: z.string().describe("Board ID"),
    email: z.string().describe("Email of user to share with"),
    role: z.enum(["viewer", "commenter", "editor", "coowner"]).describe("Role to assign"),
    message: z.string().optional().describe("Optional message to include in invitation"),
  },
  async ({ boardId, email, role, message }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const data: Record<string, unknown> = {
        emails: [email],
        role,
      };
      if (message) data.message = message;

      const { body: result } = await client.shareBoard(boardId, data as any);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Board shared with ${email}`, result }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to share board", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error sharing board: ${message}` }] };
    }
  }
);

/**
 * Update a board member's role.
 */
server.tool(
  "miro_update_board_member",
  {
    boardId: z.string().describe("Board ID"),
    memberId: z.string().describe("Member ID"),
    role: z.enum(["viewer", "commenter", "editor", "coowner"]).describe("New role"),
  },
  async ({ boardId, memberId, role }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      const { body: member } = await client.updateBoardMember(boardId, memberId, { role });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(member, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update board member", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating board member: ${message}` }] };
    }
  }
);

/**
 * Remove a member from a board.
 */
server.tool(
  "miro_remove_board_member",
  {
    boardId: z.string().describe("Board ID"),
    memberId: z.string().describe("Member ID"),
  },
  async ({ boardId, memberId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No Miro token available" }] };
    }

    try {
      const client = createMiroClient(token);
      await client.removeBoardMember(boardId, memberId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Member ${memberId} removed from board` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to remove board member", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error removing board member: ${message}` }] };
    }
  }
);

logger.info("Miro member tools registered");

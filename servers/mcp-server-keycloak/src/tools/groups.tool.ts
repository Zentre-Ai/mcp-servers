import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createKeycloakClient } from "../utils/keycloak-client.js";
import { logger } from "../utils/logger.js";

/**
 * List all groups.
 */
server.tool(
  "keycloak_get_groups",
  {
    search: z.string().optional().describe("Search string for group name"),
    max: z.number().optional().describe("Maximum number of results (default 100)"),
    first: z.number().optional().describe("Pagination offset (first result to return)"),
    briefRepresentation: z.boolean().optional().describe("Return brief representation (default true)"),
  },
  async (params) => {
    const token = getCurrentToken();
    if (!token) {
      return {
        content: [{ type: "text", text: "Error: Not authenticated" }],
        isError: true,
      };
    }

    try {
      const client = createKeycloakClient(token);

      const groups = await client.groups.find({
        search: params.search,
        max: params.max ?? 100,
        first: params.first,
        briefRepresentation: params.briefRepresentation ?? true,
      });

      logger.info(`Found ${groups.length} groups`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(groups, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get groups", error);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error getting groups: ${message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Get members of a group.
 */
server.tool(
  "keycloak_get_group_members",
  {
    groupId: z.string().describe("The group ID (UUID)"),
    max: z.number().optional().describe("Maximum number of results (default 100)"),
    first: z.number().optional().describe("Pagination offset (first result to return)"),
  },
  async ({ groupId, max, first }) => {
    const token = getCurrentToken();
    if (!token) {
      return {
        content: [{ type: "text", text: "Error: Not authenticated" }],
        isError: true,
      };
    }

    try {
      const client = createKeycloakClient(token);

      // Get group info first
      const group = await client.groups.findOne({ id: groupId });
      if (!group) {
        return {
          content: [{ type: "text", text: `Error: Group not found with ID: ${groupId}` }],
          isError: true,
        };
      }

      const members = await client.groups.listMembers({
        id: groupId,
        max: max ?? 100,
        first,
      });

      logger.info(`Found ${members.length} members in group: ${group.name}`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                group: {
                  id: groupId,
                  name: group.name,
                  path: group.path,
                },
                memberCount: members.length,
                members,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get group members", error);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error getting group members: ${message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Add a user to a group.
 */
server.tool(
  "keycloak_add_user_to_group",
  {
    userId: z.string().describe("The user ID (UUID)"),
    groupId: z.string().describe("The group ID (UUID)"),
  },
  async ({ userId, groupId }) => {
    const token = getCurrentToken();
    if (!token) {
      return {
        content: [{ type: "text", text: "Error: Not authenticated" }],
        isError: true,
      };
    }

    try {
      const client = createKeycloakClient(token);

      // Verify user exists
      const user = await client.users.findOne({ id: userId });
      if (!user) {
        return {
          content: [{ type: "text", text: `Error: User not found with ID: ${userId}` }],
          isError: true,
        };
      }

      // Verify group exists
      const group = await client.groups.findOne({ id: groupId });
      if (!group) {
        return {
          content: [{ type: "text", text: `Error: Group not found with ID: ${groupId}` }],
          isError: true,
        };
      }

      await client.users.addToGroup({
        id: userId,
        groupId: groupId,
      });

      logger.info(`Added user '${user.username}' to group '${group.name}'`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: `User '${user.username}' added to group '${group.name}' successfully`,
                user: {
                  id: userId,
                  username: user.username,
                },
                group: {
                  id: groupId,
                  name: group.name,
                  path: group.path,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to add user to group", error);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error adding user to group: ${message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Remove a user from a group.
 */
server.tool(
  "keycloak_remove_user_from_group",
  {
    userId: z.string().describe("The user ID (UUID)"),
    groupId: z.string().describe("The group ID (UUID)"),
  },
  async ({ userId, groupId }) => {
    const token = getCurrentToken();
    if (!token) {
      return {
        content: [{ type: "text", text: "Error: Not authenticated" }],
        isError: true,
      };
    }

    try {
      const client = createKeycloakClient(token);

      // Verify user exists
      const user = await client.users.findOne({ id: userId });
      if (!user) {
        return {
          content: [{ type: "text", text: `Error: User not found with ID: ${userId}` }],
          isError: true,
        };
      }

      // Verify group exists
      const group = await client.groups.findOne({ id: groupId });
      if (!group) {
        return {
          content: [{ type: "text", text: `Error: Group not found with ID: ${groupId}` }],
          isError: true,
        };
      }

      await client.users.delFromGroup({
        id: userId,
        groupId: groupId,
      });

      logger.info(`Removed user '${user.username}' from group '${group.name}'`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: `User '${user.username}' removed from group '${group.name}' successfully`,
                user: {
                  id: userId,
                  username: user.username,
                },
                group: {
                  id: groupId,
                  name: group.name,
                  path: group.path,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to remove user from group", error);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error removing user from group: ${message}` }],
        isError: true,
      };
    }
  }
);

logger.info("Keycloak group tools registered");

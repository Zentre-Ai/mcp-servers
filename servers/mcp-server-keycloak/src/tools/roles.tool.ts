import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createKeycloakClient } from "../utils/keycloak-client.js";
import { logger } from "../utils/logger.js";

/**
 * List realm roles.
 */
server.tool(
  "keycloak_get_realm_roles",
  {
    search: z.string().optional().describe("Search string for role name"),
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

      const roles = await client.roles.find({
        search: params.search,
        max: params.max ?? 100,
        first: params.first,
        briefRepresentation: params.briefRepresentation ?? true,
      });

      logger.info(`Found ${roles.length} realm roles`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(roles, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get realm roles", error);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error getting realm roles: ${message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Get roles assigned to a user.
 */
server.tool(
  "keycloak_get_user_roles",
  {
    userId: z.string().describe("The user ID (UUID)"),
  },
  async ({ userId }) => {
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

      // Get realm role mappings for the user
      const realmRoles = await client.users.listRealmRoleMappings({ id: userId });

      logger.info(`Found ${realmRoles.length} realm roles for user: ${user.username}`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                user: {
                  id: userId,
                  username: user.username,
                },
                realmRoles,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get user roles", error);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error getting user roles: ${message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Add a realm role to a user.
 */
server.tool(
  "keycloak_add_role_to_user",
  {
    userId: z.string().describe("The user ID (UUID)"),
    roleName: z.string().describe("The realm role name to assign"),
  },
  async ({ userId, roleName }) => {
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

      // Get the role by name
      const role = await client.roles.findOneByName({ name: roleName });
      if (!role) {
        return {
          content: [{ type: "text", text: `Error: Role not found with name: ${roleName}` }],
          isError: true,
        };
      }

      // Add realm role mapping to user
      await client.users.addRealmRoleMappings({
        id: userId,
        roles: [
          {
            id: role.id!,
            name: role.name!,
          },
        ],
      });

      logger.info(`Added role '${roleName}' to user '${user.username}'`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: `Role '${roleName}' added to user '${user.username}' successfully`,
                user: {
                  id: userId,
                  username: user.username,
                },
                role: {
                  id: role.id,
                  name: role.name,
                  description: role.description,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to add role to user", error);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error adding role to user: ${message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Remove a realm role from a user.
 */
server.tool(
  "keycloak_remove_role_from_user",
  {
    userId: z.string().describe("The user ID (UUID)"),
    roleName: z.string().describe("The realm role name to remove"),
  },
  async ({ userId, roleName }) => {
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

      // Get the role by name
      const role = await client.roles.findOneByName({ name: roleName });
      if (!role) {
        return {
          content: [{ type: "text", text: `Error: Role not found with name: ${roleName}` }],
          isError: true,
        };
      }

      // Remove realm role mapping from user
      await client.users.delRealmRoleMappings({
        id: userId,
        roles: [
          {
            id: role.id!,
            name: role.name!,
          },
        ],
      });

      logger.info(`Removed role '${roleName}' from user '${user.username}'`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: `Role '${roleName}' removed from user '${user.username}' successfully`,
                user: {
                  id: userId,
                  username: user.username,
                },
                role: {
                  id: role.id,
                  name: role.name,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to remove role from user", error);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error removing role from user: ${message}` }],
        isError: true,
      };
    }
  }
);

logger.info("Keycloak role tools registered");

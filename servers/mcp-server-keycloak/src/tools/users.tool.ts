import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createKeycloakClient } from "../utils/keycloak-client.js";
import { logger } from "../utils/logger.js";

/**
 * List users with optional filtering.
 */
server.tool(
  "keycloak_get_users",
  {
    search: z.string().optional().describe("Search string for username, email, first name, or last name"),
    username: z.string().optional().describe("Filter by exact username"),
    email: z.string().optional().describe("Filter by exact email"),
    firstName: z.string().optional().describe("Filter by first name"),
    lastName: z.string().optional().describe("Filter by last name"),
    enabled: z.boolean().optional().describe("Filter by enabled status"),
    max: z.number().optional().describe("Maximum number of results (default 100)"),
    first: z.number().optional().describe("Pagination offset (first result to return)"),
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

      const users = await client.users.find({
        search: params.search,
        username: params.username,
        email: params.email,
        firstName: params.firstName,
        lastName: params.lastName,
        enabled: params.enabled,
        max: params.max ?? 100,
        first: params.first,
      });

      logger.info(`Found ${users.length} users`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(users, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get users", error);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error getting users: ${message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Get a user by ID.
 */
server.tool(
  "keycloak_get_user",
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

      const user = await client.users.findOne({ id: userId });

      if (!user) {
        return {
          content: [{ type: "text", text: `Error: User not found with ID: ${userId}` }],
          isError: true,
        };
      }

      logger.info(`Found user: ${user.username}`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(user, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get user", error);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error getting user: ${message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Create a new user.
 */
server.tool(
  "keycloak_create_user",
  {
    username: z.string().describe("Username for the new user"),
    email: z.string().optional().describe("Email address"),
    firstName: z.string().optional().describe("First name"),
    lastName: z.string().optional().describe("Last name"),
    enabled: z.boolean().optional().describe("Whether the user is enabled (default true)"),
    emailVerified: z.boolean().optional().describe("Whether the email is verified"),
    password: z.string().optional().describe("Initial password for the user"),
    temporaryPassword: z.boolean().optional().describe("Whether the password is temporary (user must change on first login)"),
    groups: z.array(z.string()).optional().describe("List of group names to add the user to"),
    attributes: z.record(z.array(z.string())).optional().describe("Custom user attributes"),
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

      // Create the user
      const result = await client.users.create({
        username: params.username,
        email: params.email,
        firstName: params.firstName,
        lastName: params.lastName,
        enabled: params.enabled ?? true,
        emailVerified: params.emailVerified,
        groups: params.groups,
        attributes: params.attributes,
      });

      const userId = result.id;

      // Set password if provided
      if (params.password && userId) {
        await client.users.resetPassword({
          id: userId,
          credential: {
            type: "password",
            value: params.password,
            temporary: params.temporaryPassword ?? false,
          },
        });
      }

      logger.info(`Created user: ${params.username} with ID: ${userId}`);

      // Fetch the created user to return full details
      const user = userId ? await client.users.findOne({ id: userId }) : null;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: `User '${params.username}' created successfully`,
                user: user || { id: userId },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create user", error);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error creating user: ${message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Update an existing user.
 */
server.tool(
  "keycloak_update_user",
  {
    userId: z.string().describe("The user ID (UUID)"),
    username: z.string().optional().describe("New username"),
    email: z.string().optional().describe("New email address"),
    firstName: z.string().optional().describe("New first name"),
    lastName: z.string().optional().describe("New last name"),
    enabled: z.boolean().optional().describe("Whether the user is enabled"),
    emailVerified: z.boolean().optional().describe("Whether the email is verified"),
    attributes: z.record(z.array(z.string())).optional().describe("Custom user attributes (replaces existing)"),
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

      // Build update payload with only provided fields
      const updatePayload: Record<string, unknown> = {};
      if (params.username !== undefined) updatePayload.username = params.username;
      if (params.email !== undefined) updatePayload.email = params.email;
      if (params.firstName !== undefined) updatePayload.firstName = params.firstName;
      if (params.lastName !== undefined) updatePayload.lastName = params.lastName;
      if (params.enabled !== undefined) updatePayload.enabled = params.enabled;
      if (params.emailVerified !== undefined) updatePayload.emailVerified = params.emailVerified;
      if (params.attributes !== undefined) updatePayload.attributes = params.attributes;

      await client.users.update({ id: params.userId }, updatePayload);

      logger.info(`Updated user: ${params.userId}`);

      // Fetch the updated user
      const user = await client.users.findOne({ id: params.userId });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: "User updated successfully",
                user,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update user", error);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error updating user: ${message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Delete a user.
 */
server.tool(
  "keycloak_delete_user",
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

      // Get user info before deletion for confirmation
      const user = await client.users.findOne({ id: userId });
      if (!user) {
        return {
          content: [{ type: "text", text: `Error: User not found with ID: ${userId}` }],
          isError: true,
        };
      }

      await client.users.del({ id: userId });

      logger.info(`Deleted user: ${user.username} (${userId})`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: `User '${user.username}' deleted successfully`,
                deletedUser: {
                  id: userId,
                  username: user.username,
                  email: user.email,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete user", error);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error deleting user: ${message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Reset a user's password.
 */
server.tool(
  "keycloak_reset_password",
  {
    userId: z.string().describe("The user ID (UUID)"),
    password: z.string().describe("The new password"),
    temporary: z.boolean().optional().describe("Whether the password is temporary (user must change on first login, default false)"),
  },
  async ({ userId, password, temporary }) => {
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

      await client.users.resetPassword({
        id: userId,
        credential: {
          type: "password",
          value: password,
          temporary: temporary ?? false,
        },
      });

      logger.info(`Reset password for user: ${user.username} (${userId})`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: `Password reset successfully for user '${user.username}'`,
                user: {
                  id: userId,
                  username: user.username,
                },
                temporary: temporary ?? false,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to reset password", error);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error resetting password: ${message}` }],
        isError: true,
      };
    }
  }
);

logger.info("Keycloak user tools registered");

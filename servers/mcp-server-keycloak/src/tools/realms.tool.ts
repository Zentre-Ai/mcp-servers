import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createKeycloakClient } from "../utils/keycloak-client.js";
import { logger } from "../utils/logger.js";

/**
 * List available realms.
 */
server.tool(
  "keycloak_get_realms",
  {
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

      const realms = await client.realms.find({
        briefRepresentation: params.briefRepresentation ?? true,
      });

      logger.info(`Found ${realms.length} realms`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(realms, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get realms", error);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error getting realms: ${message}` }],
        isError: true,
      };
    }
  }
);

logger.info("Keycloak realm tools registered");

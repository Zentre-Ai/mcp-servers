import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./utils/logger.js";

export const server = new McpServer({
  name: "mcp-server-keycloak",
  version: "1.0.0",
});

/**
 * Current access token for the request context.
 * Set before handling each request.
 */
let currentToken: string | null = null;

/**
 * Set the current access token for tool execution.
 */
export function setCurrentToken(token: string | null): void {
  currentToken = token;
  if (token) {
    logger.debug("Access token set for request");
  }
}

/**
 * Get the current access token.
 */
export function getCurrentToken(): string | null {
  return currentToken;
}

/**
 * Register all tools with the server.
 */
export async function registerHandlers(): Promise<void> {
  logger.info("Registering Keycloak MCP handlers...");

  // Import all tools - each tool registers itself with the server
  await import("./tools/users.tool.js");
  await import("./tools/groups.tool.js");
  await import("./tools/roles.tool.js");
  await import("./tools/realms.tool.js");

  logger.info("All Keycloak handlers registered successfully");
}

logger.info("Keycloak MCP server initialized");

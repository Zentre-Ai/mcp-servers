import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./utils/logger.js";

export const server = new McpServer({
  name: "mcp-server-github",
  version: "1.0.0",
});

/**
 * Current GitHub token for the request context.
 * Set before handling each request.
 */
let currentToken: string | null = null;

/**
 * Set the current GitHub token for tool execution.
 */
export function setCurrentToken(token: string | null): void {
  currentToken = token;
  if (token) {
    logger.debug("GitHub token set for request");
  }
}

/**
 * Get the current GitHub token.
 */
export function getCurrentToken(): string | null {
  return currentToken;
}

/**
 * Register all tools with the server.
 */
export async function registerHandlers(): Promise<void> {
  logger.info("Registering GitHub MCP handlers...");

  // Import all tools - each tool registers itself with the server
  await import("./tools/repos.tool.js");
  await import("./tools/issues.tool.js");
  await import("./tools/pulls.tool.js");
  await import("./tools/branches.tool.js");
  await import("./tools/users.tool.js");

  logger.info("All GitHub handlers registered successfully");
}

logger.info("GitHub MCP server initialized");

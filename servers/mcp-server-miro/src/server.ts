import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./utils/logger.js";

export const server = new McpServer({
  name: "mcp-server-miro",
  version: "1.0.0",
});

/**
 * Current Miro token for the request context.
 * Set before handling each request.
 */
let currentToken: string | null = null;

/**
 * Set the current Miro token for tool execution.
 */
export function setCurrentToken(token: string | null): void {
  currentToken = token;
  if (token) {
    logger.debug("Miro token set for request");
  }
}

/**
 * Get the current Miro token.
 */
export function getCurrentToken(): string | null {
  return currentToken;
}

/**
 * Register all tools with the server.
 */
export async function registerHandlers(): Promise<void> {
  logger.info("Registering Miro MCP handlers...");

  // Import all tools - each tool registers itself with the server
  await import("./tools/boards.tool.js");
  await import("./tools/items.tool.js");
  await import("./tools/shapes.tool.js");
  await import("./tools/media.tool.js");
  await import("./tools/connectors.tool.js");
  await import("./tools/tags.tool.js");
  await import("./tools/groups.tool.js");
  await import("./tools/members.tool.js");
  await import("./tools/mindmap.tool.js");
  await import("./tools/bulk.tool.js");
  // Note: Enterprise tools (exports, organization) removed - they require Miro Enterprise plan

  logger.info("All Miro handlers registered successfully");
}

logger.info("Miro MCP server initialized");

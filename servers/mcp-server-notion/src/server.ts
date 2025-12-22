import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./utils/logger.js";

/**
 * MCP Server instance for Notion.
 */
export const server = new McpServer({
  name: "mcp-server-notion",
  version: "1.0.0",
});

/**
 * Global token storage for the current request.
 * This is set before each MCP request is handled.
 */
let currentNotionToken: string | null = null;

export function setCurrentToken(token: string | null): void {
  currentNotionToken = token;
}

export function getCurrentToken(): string | null {
  return currentNotionToken;
}

/**
 * Register all tools with the server.
 */
export async function registerHandlers(): Promise<void> {
  logger.info("Registering Notion MCP handlers...");

  // Import all tools - each tool registers itself with the server
  await import("./tools/search.tool.js");
  await import("./tools/pages.tool.js");
  await import("./tools/databases.tool.js");
  await import("./tools/blocks.tool.js");
  await import("./tools/comments.tool.js");

  logger.info("All Notion handlers registered successfully");
}

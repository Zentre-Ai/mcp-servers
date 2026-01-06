import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./utils/logger.js";

/**
 * MCP Server instance for Slack.
 */
export const server = new McpServer({
  name: "mcp-server-slack",
  version: "1.0.0",
});

/**
 * Global token storage for the current request.
 * This is set before each MCP request is handled.
 */
let currentSlackToken: string | null = null;

export function setCurrentToken(token: string | null): void {
  currentSlackToken = token;
}

export function getCurrentToken(): string | null {
  return currentSlackToken;
}

/**
 * Register all tools with the server.
 */
export async function registerHandlers(): Promise<void> {
  logger.info("Registering Slack MCP handlers...");

  // Import all tools - each tool registers itself with the server
  await import("./tools/messages.tool.js");
  await import("./tools/channels.tool.js");
  await import("./tools/users.tool.js");
  await import("./tools/reactions.tool.js");

  logger.info("All Slack handlers registered successfully");
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./utils/logger.js";

/**
 * MCP Server instance for Gmail.
 */
export const server = new McpServer({
  name: "mcp-server-gmail",
  version: "1.0.0",
});

/**
 * Global token storage for the current request.
 * This is set before each MCP request is handled.
 */
let currentGmailToken: string | null = null;

export function setCurrentToken(token: string | null): void {
  currentGmailToken = token;
}

export function getCurrentToken(): string | null {
  return currentGmailToken;
}

/**
 * Register all tools with the server.
 */
export async function registerHandlers(): Promise<void> {
  logger.info("Registering Gmail MCP handlers...");

  // Import all tools - each tool registers itself with the server
  await import("./tools/emails.tool.js");
  await import("./tools/labels.tool.js");
  await import("./tools/drafts.tool.js");

  logger.info("All Gmail handlers registered successfully");
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./utils/logger.js";

/**
 * MCP Server instance for Google Calendar.
 */
export const server = new McpServer({
  name: "mcp-server-google-calendar",
  version: "1.0.0",
});

/**
 * Global token storage for the current request.
 * This is set before each MCP request is handled.
 */
let currentCalendarToken: string | null = null;

export function setCurrentToken(token: string | null): void {
  currentCalendarToken = token;
}

export function getCurrentToken(): string | null {
  return currentCalendarToken;
}

/**
 * Register all tools with the server.
 */
export async function registerHandlers(): Promise<void> {
  logger.info("Registering Google Calendar MCP handlers...");

  // Import all tools - each tool registers itself with the server
  await import("./tools/events.tool.js");
  await import("./tools/calendars.tool.js");
  await import("./tools/acl.tool.js");

  logger.info("All Google Calendar handlers registered successfully");
}

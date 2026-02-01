import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./utils/logger.js";
import { ZohoPeopleAuth } from "./utils/zoho-people-client.js";

/**
 * MCP Server instance for Zoho People.
 */
export const server = new McpServer({
  name: "mcp-server-zoho-people",
  version: "1.0.0",
});

/**
 * Global auth storage for the current request.
 * This is set before each MCP request is handled.
 */
let currentZohoPeopleAuth: ZohoPeopleAuth | null = null;

export function setCurrentAuth(auth: ZohoPeopleAuth | null): void {
  currentZohoPeopleAuth = auth;
}

export function getCurrentAuth(): ZohoPeopleAuth | null {
  return currentZohoPeopleAuth;
}

/**
 * Register all tools with the server.
 */
export async function registerHandlers(): Promise<void> {
  logger.info("Registering Zoho People MCP handlers...");

  // Import all tools - each tool registers itself with the server
  await import("./tools/employees.tool.js");
  await import("./tools/attendance.tool.js");
  await import("./tools/leave.tool.js");
  await import("./tools/forms.tool.js");

  logger.info("All Zoho People handlers registered successfully");
}

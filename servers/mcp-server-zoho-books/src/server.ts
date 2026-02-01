import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./utils/logger.js";
import { ZohoBooksAuth } from "./utils/zoho-books-client.js";

/**
 * MCP Server instance for Zoho Books.
 */
export const server = new McpServer({
  name: "mcp-server-zoho-books",
  version: "1.0.0",
});

/**
 * Global auth storage for the current request.
 * This is set before each MCP request is handled.
 */
let currentZohoBooksAuth: ZohoBooksAuth | null = null;

export function setCurrentAuth(auth: ZohoBooksAuth | null): void {
  currentZohoBooksAuth = auth;
}

export function getCurrentAuth(): ZohoBooksAuth | null {
  return currentZohoBooksAuth;
}

/**
 * Register all tools with the server.
 */
export async function registerHandlers(): Promise<void> {
  logger.info("Registering Zoho Books MCP handlers...");

  // Import all tools - each tool registers itself with the server
  await import("./tools/invoices.tool.js");
  await import("./tools/contacts.tool.js");
  await import("./tools/bills.tool.js");
  await import("./tools/expenses.tool.js");
  await import("./tools/items.tool.js");
  await import("./tools/organizations.tool.js");

  logger.info("All Zoho Books handlers registered successfully");
}

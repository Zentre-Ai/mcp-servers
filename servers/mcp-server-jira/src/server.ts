import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./utils/logger.js";
import { JiraAuth } from "./utils/jira-client.js";

/**
 * MCP Server instance for Jira.
 */
export const server = new McpServer({
  name: "mcp-server-jira",
  version: "1.0.0",
});

/**
 * Global auth storage for the current request.
 * This is set before each MCP request is handled.
 */
let currentJiraAuth: JiraAuth | null = null;

export function setCurrentAuth(auth: JiraAuth | null): void {
  currentJiraAuth = auth;
}

export function getCurrentAuth(): JiraAuth | null {
  return currentJiraAuth;
}

/**
 * Register all tools with the server.
 */
export async function registerHandlers(): Promise<void> {
  logger.info("Registering Jira MCP handlers...");

  // Import all tools - each tool registers itself with the server
  await import("./tools/issues.tool.js");
  await import("./tools/projects.tool.js");
  await import("./tools/search.tool.js");
  await import("./tools/users.tool.js");

  logger.info("All Jira handlers registered successfully");
}

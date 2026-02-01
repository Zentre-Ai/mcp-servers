import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./utils/logger.js";
import { JiraCloudAuth } from "./utils/jira-cloud-client.js";

/**
 * MCP Server instance for Jira Cloud.
 */
export const server = new McpServer({
  name: "mcp-server-jira-cloud",
  version: "1.0.0",
});

/**
 * Global auth storage for the current request.
 * This is set before each MCP request is handled.
 */
let currentJiraCloudAuth: JiraCloudAuth | null = null;

export function setCurrentAuth(auth: JiraCloudAuth | null): void {
  currentJiraCloudAuth = auth;
}

export function getCurrentAuth(): JiraCloudAuth | null {
  return currentJiraCloudAuth;
}

/**
 * Register all tools with the server.
 */
export async function registerHandlers(): Promise<void> {
  logger.info("Registering Jira Cloud MCP handlers...");

  // Import all tools - each tool registers itself with the server
  await import("./tools/issues.tool.js");
  await import("./tools/projects.tool.js");
  await import("./tools/search.tool.js");
  await import("./tools/users.tool.js");

  logger.info("All Jira Cloud handlers registered successfully");
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./utils/logger.js";
import { GitLabAuth } from "./utils/gitlab-client.js";

/**
 * MCP Server instance for GitLab.
 */
export const server = new McpServer({
  name: "mcp-server-gitlab",
  version: "1.0.0",
});

/**
 * Global auth storage for the current request.
 * This is set before each MCP request is handled.
 */
let currentGitLabAuth: GitLabAuth | null = null;

export function setCurrentAuth(auth: GitLabAuth | null): void {
  currentGitLabAuth = auth;
}

export function getCurrentAuth(): GitLabAuth | null {
  return currentGitLabAuth;
}

/**
 * Register all tools with the server.
 */
export async function registerHandlers(): Promise<void> {
  logger.info("Registering GitLab MCP handlers...");

  // Import all tools - each tool registers itself with the server
  await import("./tools/users.tool.js");
  await import("./tools/projects.tool.js");
  await import("./tools/issues.tool.js");
  await import("./tools/merge-requests.tool.js");
  await import("./tools/branches.tool.js");

  logger.info("All GitLab handlers registered successfully");
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./utils/logger.js";

/**
 * MCP Server instance.
 *
 * This server is configured and exported for use by:
 * - Tool registrations in src/tools/
 * - Resource registrations in src/resources/
 * - Prompt registrations in src/prompts/
 *
 * The transport connection is handled in src/index.ts
 */
export const server = new McpServer({
  name: "mcp-server-example",
  version: "1.0.0",
});

/**
 * Import and register all tools, resources, and prompts.
 * Each file in the respective directories should register itself with the server.
 */
export async function registerHandlers(): Promise<void> {
  logger.info("Registering MCP handlers...");

  // Import tools
  await import("./tools/example.tool.js");

  // Import resources
  await import("./resources/example.resource.js");

  // Import prompts
  await import("./prompts/example.prompt.js");

  logger.info("All handlers registered successfully");
}

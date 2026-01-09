import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ElasticsearchAuth } from "./utils/elasticsearch-client.js";
import { logger } from "./utils/logger.js";

export const server = new McpServer({
  name: "mcp-server-elasticsearch",
  version: "1.0.0",
});

// Request-scoped auth storage
let currentAuth: ElasticsearchAuth | null = null;

export function setCurrentAuth(auth: ElasticsearchAuth | null): void {
  currentAuth = auth;
}

export function getCurrentAuth(): ElasticsearchAuth | null {
  return currentAuth;
}

export async function registerHandlers(): Promise<void> {
  logger.info("Registering Elasticsearch MCP handlers...");

  // Import tools to register them
  await import("./tools/elasticsearch.tool.js");

  logger.info("All Elasticsearch handlers registered successfully");
}

logger.info("Elasticsearch MCP server initialized");

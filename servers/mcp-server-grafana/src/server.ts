import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./utils/logger.js";
import { GrafanaAuth } from "./utils/grafana-client.js";

/**
 * MCP Server instance for Grafana.
 */
export const server = new McpServer({
  name: "mcp-server-grafana",
  version: "1.0.0",
});

/**
 * Current Grafana auth for the request context.
 * Set before handling each request.
 */
let currentAuth: GrafanaAuth | null = null;

/**
 * Set the current Grafana auth for tool execution.
 */
export function setCurrentAuth(auth: GrafanaAuth | null): void {
  currentAuth = auth;
  if (auth) {
    logger.debug("Grafana auth set for request");
  }
}

/**
 * Get the current Grafana auth.
 */
export function getCurrentAuth(): GrafanaAuth | null {
  return currentAuth;
}

/**
 * Register all tools with the server.
 */
export async function registerHandlers(): Promise<void> {
  logger.info("Registering Grafana MCP handlers...");

  // Import all tools - each tool registers itself with the server
  await import("./tools/dashboards.tool.js");
  await import("./tools/datasources.tool.js");
  await import("./tools/search.tool.js");
  await import("./tools/prometheus.tool.js");
  await import("./tools/loki.tool.js");
  await import("./tools/alerting.tool.js");
  await import("./tools/annotations.tool.js");
  await import("./tools/oncall.tool.js");
  await import("./tools/incidents.tool.js");
  await import("./tools/sift.tool.js");
  await import("./tools/pyroscope.tool.js");
  await import("./tools/admin.tool.js");
  await import("./tools/folders.tool.js");
  await import("./tools/navigation.tool.js");

  logger.info("All Grafana handlers registered successfully");
}

logger.info("Grafana MCP server initialized");

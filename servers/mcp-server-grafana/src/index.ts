#!/usr/bin/env node

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { server, registerHandlers, setCurrentAuth } from "./server.js";
import { extractGrafanaAuth } from "./utils/grafana-client.js";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";

/**
 * Start the HTTP server with MCP transport.
 */
async function startHttpServer(port: number): Promise<void> {
  // Create Streamable HTTP transport in stateless mode
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode
  });

  // Connect transport to MCP server
  await server.connect(transport);

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-grafana-url, x-grafana-token, mcp-session-id"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check endpoint
    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "mcp-server-grafana" }));
      return;
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      // Extract Grafana auth from headers
      const headers = req.headers as Record<string, string | string[] | undefined>;
      const auth = extractGrafanaAuth(headers);

      if (!auth) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Unauthorized",
            message:
              "Missing Grafana credentials. Provide x-grafana-url and x-grafana-token headers, or x-grafana-url with Authorization: Bearer token",
          })
        );
        return;
      }

      // Store auth for use by tools
      setCurrentAuth(auth);

      try {
        await transport.handleRequest(req, res);
      } finally {
        // Clear auth after request
        setCurrentAuth(null);
      }
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  httpServer.listen(port, () => {
    logger.info(`Starting Grafana MCP server on port ${port}`);
    logger.info(`Grafana MCP server running on http://localhost:${port}`);
    logger.info(`  MCP endpoint: http://localhost:${port}/mcp`);
    logger.info(`  Health check: http://localhost:${port}/health`);
    logger.info("");
    logger.info("Authentication:");
    logger.info("  x-grafana-url: https://your-grafana-instance.com");
    logger.info("  x-grafana-token: your-service-account-token");
    logger.info("  or");
    logger.info("  Authorization: Bearer your-service-account-token");
  });
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  try {
    // Register all handlers
    await registerHandlers();

    // Start HTTP server
    await startHttpServer(config.PORT);

    // Handle graceful shutdown
    const shutdown = async () => {
      logger.info("Shutting down Grafana MCP server...");
      await server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
}

main();

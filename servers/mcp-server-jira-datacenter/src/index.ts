#!/usr/bin/env node

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { server, registerHandlers, setCurrentAuth } from "./server.js";
import { extractJiraAuth } from "./utils/jira-client.js";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";

/**
 * Start the MCP server with HTTP transport.
 * Credentials are extracted from request headers for each request.
 */
async function startHttpServer(port: number): Promise<void> {
  logger.info(`Starting Jira MCP server on port ${port}`);

  // Create Streamable HTTP transport
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
      "Content-Type, Authorization, x-jira-host, x-jira-email, x-jira-token, mcp-session-id"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check endpoint
    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "mcp-server-jira-datacenter" }));
      return;
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      // Extract Jira auth from headers
      const auth = extractJiraAuth(req.headers as Record<string, string | string[] | undefined>);

      if (!auth) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Unauthorized",
            message:
              "Missing Jira credentials. Provide x-jira-host and either (x-jira-email + x-jira-token) or Authorization: Bearer token",
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
    logger.info(`Jira MCP server running on http://localhost:${port}`);
    logger.info(`  MCP endpoint: http://localhost:${port}/mcp`);
    logger.info(`  Health check: http://localhost:${port}/health`);
    logger.info("");
    logger.info("Authentication options:");
    logger.info("  Option 1 - API Token:");
    logger.info("    x-jira-host: your-domain.atlassian.net");
    logger.info("    x-jira-email: your-email@example.com");
    logger.info("    x-jira-token: your-api-token");
    logger.info("  Option 2 - OAuth Bearer:");
    logger.info("    x-jira-host: your-domain.atlassian.net");
    logger.info("    Authorization: Bearer your-oauth-token");
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
      logger.info("Shutting down Jira MCP server...");
      await server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error("Failed to start Jira MCP server", error);
    process.exit(1);
  }
}

main();

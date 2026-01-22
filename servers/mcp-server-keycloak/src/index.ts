#!/usr/bin/env node

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { server, registerHandlers, setCurrentToken } from "./server.js";
import { extractBearerToken } from "./utils/keycloak-client.js";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";

/**
 * Start the MCP server with HTTP transport.
 * Access token is extracted from request headers for each request.
 */
async function startHttpServer(port: number): Promise<void> {
  logger.info(`Starting Keycloak MCP server on port ${port}`);

  // Create Streamable HTTP transport
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode
  });

  // Connect transport to MCP server
  await server.connect(transport);

  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    void handleRequest(req, res, port, transport);
  });

  /**
   * Handle incoming HTTP requests.
   */
  async function handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
    serverPort: number,
    httpTransport: StreamableHTTPServerTransport
  ): Promise<void> {
    const url = new URL(req.url || "/", `http://localhost:${serverPort}`);

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, mcp-session-id"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check endpoint
    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "mcp-server-keycloak" }));
      return;
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      // Extract Bearer token from Authorization header
      const token = extractBearerToken(req.headers as Record<string, string | string[] | undefined>);

      if (!token) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Unauthorized",
            message: "Missing Authorization header. Provide Authorization: Bearer <access_token>",
          })
        );
        return;
      }

      // Store token for use by tools
      setCurrentToken(token);

      try {
        await httpTransport.handleRequest(req, res);
      } finally {
        // Clear token after request
        setCurrentToken(null);
      }
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }

  httpServer.listen(port, () => {
    logger.info(`Keycloak MCP server running on http://localhost:${port}`);
    logger.info(`  MCP endpoint: http://localhost:${port}/mcp`);
    logger.info(`  Health check: http://localhost:${port}/health`);
    logger.info("");
    logger.info("Authentication:");
    logger.info("  Authorization: Bearer <keycloak_access_token>");
    logger.info("");
    logger.info("Keycloak Configuration:");
    logger.info(`  URL: ${config.KEYCLOAK_URL}`);
    logger.info(`  Realm: ${config.KEYCLOAK_REALM}`);
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
    const shutdown = () => {
      logger.info("Shutting down Keycloak MCP server...");
      server.close().then(() => {
        process.exit(0);
      }).catch((err: unknown) => {
        logger.error("Error during shutdown", err);
        process.exit(1);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error("Failed to start Keycloak MCP server", error);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  logger.error("Unhandled error in main", error);
  process.exit(1);
});

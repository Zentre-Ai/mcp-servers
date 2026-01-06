#!/usr/bin/env node

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { server, registerHandlers, setCurrentToken } from "./server.js";
import { extractCalendarToken } from "./utils/calendar-client.js";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";

/**
 * Start the MCP server with HTTP transport.
 * Token is extracted from request headers for each request.
 */
async function startHttpServer(port: number): Promise<void> {
  logger.info(`Starting Google Calendar MCP server on port ${port}`);

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
      "Content-Type, Authorization, x-calendar-token, mcp-session-id"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check endpoint
    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "mcp-server-google-calendar" }));
      return;
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      // Extract Calendar token from headers
      const token = extractCalendarToken(req.headers as Record<string, string | string[] | undefined>);

      if (!token) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Unauthorized",
            message:
              "Missing Google Calendar access token. Provide via x-calendar-token header or Authorization: Bearer token",
          })
        );
        return;
      }

      // Store token for use by tools
      setCurrentToken(token);

      try {
        await transport.handleRequest(req, res);
      } finally {
        // Clear token after request
        setCurrentToken(null);
      }
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  httpServer.listen(port, () => {
    logger.info(`Google Calendar MCP server running on http://localhost:${port}`);
    logger.info(`  MCP endpoint: http://localhost:${port}/mcp`);
    logger.info(`  Health check: http://localhost:${port}/health`);
    logger.info("");
    logger.info("Authentication: Pass Google OAuth access token via headers:");
    logger.info("  x-calendar-token: ya29.****");
    logger.info("  Authorization: Bearer ya29.****");
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
      logger.info("Shutting down Google Calendar MCP server...");
      await server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error("Failed to start Google Calendar MCP server", error);
    process.exit(1);
  }
}

main();

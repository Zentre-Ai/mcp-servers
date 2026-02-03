#!/usr/bin/env node

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { server, registerHandlers, setCurrentAuth } from "./server.js";
import { extractStripeAuth } from "./utils/stripe-client.js";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";

/**
 * Send JSON response.
 */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

/**
 * Start the MCP server with HTTP transport.
 * Credentials are extracted from request headers for each request.
 */
async function startHttpServer(port: number): Promise<void> {
  logger.info(`Starting Stripe MCP server on port ${port}`);

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
      "Content-Type, x-stripe-api-key, x-stripe-account, mcp-session-id"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check endpoint
    if (url.pathname === "/health" && req.method === "GET") {
      sendJson(res, 200, { status: "ok", server: "mcp-server-stripe" });
      return;
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      // Extract Stripe auth from headers
      const auth = extractStripeAuth(req.headers as Record<string, string | string[] | undefined>);

      if (!auth) {
        sendJson(res, 401, {
          error: "Unauthorized",
          message: "Missing Stripe API key. Provide x-stripe-api-key header",
        });
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
    sendJson(res, 404, { error: "Not found" });
  });

  httpServer.listen(port, () => {
    logger.info(`Stripe MCP server running on http://localhost:${port}`);
    logger.info("");
    logger.info("Endpoints:");
    logger.info(`  MCP:           POST http://localhost:${port}/mcp`);
    logger.info(`  Health:        GET  http://localhost:${port}/health`);
    logger.info("");
    logger.info("Authentication:");
    logger.info("  x-stripe-api-key: <your-stripe-secret-key> (required)");
    logger.info("  x-stripe-account: <stripe-account-id> (optional, for connected accounts)");
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
      logger.info("Shutting down Stripe MCP server...");
      await server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error("Failed to start Stripe MCP server", error);
    process.exit(1);
  }
}

main();

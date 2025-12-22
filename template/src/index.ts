#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { server, registerHandlers } from "./server.js";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";

/**
 * Parse command line arguments to determine transport type.
 */
function parseArgs(): { transport: "stdio" | "http"; port: number } {
  const args = process.argv.slice(2);
  const isHttp = args.includes("--http");
  const portIndex = args.indexOf("--port");
  const port = portIndex !== -1 ? parseInt(args[portIndex + 1], 10) : config.PORT;

  return {
    transport: isHttp ? "http" : "stdio",
    port: isNaN(port) ? config.PORT : port,
  };
}

/**
 * Start the MCP server with STDIO transport.
 * Used for local integrations (Claude Desktop, Cursor, etc.)
 */
async function startStdioServer(): Promise<void> {
  logger.info("Starting MCP server with STDIO transport");

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("MCP server running on STDIO");
}

/**
 * Start the MCP server with HTTP/SSE transport.
 * Used for remote deployments.
 */
async function startHttpServer(port: number): Promise<void> {
  logger.info(`Starting MCP server with HTTP transport on port ${port}`);

  // Track active SSE transports
  const transports = new Map<string, SSEServerTransport>();

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check endpoint
    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // SSE endpoint for establishing connection
    if (url.pathname === "/sse" && req.method === "GET") {
      const transport = new SSEServerTransport("/message", res);
      const sessionId = crypto.randomUUID();
      transports.set(sessionId, transport);

      res.on("close", () => {
        transports.delete(sessionId);
        logger.info(`SSE connection closed: ${sessionId}`);
      });

      await server.connect(transport);
      logger.info(`SSE connection established: ${sessionId}`);
      return;
    }

    // Message endpoint for receiving requests
    if (url.pathname === "/message" && req.method === "POST") {
      const sessionId = url.searchParams.get("sessionId");
      const transport = sessionId ? transports.get(sessionId) : null;

      if (!transport) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid session" }));
        return;
      }

      await transport.handlePostMessage(req, res);
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  httpServer.listen(port, () => {
    logger.info(`MCP server running on http://localhost:${port}`);
    logger.info(`  SSE endpoint: http://localhost:${port}/sse`);
    logger.info(`  Health check: http://localhost:${port}/health`);
  });
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  try {
    // Register all handlers
    await registerHandlers();

    // Parse arguments and start appropriate transport
    const { transport, port } = parseArgs();

    if (transport === "http") {
      await startHttpServer(port);
    } else {
      await startStdioServer();
    }

    // Handle graceful shutdown
    const shutdown = async () => {
      logger.info("Shutting down MCP server...");
      await server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error("Failed to start MCP server", error);
    process.exit(1);
  }
}

main();

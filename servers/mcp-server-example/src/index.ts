#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
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
 * Start the MCP server with Streamable HTTP transport.
 * Used for remote deployments.
 */
async function startHttpServer(port: number): Promise<void> {
  logger.info(`Starting MCP server with HTTP transport on port ${port}`);

  // Create Streamable HTTP transport (stateless mode)
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
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");

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

    // MCP endpoint - handles all MCP requests (GET for SSE, POST for messages)
    if (url.pathname === "/mcp") {
      await transport.handleRequest(req, res);
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  httpServer.listen(port, () => {
    logger.info(`MCP server running on http://localhost:${port}`);
    logger.info(`  MCP endpoint: http://localhost:${port}/mcp`);
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

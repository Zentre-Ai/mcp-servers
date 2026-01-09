import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { server, setCurrentAuth, registerHandlers } from "./server.js";
import { extractElasticsearchAuth } from "./utils/elasticsearch-client.js";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";

async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Extract auth from headers
  const headers: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    headers[key.toLowerCase()] = value;
  }

  const auth = extractElasticsearchAuth(headers);
  if (!auth) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Missing Elasticsearch credentials. Provide x-elasticsearch-url and either x-elasticsearch-api-key or x-elasticsearch-username/x-elasticsearch-password headers.",
      })
    );
    return;
  }

  // Set auth for this request
  setCurrentAuth(auth);

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close();
      setCurrentAuth(null);
    });

    await transport.handleRequest(req, res, await server.connect(transport));
  } catch (error) {
    logger.error("Error handling MCP request", error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  } finally {
    setCurrentAuth(null);
  }
}

function handleHealthCheck(_req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", server: "mcp-server-elasticsearch" }));
}

async function main(): Promise<void> {
  // Register all handlers
  await registerHandlers();

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, x-elasticsearch-url, x-elasticsearch-api-key, x-elasticsearch-username, x-elasticsearch-password, x-elasticsearch-skip-ssl"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname === "/health" && req.method === "GET") {
      handleHealthCheck(req, res);
    } else if (url.pathname === "/mcp" && req.method === "POST") {
      await handleMcpRequest(req, res);
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  });

  httpServer.listen(config.port, () => {
    logger.info(`Elasticsearch MCP server running on http://localhost:${config.port}`);
    logger.info("Endpoints:");
    logger.info(`  POST /mcp - MCP protocol endpoint`);
    logger.info(`  GET /health - Health check`);
  });
}

main().catch((error) => {
  logger.error("Failed to start server", error);
  process.exit(1);
});

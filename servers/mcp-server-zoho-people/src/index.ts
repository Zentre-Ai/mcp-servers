#!/usr/bin/env node

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { server, registerHandlers, setCurrentAuth } from "./server.js";
import { extractZohoPeopleAuth } from "./utils/zoho-people-client.js";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { getAllDatacenters, getDatacenterConfig, ZohoDatacenter } from "./utils/datacenters.js";
import {
  generateState,
  generateAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
} from "./utils/oauth.js";

/**
 * Parse JSON body from request.
 */
async function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf-8");
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * Send JSON response.
 */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

/**
 * Get the client secret for a specific datacenter.
 */
function getClientSecret(datacenter: ZohoDatacenter): string | undefined {
  switch (datacenter) {
    case "eu":
      return config.ZOHO_CLIENT_SECRET_EU || config.ZOHO_CLIENT_SECRET;
    case "in":
      return config.ZOHO_CLIENT_SECRET_IN || config.ZOHO_CLIENT_SECRET;
    case "com.au":
      return config.ZOHO_CLIENT_SECRET_AU || config.ZOHO_CLIENT_SECRET;
    case "jp":
      return config.ZOHO_CLIENT_SECRET_JP || config.ZOHO_CLIENT_SECRET;
    case "com.cn":
      return config.ZOHO_CLIENT_SECRET_CN || config.ZOHO_CLIENT_SECRET;
    default:
      return config.ZOHO_CLIENT_SECRET;
  }
}

/**
 * Start the MCP server with HTTP transport.
 */
async function startHttpServer(port: number): Promise<void> {
  logger.info(`Starting Zoho People MCP server on port ${port}`);

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
      "Content-Type, Authorization, x-zoho-datacenter, mcp-session-id"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check endpoint
    if (url.pathname === "/health" && req.method === "GET") {
      sendJson(res, 200, { status: "ok", server: "mcp-server-zoho-people" });
      return;
    }

    // List available datacenters
    if (url.pathname === "/datacenters" && req.method === "GET") {
      sendJson(res, 200, { datacenters: getAllDatacenters() });
      return;
    }

    // OAuth: Get authorization URL
    if (url.pathname === "/oauth/authorize" && req.method === "GET") {
      try {
        if (!config.ZOHO_CLIENT_ID) {
          sendJson(res, 500, { error: "OAuth not configured", message: "ZOHO_CLIENT_ID is required" });
          return;
        }

        const redirectUri = url.searchParams.get("redirect_uri") || config.OAUTH_REDIRECT_URI;
        if (!redirectUri) {
          sendJson(res, 400, { error: "Missing redirect_uri", message: "Provide redirect_uri query param or configure OAUTH_REDIRECT_URI" });
          return;
        }

        const datacenter = (url.searchParams.get("dc") || "com") as ZohoDatacenter;
        const accessType = (url.searchParams.get("access_type") || "offline") as "offline" | "online";
        const prompt = (url.searchParams.get("prompt") || "consent") as "consent" | "";

        const state = generateState();
        const dcConfig = getDatacenterConfig(datacenter);

        const authorizationUrl = generateAuthorizationUrl(
          config.ZOHO_CLIENT_ID,
          redirectUri,
          config.OAUTH_SCOPES,
          state,
          datacenter,
          accessType,
          prompt
        );

        sendJson(res, 200, {
          authorizationUrl,
          state,
          redirectUri,
          datacenter,
          datacenterName: dcConfig.name,
        });
      } catch (error) {
        logger.error("Failed to generate authorization URL", error);
        sendJson(res, 500, { error: "Failed to generate authorization URL", message: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    // OAuth: Callback - exchange code for tokens
    if (url.pathname === "/oauth/callback" && req.method === "POST") {
      try {
        if (!config.ZOHO_CLIENT_ID) {
          sendJson(res, 500, { error: "OAuth not configured", message: "ZOHO_CLIENT_ID is required" });
          return;
        }

        const body = await parseJsonBody(req);
        const code = body.code as string;
        const redirectUri = (body.redirectUri as string) || config.OAUTH_REDIRECT_URI;
        const datacenter = (body.datacenter as ZohoDatacenter) || "com";

        if (!code || !redirectUri) {
          sendJson(res, 400, { error: "Missing parameters", message: "code and redirectUri are required" });
          return;
        }

        const clientSecret = getClientSecret(datacenter);
        if (!clientSecret) {
          sendJson(res, 500, { error: "OAuth not configured", message: `ZOHO_CLIENT_SECRET is required for datacenter ${datacenter}` });
          return;
        }

        const tokens = await exchangeCodeForTokens(
          code,
          config.ZOHO_CLIENT_ID,
          clientSecret,
          redirectUri,
          datacenter
        );

        sendJson(res, 200, {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          tokenType: tokens.tokenType,
          scope: tokens.scope,
          apiDomain: tokens.apiDomain,
          datacenter,
        });
      } catch (error) {
        logger.error("OAuth callback failed", error);
        sendJson(res, 500, { error: "OAuth callback failed", message: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    // OAuth: Refresh token
    if (url.pathname === "/oauth/refresh" && req.method === "POST") {
      try {
        if (!config.ZOHO_CLIENT_ID) {
          sendJson(res, 500, { error: "OAuth not configured", message: "ZOHO_CLIENT_ID is required" });
          return;
        }

        const body = await parseJsonBody(req);
        const refreshToken = body.refreshToken as string;
        const datacenter = (body.datacenter as ZohoDatacenter) || "com";

        if (!refreshToken) {
          sendJson(res, 400, { error: "Missing parameters", message: "refreshToken is required" });
          return;
        }

        const clientSecret = getClientSecret(datacenter);
        if (!clientSecret) {
          sendJson(res, 500, { error: "OAuth not configured", message: `ZOHO_CLIENT_SECRET is required for datacenter ${datacenter}` });
          return;
        }

        const tokens = await refreshAccessToken(
          refreshToken,
          config.ZOHO_CLIENT_ID,
          clientSecret,
          datacenter
        );

        sendJson(res, 200, {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          tokenType: tokens.tokenType,
          scope: tokens.scope,
          apiDomain: tokens.apiDomain,
          datacenter,
        });
      } catch (error) {
        logger.error("Token refresh failed", error);
        sendJson(res, 500, { error: "Token refresh failed", message: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      // Extract Zoho People auth from headers
      const auth = extractZohoPeopleAuth(req.headers as Record<string, string | string[] | undefined>);

      if (!auth) {
        sendJson(res, 401, {
          error: "Unauthorized",
          message: "Missing Zoho People credentials. Provide Authorization: Zoho-oauthtoken <token> header",
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
    logger.info(`Zoho People MCP server running on http://localhost:${port}`);
    logger.info("");
    logger.info("Endpoints:");
    logger.info(`  MCP:              POST http://localhost:${port}/mcp`);
    logger.info(`  Health:           GET  http://localhost:${port}/health`);
    logger.info(`  Datacenters:      GET  http://localhost:${port}/datacenters`);
    logger.info("");
    logger.info("OAuth 2.0 Endpoints:");
    logger.info(`  Authorize:        GET  http://localhost:${port}/oauth/authorize`);
    logger.info(`  Callback:         POST http://localhost:${port}/oauth/callback`);
    logger.info(`  Refresh:          POST http://localhost:${port}/oauth/refresh`);
    logger.info("");
    logger.info("MCP Authentication:");
    logger.info("  Authorization: Zoho-oauthtoken <accessToken>");
    logger.info("  x-zoho-datacenter: <datacenter> (optional, default: com)");
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
      logger.info("Shutting down Zoho People MCP server...");
      await server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error("Failed to start Zoho People MCP server", error);
    process.exit(1);
  }
}

main();

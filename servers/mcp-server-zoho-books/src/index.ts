#!/usr/bin/env node

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { server, registerHandlers, setCurrentAuth } from "./server.js";
import { extractZohoBooksAuth } from "./utils/zoho-books-client.js";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { getAllDatacenters, getDatacenterConfig, ZohoDatacenter } from "./utils/datacenters.js";
import {
  generateState,
  generateAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getOrganizations,
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
  logger.info(`Starting Zoho Books MCP server on port ${port}`);

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
      "Content-Type, Authorization, x-zoho-organization-id, x-zoho-datacenter, mcp-session-id"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check endpoint
    if (url.pathname === "/health" && req.method === "GET") {
      sendJson(res, 200, { status: "ok", server: "mcp-server-zoho-books" });
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

        // Get accessible organizations
        const organizations = await getOrganizations(tokens.accessToken, datacenter);

        sendJson(res, 200, {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          tokenType: tokens.tokenType,
          scope: tokens.scope,
          apiDomain: tokens.apiDomain,
          datacenter,
          organizations,
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

    // OAuth: Get organizations
    if (url.pathname === "/oauth/organizations" && req.method === "GET") {
      try {
        const authHeader = req.headers["authorization"];
        if (!authHeader || typeof authHeader !== "string") {
          sendJson(res, 401, { error: "Unauthorized", message: "Authorization header with Zoho-oauthtoken required" });
          return;
        }

        const zohoMatch = authHeader.match(/^Zoho-oauthtoken\s+(.+)$/i);
        if (!zohoMatch) {
          sendJson(res, 401, { error: "Unauthorized", message: "Invalid Authorization header format. Use: Zoho-oauthtoken <token>" });
          return;
        }

        const accessToken = zohoMatch[1];
        const datacenter = (req.headers["x-zoho-datacenter"] as ZohoDatacenter) || "com";

        const organizations = await getOrganizations(accessToken, datacenter);

        sendJson(res, 200, { organizations });
      } catch (error) {
        logger.error("Failed to fetch organizations", error);
        sendJson(res, 500, { error: "Failed to fetch organizations", message: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      // Extract Zoho Books auth from headers
      const auth = extractZohoBooksAuth(req.headers as Record<string, string | string[] | undefined>);

      if (!auth) {
        sendJson(res, 401, {
          error: "Unauthorized",
          message: "Missing Zoho Books credentials. Provide Authorization: Zoho-oauthtoken <token> and x-zoho-organization-id: <orgId> headers",
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
    logger.info(`Zoho Books MCP server running on http://localhost:${port}`);
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
    logger.info(`  Organizations:    GET  http://localhost:${port}/oauth/organizations`);
    logger.info("");
    logger.info("MCP Authentication:");
    logger.info("  Authorization: Zoho-oauthtoken <accessToken>");
    logger.info("  x-zoho-organization-id: <organizationId>");
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
      logger.info("Shutting down Zoho Books MCP server...");
      await server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error("Failed to start Zoho Books MCP server", error);
    process.exit(1);
  }
}

main();

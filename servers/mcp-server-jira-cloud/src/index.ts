#!/usr/bin/env node

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { server, registerHandlers, setCurrentAuth, resolveCloudId } from "./server.js";
import { extractAccessToken } from "./utils/jira-cloud-client.js";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import {
  generatePKCE,
  generateState,
  generateAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getAccessibleResources,
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
      } catch (error) {
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
 * Start the MCP server with HTTP transport.
 * Credentials are extracted from request headers for each request.
 */
async function startHttpServer(port: number): Promise<void> {
  logger.info(`Starting Jira Cloud MCP server on port ${port}`);

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
      "Content-Type, Authorization, mcp-session-id"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check endpoint
    if (url.pathname === "/health" && req.method === "GET") {
      sendJson(res, 200, { status: "ok", server: "mcp-server-jira-cloud" });
      return;
    }

    // OAuth: Get authorization URL
    if (url.pathname === "/oauth/authorize" && req.method === "GET") {
      try {
        if (!config.ATLASSIAN_CLIENT_ID) {
          sendJson(res, 500, { error: "OAuth not configured", message: "ATLASSIAN_CLIENT_ID is required" });
          return;
        }

        const redirectUri = url.searchParams.get("redirect_uri") || config.OAUTH_REDIRECT_URI;
        if (!redirectUri) {
          sendJson(res, 400, { error: "Missing redirect_uri", message: "Provide redirect_uri query param or configure OAUTH_REDIRECT_URI" });
          return;
        }

        const { codeVerifier, codeChallenge } = generatePKCE();
        const state = generateState();

        const authorizationUrl = generateAuthorizationUrl(
          config.ATLASSIAN_CLIENT_ID,
          redirectUri,
          config.OAUTH_SCOPES,
          state,
          codeChallenge
        );

        sendJson(res, 200, {
          authorizationUrl,
          state,
          codeVerifier,
          redirectUri,
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
        if (!config.ATLASSIAN_CLIENT_ID || !config.ATLASSIAN_CLIENT_SECRET) {
          sendJson(res, 500, { error: "OAuth not configured", message: "ATLASSIAN_CLIENT_ID and ATLASSIAN_CLIENT_SECRET are required" });
          return;
        }

        const body = await parseJsonBody(req);
        const code = body.code as string;
        const codeVerifier = body.codeVerifier as string;
        const redirectUri = body.redirectUri as string || config.OAUTH_REDIRECT_URI;

        if (!code || !codeVerifier || !redirectUri) {
          sendJson(res, 400, { error: "Missing parameters", message: "code, codeVerifier, and redirectUri are required" });
          return;
        }

        const tokens = await exchangeCodeForTokens(
          code,
          config.ATLASSIAN_CLIENT_ID,
          config.ATLASSIAN_CLIENT_SECRET,
          redirectUri,
          codeVerifier
        );

        // Get accessible sites
        const sites = await getAccessibleResources(tokens.accessToken);

        sendJson(res, 200, {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          tokenType: tokens.tokenType,
          scope: tokens.scope,
          sites,
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
        if (!config.ATLASSIAN_CLIENT_ID || !config.ATLASSIAN_CLIENT_SECRET) {
          sendJson(res, 500, { error: "OAuth not configured", message: "ATLASSIAN_CLIENT_ID and ATLASSIAN_CLIENT_SECRET are required" });
          return;
        }

        const body = await parseJsonBody(req);
        const refreshToken = body.refreshToken as string;

        if (!refreshToken) {
          sendJson(res, 400, { error: "Missing parameters", message: "refreshToken is required" });
          return;
        }

        const tokens = await refreshAccessToken(
          refreshToken,
          config.ATLASSIAN_CLIENT_ID,
          config.ATLASSIAN_CLIENT_SECRET
        );

        sendJson(res, 200, {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          tokenType: tokens.tokenType,
          scope: tokens.scope,
        });
      } catch (error) {
        logger.error("Token refresh failed", error);
        sendJson(res, 500, { error: "Token refresh failed", message: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    // OAuth: Get accessible sites
    if (url.pathname === "/oauth/sites" && req.method === "GET") {
      try {
        const authHeader = req.headers["authorization"];
        if (!authHeader || typeof authHeader !== "string") {
          sendJson(res, 401, { error: "Unauthorized", message: "Authorization header with Bearer token required" });
          return;
        }

        const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
        if (!bearerMatch) {
          sendJson(res, 401, { error: "Unauthorized", message: "Invalid Authorization header format" });
          return;
        }

        const accessToken = bearerMatch[1];
        const sites = await getAccessibleResources(accessToken);

        sendJson(res, 200, { sites });
      } catch (error) {
        logger.error("Failed to fetch sites", error);
        sendJson(res, 500, { error: "Failed to fetch sites", message: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      // Extract Bearer token from headers
      const accessToken = extractAccessToken(req.headers as Record<string, string | string[] | undefined>);

      if (!accessToken) {
        sendJson(res, 401, {
          error: "Unauthorized",
          message: "Missing credentials. Provide Authorization: Bearer <token> header",
        });
        return;
      }

      // Try to auto-resolve cloud ID; it may remain undefined for multi-site users
      let cloudId: string | undefined;
      try {
        const result = await resolveCloudId(accessToken);
        if (result.resolved) {
          cloudId = result.cloudId;
        }
      } catch {
        // Resolution failed — let tools handle the error
      }

      // Store auth for use by tools (cloudId may be undefined)
      setCurrentAuth({ accessToken, cloudId });

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
    logger.info(`Jira Cloud MCP server running on http://localhost:${port}`);
    logger.info("");
    logger.info("Endpoints:");
    logger.info(`  MCP:           POST http://localhost:${port}/mcp`);
    logger.info(`  Health:        GET  http://localhost:${port}/health`);
    logger.info("");
    logger.info("OAuth 2.0 Endpoints:");
    logger.info(`  Authorize:     GET  http://localhost:${port}/oauth/authorize`);
    logger.info(`  Callback:      POST http://localhost:${port}/oauth/callback`);
    logger.info(`  Refresh:       POST http://localhost:${port}/oauth/refresh`);
    logger.info(`  Sites:         GET  http://localhost:${port}/oauth/sites`);
    logger.info("");
    logger.info("MCP Authentication:");
    logger.info("  Authorization: Bearer <accessToken>");
    logger.info("  Cloud ID is auto-resolved from accessible resources");
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
      logger.info("Shutting down Jira Cloud MCP server...");
      await server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error("Failed to start Jira Cloud MCP server", error);
    process.exit(1);
  }
}

main();

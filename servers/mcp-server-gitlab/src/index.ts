#!/usr/bin/env node

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { server, registerHandlers, setCurrentAuth } from "./server.js";
import { extractGitLabAuth } from "./utils/gitlab-client.js";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import {
  generatePKCE,
  generateState,
  generateAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeToken,
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
 * Start the MCP server with HTTP transport.
 * Credentials are extracted from request headers for each request.
 */
async function startHttpServer(port: number): Promise<void> {
  logger.info(`Starting GitLab MCP server on port ${port}`);

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
      "Content-Type, Authorization, x-gitlab-host, mcp-session-id"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check endpoint
    if (url.pathname === "/health" && req.method === "GET") {
      sendJson(res, 200, {
        status: "ok",
        server: "mcp-server-gitlab",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // ================================================================
    // OAuth Endpoints
    // ================================================================

    // GET /oauth/authorize - Generate authorization URL with PKCE
    if (url.pathname === "/oauth/authorize" && req.method === "GET") {
      try {
        const clientId = url.searchParams.get("clientId");
        const redirectUri = url.searchParams.get("redirectUri");
        const host = url.searchParams.get("host") || "gitlab.com";
        const scopes = url.searchParams.get("scopes") || "api read_user read_api read_repository write_repository";

        // Validate required parameters
        if (!clientId) {
          sendJson(res, 400, {
            error: "Missing required parameter",
            message: "clientId is required",
          });
          return;
        }

        if (!redirectUri) {
          sendJson(res, 400, {
            error: "Missing required parameter",
            message: "redirectUri is required",
          });
          return;
        }

        // Generate PKCE and state
        const { codeVerifier, codeChallenge } = generatePKCE();
        const state = generateState();

        // Build authorization URL
        const authorizationUrl = generateAuthorizationUrl({
          host,
          clientId,
          redirectUri,
          scopes,
          state,
          codeChallenge,
        });

        logger.info(`Generated authorization URL for ${host}`);

        sendJson(res, 200, {
          authorizationUrl,
          state,
          codeVerifier, // Client must store this for callback
          host,
        });
      } catch (error) {
        logger.error("Failed to generate authorization URL", error);
        sendJson(res, 500, {
          error: "Failed to generate authorization URL",
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    // POST /oauth/callback - Exchange code for tokens
    if (url.pathname === "/oauth/callback" && req.method === "POST") {
      try {
        const body = await parseJsonBody(req);
        const {
          code,
          codeVerifier,
          clientId,
          clientSecret,
          redirectUri,
          host = "gitlab.com",
        } = body as {
          code?: string;
          codeVerifier?: string;
          clientId?: string;
          clientSecret?: string;
          redirectUri?: string;
          host?: string;
        };

        // Validate required parameters
        if (!code) {
          sendJson(res, 400, { error: "Missing required parameter", message: "code is required" });
          return;
        }
        if (!codeVerifier) {
          sendJson(res, 400, { error: "Missing required parameter", message: "codeVerifier is required" });
          return;
        }
        if (!clientId) {
          sendJson(res, 400, { error: "Missing required parameter", message: "clientId is required" });
          return;
        }
        if (!clientSecret) {
          sendJson(res, 400, { error: "Missing required parameter", message: "clientSecret is required" });
          return;
        }
        if (!redirectUri) {
          sendJson(res, 400, { error: "Missing required parameter", message: "redirectUri is required" });
          return;
        }

        // Exchange code for tokens using client-provided credentials
        const tokens = await exchangeCodeForTokens(
          host,
          code,
          clientId,
          clientSecret,
          redirectUri,
          codeVerifier
        );

        // Fetch current user info
        let user = null;
        try {
          const userResponse = await fetch(`https://${host}/api/v4/user`, {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
              Accept: "application/json",
            },
          });

          if (userResponse.ok) {
            user = await userResponse.json();
          }
        } catch (userError) {
          logger.warn("Failed to fetch user info after OAuth", userError);
        }

        logger.info(`OAuth callback successful for ${host}`);

        sendJson(res, 200, {
          ...tokens,
          host,
          user,
        });
      } catch (error) {
        logger.error("OAuth callback failed", error);
        sendJson(res, 500, {
          error: "OAuth callback failed",
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    // POST /oauth/refresh - Refresh access token
    if (url.pathname === "/oauth/refresh" && req.method === "POST") {
      try {
        const body = await parseJsonBody(req);
        const {
          refreshToken,
          clientId,
          clientSecret,
          host = "gitlab.com",
        } = body as {
          refreshToken?: string;
          clientId?: string;
          clientSecret?: string;
          host?: string;
        };

        // Validate required parameters
        if (!refreshToken) {
          sendJson(res, 400, { error: "Missing required parameter", message: "refreshToken is required" });
          return;
        }
        if (!clientId) {
          sendJson(res, 400, { error: "Missing required parameter", message: "clientId is required" });
          return;
        }
        if (!clientSecret) {
          sendJson(res, 400, { error: "Missing required parameter", message: "clientSecret is required" });
          return;
        }

        // Refresh token using client-provided credentials
        const tokens = await refreshAccessToken(host, refreshToken, clientId, clientSecret);

        logger.info(`Token refreshed for ${host}`);

        sendJson(res, 200, {
          ...tokens,
          host,
        });
      } catch (error) {
        logger.error("Token refresh failed", error);
        sendJson(res, 500, {
          error: "Token refresh failed",
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    // POST /oauth/revoke - Revoke token
    if (url.pathname === "/oauth/revoke" && req.method === "POST") {
      try {
        const body = await parseJsonBody(req);
        const {
          token,
          clientId,
          clientSecret,
          host = "gitlab.com",
        } = body as {
          token?: string;
          clientId?: string;
          clientSecret?: string;
          host?: string;
        };

        // Validate required parameters
        if (!token) {
          sendJson(res, 400, { error: "Missing required parameter", message: "token is required" });
          return;
        }
        if (!clientId) {
          sendJson(res, 400, { error: "Missing required parameter", message: "clientId is required" });
          return;
        }
        if (!clientSecret) {
          sendJson(res, 400, { error: "Missing required parameter", message: "clientSecret is required" });
          return;
        }

        // Revoke token using client-provided credentials
        await revokeToken(host, token, clientId, clientSecret);

        logger.info(`Token revoked for ${host}`);

        sendJson(res, 200, { success: true, host });
      } catch (error) {
        logger.error("Token revocation failed", error);
        sendJson(res, 500, {
          error: "Token revocation failed",
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    // GET /oauth/user - Get current user info
    if (url.pathname === "/oauth/user" && req.method === "GET") {
      try {
        const auth = extractGitLabAuth(req.headers as Record<string, string | string[] | undefined>);

        if (!auth) {
          sendJson(res, 401, {
            error: "Unauthorized",
            message: "Authorization header with Bearer token required",
          });
          return;
        }

        const userResponse = await fetch(`https://${auth.host}/api/v4/user`, {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
            Accept: "application/json",
          },
        });

        if (!userResponse.ok) {
          const errorBody = await userResponse.text();
          throw new Error(errorBody || userResponse.statusText);
        }

        const user = await userResponse.json();

        sendJson(res, 200, { user, host: auth.host });
      } catch (error) {
        logger.error("Failed to fetch user", error);
        sendJson(res, 500, {
          error: "Failed to fetch user",
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    // ================================================================
    // MCP Endpoint
    // ================================================================

    if (url.pathname === "/mcp") {
      // Extract GitLab auth from headers
      const auth = extractGitLabAuth(req.headers as Record<string, string | string[] | undefined>);

      if (!auth) {
        sendJson(res, 401, {
          error: "Unauthorized",
          message:
            "Missing GitLab credentials. Provide 'Authorization: Bearer <token>' header. Optionally provide 'x-gitlab-host: <host>' header (defaults to gitlab.com).",
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
    logger.info(`GitLab MCP server running on http://localhost:${port}`);
    logger.info("");
    logger.info("Endpoints:");
    logger.info(`  MCP:           POST http://localhost:${port}/mcp`);
    logger.info(`  Health:        GET  http://localhost:${port}/health`);
    logger.info("");
    logger.info("OAuth 2.0 Endpoints (Multi-tenant - Dynamic Credentials):");
    logger.info(`  Authorize:     GET  http://localhost:${port}/oauth/authorize`);
    logger.info(`  Callback:      POST http://localhost:${port}/oauth/callback`);
    logger.info(`  Refresh:       POST http://localhost:${port}/oauth/refresh`);
    logger.info(`  Revoke:        POST http://localhost:${port}/oauth/revoke`);
    logger.info(`  User:          GET  http://localhost:${port}/oauth/user`);
    logger.info("");
    logger.info("MCP Authentication:");
    logger.info("  Authorization: Bearer <accessToken>");
    logger.info("  x-gitlab-host: <host> (optional, defaults to gitlab.com)");
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
      logger.info("Shutting down GitLab MCP server...");
      await server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error("Failed to start GitLab MCP server", error);
    process.exit(1);
  }
}

main();

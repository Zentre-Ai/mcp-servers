#!/usr/bin/env node

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { server, registerHandlers, setCurrentAuth } from "./server.js";
import { extractStripeAuth } from "./utils/stripe-client.js";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import {
  generateState,
  generateAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  deauthorize,
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
      "Content-Type, Authorization, x-stripe-account, mcp-session-id"
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

    // OAuth: Get authorization URL
    if (url.pathname === "/oauth/authorize" && req.method === "GET") {
      try {
        if (!config.STRIPE_CLIENT_ID) {
          sendJson(res, 500, { error: "OAuth not configured", message: "STRIPE_CLIENT_ID is required" });
          return;
        }

        const redirectUri = url.searchParams.get("redirect_uri") || config.OAUTH_REDIRECT_URI;
        if (!redirectUri) {
          sendJson(res, 400, { error: "Missing redirect_uri", message: "Provide redirect_uri query param or configure OAUTH_REDIRECT_URI" });
          return;
        }

        const state = generateState();
        const scope = url.searchParams.get("scope") || config.OAUTH_SCOPES;

        const authorizationUrl = generateAuthorizationUrl(
          config.STRIPE_CLIENT_ID,
          redirectUri,
          scope,
          state
        );

        sendJson(res, 200, {
          authorizationUrl,
          state,
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
        if (!config.STRIPE_SECRET_KEY) {
          sendJson(res, 500, { error: "OAuth not configured", message: "STRIPE_SECRET_KEY is required" });
          return;
        }

        const body = await parseJsonBody(req);
        const code = body.code as string;

        if (!code) {
          sendJson(res, 400, { error: "Missing parameters", message: "code is required" });
          return;
        }

        const tokens = await exchangeCodeForTokens(code, config.STRIPE_SECRET_KEY);

        sendJson(res, 200, {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenType: tokens.tokenType,
          stripeUserId: tokens.stripeUserId,
          stripePublishableKey: tokens.stripePublishableKey,
          scope: tokens.scope,
          livemode: tokens.livemode,
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
        if (!config.STRIPE_SECRET_KEY) {
          sendJson(res, 500, { error: "OAuth not configured", message: "STRIPE_SECRET_KEY is required" });
          return;
        }

        const body = await parseJsonBody(req);
        const refreshToken = body.refreshToken as string;

        if (!refreshToken) {
          sendJson(res, 400, { error: "Missing parameters", message: "refreshToken is required" });
          return;
        }

        const tokens = await refreshAccessToken(refreshToken, config.STRIPE_SECRET_KEY);

        sendJson(res, 200, {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenType: tokens.tokenType,
          stripeUserId: tokens.stripeUserId,
          stripePublishableKey: tokens.stripePublishableKey,
          scope: tokens.scope,
          livemode: tokens.livemode,
        });
      } catch (error) {
        logger.error("Token refresh failed", error);
        sendJson(res, 500, { error: "Token refresh failed", message: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    // OAuth: Deauthorize (revoke access)
    if (url.pathname === "/oauth/deauthorize" && req.method === "POST") {
      try {
        if (!config.STRIPE_CLIENT_ID || !config.STRIPE_SECRET_KEY) {
          sendJson(res, 500, { error: "OAuth not configured", message: "STRIPE_CLIENT_ID and STRIPE_SECRET_KEY are required" });
          return;
        }

        const body = await parseJsonBody(req);
        const stripeUserId = body.stripeUserId as string;

        if (!stripeUserId) {
          sendJson(res, 400, { error: "Missing parameters", message: "stripeUserId is required" });
          return;
        }

        const result = await deauthorize(
          config.STRIPE_CLIENT_ID,
          config.STRIPE_SECRET_KEY,
          stripeUserId
        );

        sendJson(res, 200, {
          success: true,
          stripeUserId: result.stripeUserId,
        });
      } catch (error) {
        logger.error("Deauthorization failed", error);
        sendJson(res, 500, { error: "Deauthorization failed", message: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    // OAuth: Get connected account info
    if (url.pathname === "/oauth/account" && req.method === "GET") {
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

        // Use the Stripe API to get account info
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(accessToken, { apiVersion: "2025-02-24.acacia" });
        const account = await stripe.accounts.retrieve();

        sendJson(res, 200, {
          id: account.id,
          email: account.email,
          businessProfile: account.business_profile,
          country: account.country,
          defaultCurrency: account.default_currency,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          created: account.created,
        });
      } catch (error) {
        logger.error("Failed to fetch account", error);
        sendJson(res, 500, { error: "Failed to fetch account", message: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      // Extract Stripe auth from headers
      const auth = extractStripeAuth(req.headers as Record<string, string | string[] | undefined>);

      if (!auth) {
        sendJson(res, 401, {
          error: "Unauthorized",
          message: "Missing Stripe credentials. Provide Authorization: Bearer <token> header",
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
    logger.info("OAuth 2.0 Endpoints:");
    logger.info(`  Authorize:     GET  http://localhost:${port}/oauth/authorize`);
    logger.info(`  Callback:      POST http://localhost:${port}/oauth/callback`);
    logger.info(`  Refresh:       POST http://localhost:${port}/oauth/refresh`);
    logger.info(`  Deauthorize:   POST http://localhost:${port}/oauth/deauthorize`);
    logger.info(`  Account:       GET  http://localhost:${port}/oauth/account`);
    logger.info("");
    logger.info("MCP Authentication:");
    logger.info("  Authorization: Bearer <accessToken>");
    logger.info("  x-stripe-account: <stripeAccountId> (optional, for connected accounts)");
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

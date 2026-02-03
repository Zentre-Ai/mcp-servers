import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./utils/logger.js";
import { StripeAuth } from "./utils/stripe-client.js";

/**
 * MCP Server instance for Stripe.
 */
export const server = new McpServer({
  name: "mcp-server-stripe",
  version: "1.0.0",
});

/**
 * Global auth storage for the current request.
 * This is set before each MCP request is handled.
 */
let currentStripeAuth: StripeAuth | null = null;

export function setCurrentAuth(auth: StripeAuth | null): void {
  currentStripeAuth = auth;
}

export function getCurrentAuth(): StripeAuth | null {
  return currentStripeAuth;
}

/**
 * Register all tools with the server.
 */
export async function registerHandlers(): Promise<void> {
  logger.info("Registering Stripe MCP handlers...");

  // Import all tools - each tool registers itself with the server
  await import("./tools/customers.tool.js");
  await import("./tools/payments.tool.js");
  await import("./tools/subscriptions.tool.js");
  await import("./tools/invoices.tool.js");
  await import("./tools/products.tool.js");
  await import("./tools/balance.tool.js");

  logger.info("All Stripe handlers registered successfully");
}

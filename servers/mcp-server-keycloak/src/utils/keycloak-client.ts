import KeycloakAdminClient from "@keycloak/keycloak-admin-client";
import { config } from "../config.js";
import { logger } from "./logger.js";

/**
 * Create a Keycloak Admin Client configured with the access token.
 *
 * @param accessToken - The Bearer token from the request
 * @returns Configured KeycloakAdminClient instance
 */
export function createKeycloakClient(accessToken: string): KeycloakAdminClient {
  const client = new KeycloakAdminClient({
    baseUrl: config.KEYCLOAK_URL,
    realmName: config.KEYCLOAK_REALM,
  });

  // Set the access token for API calls
  client.setAccessToken(accessToken);

  logger.debug("Created Keycloak admin client with access token");
  return client;
}

/**
 * Extract Bearer token from Authorization header.
 *
 * @param headers - Request headers object
 * @returns The extracted token or null if not found/invalid
 */
export function extractBearerToken(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const authHeader = headers["authorization"];

  if (!authHeader) {
    return null;
  }

  const auth = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7);
  }

  return null;
}

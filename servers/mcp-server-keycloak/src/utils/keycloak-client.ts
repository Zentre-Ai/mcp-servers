import KeycloakAdminClient from "@keycloak/keycloak-admin-client";
import { logger } from "./logger.js";

/**
 * JWT payload structure (partial - only fields we need).
 */
interface JwtPayload {
  iss?: string;
  sub?: string;
  exp?: number;
}

/**
 * Keycloak connection info extracted from token.
 */
interface KeycloakConnectionInfo {
  keycloakUrl: string;
  realm: string;
}

/**
 * Decode JWT payload without signature verification.
 * Note: Keycloak will validate the token when we make API calls.
 *
 * @param token - The JWT access token
 * @returns Decoded payload
 */
function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format: expected 3 parts");
  }

  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload) as JwtPayload;
  } catch {
    throw new Error("Invalid JWT: failed to decode payload");
  }
}

/**
 * Parse Keycloak issuer URL to extract base URL and realm.
 *
 * @param issuer - The issuer URL from JWT (e.g., https://keycloak.example.com/realms/myrealm)
 * @returns Keycloak URL and realm name
 */
function parseIssuer(issuer: string): KeycloakConnectionInfo {
  // Keycloak issuer format: https://keycloak.example.com/realms/myrealm
  const match = issuer.match(/^(https?:\/\/.+)\/realms\/([^/]+)$/);

  if (!match) {
    throw new Error(
      `Invalid Keycloak issuer format: ${issuer}. Expected format: https://keycloak.example.com/realms/realm-name`
    );
  }

  return {
    keycloakUrl: match[1],
    realm: match[2],
  };
}

/**
 * Create a Keycloak Admin Client configured from the access token.
 * Extracts Keycloak URL and realm from the token's issuer claim.
 *
 * @param accessToken - The Bearer token from the request
 * @returns Configured KeycloakAdminClient instance
 */
export function createKeycloakClient(accessToken: string): KeycloakAdminClient {
  // Decode JWT to get issuer
  const payload = decodeJwtPayload(accessToken);

  if (!payload.iss) {
    throw new Error("Token missing issuer (iss) claim");
  }

  // Extract Keycloak URL and realm from issuer
  const { keycloakUrl, realm } = parseIssuer(payload.iss);

  logger.debug(`Connecting to Keycloak: ${keycloakUrl}, realm: ${realm}`);

  const client = new KeycloakAdminClient({
    baseUrl: keycloakUrl,
    realmName: realm,
  });

  // Set the access token for API calls
  client.setAccessToken(accessToken);

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

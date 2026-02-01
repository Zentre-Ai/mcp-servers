import { createHash, randomBytes } from "crypto";
import { logger } from "./logger.js";

// Atlassian OAuth 2.0 endpoints
const ATLASSIAN_AUTH_URL = "https://auth.atlassian.com/authorize";
const ATLASSIAN_TOKEN_URL = "https://auth.atlassian.com/oauth/token";
const ATLASSIAN_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources";

/**
 * Token response from Atlassian OAuth.
 */
export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  expiresAt: number;
  tokenType: string;
  scope: string;
}

/**
 * Jira Cloud site information.
 */
export interface JiraCloudSite {
  id: string;
  name: string;
  url: string;
  scopes: string[];
  avatarUrl?: string;
}

/**
 * PKCE code verifier and challenge pair.
 */
export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
}

/**
 * Generate a cryptographically secure random string.
 */
function generateRandomString(length: number): string {
  return randomBytes(length).toString("base64url").slice(0, length);
}

/**
 * Generate PKCE code verifier and challenge.
 * Uses SHA-256 for the challenge method.
 */
export function generatePKCE(): PKCEPair {
  // Code verifier: 43-128 characters, URL-safe
  const codeVerifier = generateRandomString(64);

  // Code challenge: SHA-256 hash of verifier, base64url encoded
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return { codeVerifier, codeChallenge };
}

/**
 * Generate a random state parameter for CSRF protection.
 */
export function generateState(): string {
  return generateRandomString(32);
}

/**
 * Generate the Atlassian authorization URL.
 */
export function generateAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  scopes: string,
  state: string,
  codeChallenge: string
): string {
  const params = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state: state,
    response_type: "code",
    prompt: "consent",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${ATLASSIAN_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier: string
): Promise<TokenResponse> {
  logger.debug("Exchanging authorization code for tokens");

  const response = await fetch(ATLASSIAN_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("Token exchange failed", { status: response.status, body: errorBody });
    throw new Error(`Token exchange failed: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    expiresAt: Date.now() + data.expires_in * 1000,
    tokenType: data.token_type,
    scope: data.scope,
  };
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  logger.debug("Refreshing access token");

  const response = await fetch(ATLASSIAN_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("Token refresh failed", { status: response.status, body: errorBody });
    throw new Error(`Token refresh failed: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Keep old refresh token if not provided
    expiresIn: data.expires_in,
    expiresAt: Date.now() + data.expires_in * 1000,
    tokenType: data.token_type,
    scope: data.scope,
  };
}

/**
 * Get accessible Jira Cloud sites for an access token.
 */
export async function getAccessibleResources(
  accessToken: string
): Promise<JiraCloudSite[]> {
  logger.debug("Fetching accessible Jira Cloud resources");

  const response = await fetch(ATLASSIAN_RESOURCES_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("Failed to fetch accessible resources", { status: response.status, body: errorBody });
    throw new Error(`Failed to fetch accessible resources: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as Array<{
    id: string;
    name: string;
    url: string;
    scopes: string[];
    avatarUrl?: string;
  }>;

  return data.map((site) => ({
    id: site.id,
    name: site.name,
    url: site.url,
    scopes: site.scopes,
    avatarUrl: site.avatarUrl,
  }));
}

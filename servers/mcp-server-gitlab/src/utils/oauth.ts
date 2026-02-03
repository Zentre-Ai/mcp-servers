import { createHash, randomBytes } from "node:crypto";
import { logger } from "./logger.js";

/**
 * PKCE code verifier and challenge pair.
 */
export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
}

/**
 * Token response from GitLab OAuth.
 */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
  tokenType: string;
  scope: string;
  createdAt: number;
}

/**
 * Parameters for generating authorization URL.
 */
export interface AuthorizationUrlParams {
  host: string;
  clientId: string;
  redirectUri: string;
  scopes: string;
  state: string;
  codeChallenge: string;
}

/**
 * Generate a cryptographically secure random string.
 */
function generateRandomString(length: number): string {
  return randomBytes(length).toString("base64url").slice(0, length);
}

/**
 * Generate a random state parameter for CSRF protection.
 */
export function generateState(): string {
  return generateRandomString(32);
}

/**
 * Generate PKCE code verifier and challenge.
 * Uses SHA-256 (S256) method for the challenge.
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
 * Generate GitLab OAuth authorization URL.
 */
export function generateAuthorizationUrl(params: AuthorizationUrlParams): string {
  const { host, clientId, redirectUri, scopes, state, codeChallenge } = params;

  const baseUrl = `https://${host}/oauth/authorize`;
  const urlParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${baseUrl}?${urlParams.toString()}`;
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCodeForTokens(
  host: string,
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier: string
): Promise<TokenResponse> {
  logger.debug(`Exchanging authorization code for tokens on ${host}`);

  const tokenUrl = `https://${host}/oauth/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
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

    let errorMessage = `Token exchange failed: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorBody);
      errorMessage = errorJson.error_description || errorJson.error || errorMessage;
    } catch {
      if (errorBody) {
        errorMessage = errorBody;
      }
    }
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope?: string;
    created_at?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    expiresAt: Date.now() + data.expires_in * 1000,
    tokenType: data.token_type || "Bearer",
    scope: data.scope || "",
    createdAt: data.created_at || Math.floor(Date.now() / 1000),
  };
}

/**
 * Refresh access token using refresh token.
 */
export async function refreshAccessToken(
  host: string,
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  logger.debug(`Refreshing access token on ${host}`);

  const tokenUrl = `https://${host}/oauth/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("Token refresh failed", { status: response.status, body: errorBody });

    let errorMessage = `Token refresh failed: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorBody);
      errorMessage = errorJson.error_description || errorJson.error || errorMessage;
    } catch {
      if (errorBody) {
        errorMessage = errorBody;
      }
    }
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope?: string;
    created_at?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // GitLab may reuse refresh token
    expiresIn: data.expires_in,
    expiresAt: Date.now() + data.expires_in * 1000,
    tokenType: data.token_type || "Bearer",
    scope: data.scope || "",
    createdAt: data.created_at || Math.floor(Date.now() / 1000),
  };
}

/**
 * Revoke access or refresh token.
 */
export async function revokeToken(
  host: string,
  token: string,
  clientId: string,
  clientSecret: string
): Promise<void> {
  logger.debug(`Revoking token on ${host}`);

  const revokeUrl = `https://${host}/oauth/revoke`;

  const response = await fetch(revokeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token: token,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("Token revocation failed", { status: response.status, body: errorBody });

    let errorMessage = `Token revocation failed: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorBody);
      errorMessage = errorJson.error_description || errorJson.error || errorMessage;
    } catch {
      if (errorBody) {
        errorMessage = errorBody;
      }
    }
    throw new Error(errorMessage);
  }
}

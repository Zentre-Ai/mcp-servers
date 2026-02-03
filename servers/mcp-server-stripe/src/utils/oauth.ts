import { randomBytes } from "crypto";
import { logger } from "./logger.js";

// Stripe OAuth 2.0 endpoints (Stripe Connect)
const STRIPE_AUTH_URL = "https://connect.stripe.com/oauth/authorize";
const STRIPE_TOKEN_URL = "https://connect.stripe.com/oauth/token";
const STRIPE_DEAUTHORIZE_URL = "https://connect.stripe.com/oauth/deauthorize";

/**
 * Token response from Stripe OAuth.
 */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  stripeUserId: string;
  stripePublishableKey: string;
  scope: string;
  livemode: boolean;
}

/**
 * Connected account information.
 */
export interface ConnectedAccount {
  stripeUserId: string;
  livemode: boolean;
  scope: string;
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
 * Generate the Stripe authorization URL.
 * Note: Stripe Connect OAuth does not use PKCE.
 */
export function generateAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  scope: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: scope,
    redirect_uri: redirectUri,
    state: state,
    response_type: "code",
  });

  return `${STRIPE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens.
 * Stripe uses the secret key for authentication instead of client_secret.
 */
export async function exchangeCodeForTokens(
  code: string,
  secretKey: string
): Promise<TokenResponse> {
  logger.debug("Exchanging authorization code for tokens");

  const response = await fetch(STRIPE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      client_secret: secretKey,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("Token exchange failed", { status: response.status, body: errorBody });
    throw new Error(`Token exchange failed: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    token_type: string;
    stripe_user_id: string;
    stripe_publishable_key: string;
    scope: string;
    livemode: boolean;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type,
    stripeUserId: data.stripe_user_id,
    stripePublishableKey: data.stripe_publishable_key,
    scope: data.scope,
    livemode: data.livemode,
  };
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string,
  secretKey: string
): Promise<TokenResponse> {
  logger.debug("Refreshing access token");

  const response = await fetch(STRIPE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_secret: secretKey,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("Token refresh failed", { status: response.status, body: errorBody });
    throw new Error(`Token refresh failed: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    token_type: string;
    stripe_user_id: string;
    stripe_publishable_key: string;
    scope: string;
    livemode: boolean;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Keep old refresh token if not provided
    tokenType: data.token_type,
    stripeUserId: data.stripe_user_id,
    stripePublishableKey: data.stripe_publishable_key,
    scope: data.scope,
    livemode: data.livemode,
  };
}

/**
 * Deauthorize (revoke) platform access for a connected account.
 */
export async function deauthorize(
  clientId: string,
  secretKey: string,
  stripeUserId: string
): Promise<{ stripeUserId: string }> {
  logger.debug("Deauthorizing connected account", { stripeUserId });

  const response = await fetch(STRIPE_DEAUTHORIZE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      stripe_user_id: stripeUserId,
      client_secret: secretKey,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("Deauthorization failed", { status: response.status, body: errorBody });
    throw new Error(`Deauthorization failed: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    stripe_user_id: string;
  };

  return {
    stripeUserId: data.stripe_user_id,
  };
}

import { logger } from "./logger.js";
import { getDatacenterConfig, ZohoDatacenter } from "./datacenters.js";

/**
 * Token response from Zoho OAuth.
 */
export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  expiresAt: number;
  tokenType: string;
  scope?: string;
  apiDomain?: string;
}

/**
 * Zoho organization information.
 */
export interface ZohoOrganization {
  organizationId: string;
  name: string;
  contactName?: string;
  email?: string;
  isDefaultOrg?: boolean;
  planType?: number;
  taxId?: string;
  countryCode?: string;
  currencyCode?: string;
  currencySymbol?: string;
  timeZone?: string;
}

/**
 * Generate a random state parameter for CSRF protection.
 */
export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Get the authorization URL for a datacenter.
 */
function getAuthUrl(datacenter: ZohoDatacenter): string {
  const config = getDatacenterConfig(datacenter);
  return `https://${config.accountsDomain}/oauth/v2/auth`;
}

/**
 * Get the token URL for a datacenter.
 */
function getTokenUrl(datacenter: ZohoDatacenter): string {
  const config = getDatacenterConfig(datacenter);
  return `https://${config.accountsDomain}/oauth/v2/token`;
}

/**
 * Generate the Zoho authorization URL.
 */
export function generateAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  scopes: string,
  state: string,
  datacenter: ZohoDatacenter = "com",
  accessType: "offline" | "online" = "offline",
  prompt: "consent" | "" = "consent"
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state: state,
    response_type: "code",
    access_type: accessType,
  });

  if (prompt) {
    params.set("prompt", prompt);
  }

  return `${getAuthUrl(datacenter)}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  datacenter: ZohoDatacenter = "com"
): Promise<TokenResponse> {
  logger.debug("Exchanging authorization code for tokens");

  const response = await fetch(getTokenUrl(datacenter), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
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
    scope?: string;
    api_domain?: string;
    error?: string;
  };

  if (data.error) {
    throw new Error(`Token exchange failed: ${data.error}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    expiresAt: Date.now() + data.expires_in * 1000,
    tokenType: data.token_type,
    scope: data.scope,
    apiDomain: data.api_domain,
  };
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  datacenter: ZohoDatacenter = "com"
): Promise<TokenResponse> {
  logger.debug("Refreshing access token");

  const response = await fetch(getTokenUrl(datacenter), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
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
    throw new Error(`Token refresh failed: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
    scope?: string;
    api_domain?: string;
    error?: string;
  };

  if (data.error) {
    throw new Error(`Token refresh failed: ${data.error}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: refreshToken, // Zoho doesn't return a new refresh token
    expiresIn: data.expires_in,
    expiresAt: Date.now() + data.expires_in * 1000,
    tokenType: data.token_type,
    scope: data.scope,
    apiDomain: data.api_domain,
  };
}

/**
 * Get organizations for the authenticated user.
 */
export async function getOrganizations(
  accessToken: string,
  datacenter: ZohoDatacenter = "com"
): Promise<ZohoOrganization[]> {
  logger.debug("Fetching Zoho Books organizations");

  const dcConfig = getDatacenterConfig(datacenter);
  const url = `https://${dcConfig.apiDomain}/books/v3/organizations`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("Failed to fetch organizations", { status: response.status, body: errorBody });
    throw new Error(`Failed to fetch organizations: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    code: number;
    message: string;
    organizations?: Array<{
      organization_id: string;
      name: string;
      contact_name?: string;
      email?: string;
      is_default_org?: boolean;
      plan_type?: number;
      tax_id?: string;
      country_code?: string;
      currency_code?: string;
      currency_symbol?: string;
      time_zone?: string;
    }>;
  };

  if (data.code !== 0 || !data.organizations) {
    throw new Error(`Failed to fetch organizations: ${data.message}`);
  }

  return data.organizations.map((org) => ({
    organizationId: org.organization_id,
    name: org.name,
    contactName: org.contact_name,
    email: org.email,
    isDefaultOrg: org.is_default_org,
    planType: org.plan_type,
    taxId: org.tax_id,
    countryCode: org.country_code,
    currencyCode: org.currency_code,
    currencySymbol: org.currency_symbol,
    timeZone: org.time_zone,
  }));
}

import { google, gmail_v1 } from "googleapis";

/**
 * Creates a Gmail API client with the provided OAuth access token.
 * This is called per-request to support dynamic token authentication.
 */
export function createGmailClient(accessToken: string): gmail_v1.Gmail {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  return google.gmail({ version: "v1", auth });
}

/**
 * Extracts Gmail access token from request headers.
 * Supports both x-gmail-token header and Authorization: Bearer token.
 */
export function extractGmailToken(
  headers: Record<string, string | string[] | undefined>
): string | null {
  // Check x-gmail-token header first
  const gmailToken = headers["x-gmail-token"];
  if (gmailToken && typeof gmailToken === "string") {
    return gmailToken;
  }

  // Check Authorization header
  const authHeader = headers["authorization"];
  if (authHeader && typeof authHeader === "string") {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch) {
      return bearerMatch[1];
    }
  }

  return null;
}

/**
 * Decode base64url encoded string (used in Gmail API).
 */
export function decodeBase64Url(data: string): string {
  // Replace URL-safe characters
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Encode string to base64url (used in Gmail API).
 */
export function encodeBase64Url(data: string): string {
  return Buffer.from(data, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Create a raw email message for sending.
 */
export function createRawEmail(options: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  from?: string;
  contentType?: string;
}): string {
  const { to, subject, body, cc, bcc, from, contentType = "text/plain" } = options;

  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: ${contentType}; charset=utf-8`,
  ];

  if (from) {
    messageParts.unshift(`From: ${from}`);
  }
  if (cc) {
    messageParts.push(`Cc: ${cc}`);
  }
  if (bcc) {
    messageParts.push(`Bcc: ${bcc}`);
  }

  messageParts.push("", body);

  const message = messageParts.join("\r\n");
  return encodeBase64Url(message);
}

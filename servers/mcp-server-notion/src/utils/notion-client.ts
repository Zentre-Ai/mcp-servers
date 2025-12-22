import { Client } from "@notionhq/client";

/**
 * Creates a Notion client with the provided token.
 * This is called per-request to support dynamic token authentication.
 */
export function createNotionClient(token: string): Client {
  return new Client({
    auth: token,
  });
}

/**
 * Extracts Notion token from request headers.
 * Supports both x-notion-token header and Authorization: Bearer token.
 */
export function extractNotionToken(headers: Record<string, string | string[] | undefined>): string | null {
  // Check x-notion-token header first
  const notionToken = headers["x-notion-token"];
  if (notionToken && typeof notionToken === "string") {
    return notionToken;
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

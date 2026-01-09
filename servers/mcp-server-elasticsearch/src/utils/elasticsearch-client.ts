import { logger } from "./logger.js";

export interface ElasticsearchAuth {
  url: string;
  apiKey?: string;
  username?: string;
  password?: string;
  skipSsl?: boolean;
}

export function extractElasticsearchAuth(
  headers: Record<string, string | string[] | undefined>
): ElasticsearchAuth | null {
  const url = headers["x-elasticsearch-url"];
  if (!url) return null;

  const esUrl = Array.isArray(url) ? url[0] : url;

  const auth: ElasticsearchAuth = {
    url: esUrl.replace(/\/$/, ""),
  };

  // API Key auth
  const apiKey = headers["x-elasticsearch-api-key"];
  if (apiKey) {
    auth.apiKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;
  }

  // Basic auth
  const username = headers["x-elasticsearch-username"];
  const password = headers["x-elasticsearch-password"];
  if (username && password) {
    auth.username = Array.isArray(username) ? username[0] : username;
    auth.password = Array.isArray(password) ? password[0] : password;
  }

  // SSL skip
  const skipSsl = headers["x-elasticsearch-skip-ssl"];
  if (skipSsl === "true") {
    auth.skipSsl = true;
  }

  // Must have either API key or basic auth
  if (!auth.apiKey && (!auth.username || !auth.password)) {
    return null;
  }

  return auth;
}

export async function elasticsearchRequest<T>(
  auth: ElasticsearchAuth,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (auth.apiKey) {
    headers["Authorization"] = `ApiKey ${auth.apiKey}`;
  } else if (auth.username && auth.password) {
    const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
    headers["Authorization"] = `Basic ${credentials}`;
  }

  const url = `${auth.url}${path}`;
  logger.debug(`Elasticsearch request: ${options.method || "GET"} ${path}`);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error(`Elasticsearch API error: ${response.status}`, { error });
    throw new Error(`Elasticsearch API error: ${response.status} - ${error}`);
  }

  return response.json() as Promise<T>;
}

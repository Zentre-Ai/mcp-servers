import { logger } from "./logger.js";

/**
 * Grafana authentication credentials.
 */
export interface GrafanaAuth {
  url: string;
  token: string;
}

/**
 * Extract Grafana authentication from HTTP headers.
 */
export function extractGrafanaAuth(
  headers: Record<string, string | string[] | undefined>
): GrafanaAuth | null {
  // Get Grafana URL (required)
  const url = headers["x-grafana-url"];
  if (!url) {
    return null;
  }
  const grafanaUrl = Array.isArray(url) ? url[0] : url;

  // Check for x-grafana-token header
  const grafanaToken = headers["x-grafana-token"];
  if (grafanaToken) {
    const token = Array.isArray(grafanaToken) ? grafanaToken[0] : grafanaToken;
    return { url: grafanaUrl.replace(/\/$/, ""), token };
  }

  // Check for Authorization: Bearer header
  const authHeader = headers["authorization"];
  if (authHeader) {
    const auth = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (auth.toLowerCase().startsWith("bearer ")) {
      return { url: grafanaUrl.replace(/\/$/, ""), token: auth.slice(7) };
    }
  }

  return null;
}

/**
 * Make authenticated request to Grafana API.
 */
export async function grafanaRequest<T>(
  auth: GrafanaAuth,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${auth.url}${path}`;
  logger.debug(`Grafana request: ${options.method || "GET"} ${path}`);

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`Grafana API error: ${response.status}`, errorText);
    throw new Error(`Grafana API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  // Handle empty responses (e.g., DELETE)
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return {} as T;
  }

  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

/**
 * Make Grafana datasource proxy query request.
 * Used for Prometheus, Loki, Pyroscope queries that go through the datasource proxy.
 */
export async function grafanaDatasourceQuery<T>(
  auth: GrafanaAuth,
  datasourceUid: string,
  queries: unknown[],
  from?: string,
  to?: string
): Promise<T> {
  const body = {
    queries: queries.map((q, i) => ({
      ...q as object,
      refId: (q as { refId?: string }).refId || String.fromCharCode(65 + i), // A, B, C...
      datasource: { uid: datasourceUid },
    })),
    from: from || "now-1h",
    to: to || "now",
  };

  return grafanaRequest<T>(auth, "/api/ds/query", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Format a Grafana item for response.
 */
export function formatGrafanaItem(item: Record<string, unknown>): Record<string, unknown> {
  return {
    ...item,
  };
}

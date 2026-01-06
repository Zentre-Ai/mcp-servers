import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { grafanaRequest, grafanaDatasourceQuery } from "../utils/grafana-client.js";
import { logger } from "../utils/logger.js";

/**
 * List Prometheus metric metadata.
 */
server.tool(
  "grafana_list_prometheus_metric_metadata",
  {
    datasourceUid: z.string().describe("Prometheus datasource UID"),
    metric: z.string().optional().describe("Filter by metric name"),
    limit: z.number().optional().describe("Maximum number of results"),
  },
  async ({ datasourceUid, metric, limit }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const params = new URLSearchParams();
      if (metric) params.append("metric", metric);
      if (limit) params.append("limit", limit.toString());

      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `/api/datasources/proxy/uid/${datasourceUid}/api/v1/metadata?${params.toString()}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list metric metadata", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing metric metadata: ${message}` }] };
    }
  }
);

/**
 * Query Prometheus using PromQL.
 */
server.tool(
  "grafana_query_prometheus",
  {
    datasourceUid: z.string().describe("Prometheus datasource UID"),
    expr: z.string().describe("PromQL expression"),
    queryType: z
      .enum(["instant", "range"])
      .optional()
      .describe("Query type: instant or range (default: instant)"),
    start: z.string().optional().describe("Start time (RFC3339 or relative like 'now-1h')"),
    end: z.string().optional().describe("End time (RFC3339 or relative like 'now')"),
    step: z.string().optional().describe("Query step for range queries (e.g., '15s', '1m')"),
  },
  async ({ datasourceUid, expr, queryType, start, end, step }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const isRange = queryType === "range";
      const query = {
        refId: "A",
        expr,
        instant: !isRange,
        range: isRange,
        intervalMs: step ? parseInterval(step) : 15000,
      };

      const result = await grafanaDatasourceQuery<Record<string, unknown>>(
        auth,
        datasourceUid,
        [query],
        start || "now-1h",
        end || "now"
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to query Prometheus", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error querying Prometheus: ${message}` }] };
    }
  }
);

/**
 * List Prometheus metric names.
 */
server.tool(
  "grafana_list_prometheus_metric_names",
  {
    datasourceUid: z.string().describe("Prometheus datasource UID"),
    match: z.string().optional().describe("Regex pattern to filter metric names"),
    start: z.string().optional().describe("Start time"),
    end: z.string().optional().describe("End time"),
  },
  async ({ datasourceUid, match, start, end }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const params = new URLSearchParams();
      if (start) params.append("start", start);
      if (end) params.append("end", end);

      const result = await grafanaRequest<{ data: string[] }>(
        auth,
        `/api/datasources/proxy/uid/${datasourceUid}/api/v1/label/__name__/values?${params.toString()}`
      );

      let metricNames = result.data || [];

      // Filter by regex if provided
      if (match) {
        const regex = new RegExp(match);
        metricNames = metricNames.filter((name) => regex.test(name));
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ metricNames, total: metricNames.length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list metric names", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing metric names: ${message}` }] };
    }
  }
);

/**
 * List Prometheus label names.
 */
server.tool(
  "grafana_list_prometheus_label_names",
  {
    datasourceUid: z.string().describe("Prometheus datasource UID"),
    match: z.array(z.string()).optional().describe("Series selectors to filter"),
    start: z.string().optional().describe("Start time"),
    end: z.string().optional().describe("End time"),
  },
  async ({ datasourceUid, match, start, end }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const params = new URLSearchParams();
      if (match) match.forEach((m) => params.append("match[]", m));
      if (start) params.append("start", start);
      if (end) params.append("end", end);

      const result = await grafanaRequest<{ data: string[] }>(
        auth,
        `/api/datasources/proxy/uid/${datasourceUid}/api/v1/labels?${params.toString()}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ labelNames: result.data || [], total: (result.data || []).length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list label names", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing label names: ${message}` }] };
    }
  }
);

/**
 * List Prometheus label values.
 */
server.tool(
  "grafana_list_prometheus_label_values",
  {
    datasourceUid: z.string().describe("Prometheus datasource UID"),
    labelName: z.string().describe("Label name to get values for"),
    match: z.array(z.string()).optional().describe("Series selectors to filter"),
    start: z.string().optional().describe("Start time"),
    end: z.string().optional().describe("End time"),
  },
  async ({ datasourceUid, labelName, match, start, end }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const params = new URLSearchParams();
      if (match) match.forEach((m) => params.append("match[]", m));
      if (start) params.append("start", start);
      if (end) params.append("end", end);

      const result = await grafanaRequest<{ data: string[] }>(
        auth,
        `/api/datasources/proxy/uid/${datasourceUid}/api/v1/label/${encodeURIComponent(labelName)}/values?${params.toString()}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ labelName, values: result.data || [], total: (result.data || []).length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list label values", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing label values: ${message}` }] };
    }
  }
);

/**
 * Parse interval string to milliseconds.
 */
function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)([smhd])$/);
  if (!match) return 15000;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return 15000;
  }
}

logger.info("Grafana Prometheus tools registered");

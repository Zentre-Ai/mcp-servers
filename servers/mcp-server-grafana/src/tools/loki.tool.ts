import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { grafanaRequest, grafanaDatasourceQuery } from "../utils/grafana-client.js";
import { logger } from "../utils/logger.js";

/**
 * List Loki label names.
 */
server.tool(
  "grafana_list_loki_label_names",
  {
    datasourceUid: z.string().describe("Loki datasource UID"),
    start: z.string().optional().describe("Start time (RFC3339)"),
    end: z.string().optional().describe("End time (RFC3339)"),
  },
  async ({ datasourceUid, start, end }) => {
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
        `/api/datasources/proxy/uid/${datasourceUid}/loki/api/v1/labels?${params.toString()}`
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
      logger.error("Failed to list Loki label names", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing Loki label names: ${message}` }] };
    }
  }
);

/**
 * List Loki label values.
 */
server.tool(
  "grafana_list_loki_label_values",
  {
    datasourceUid: z.string().describe("Loki datasource UID"),
    labelName: z.string().describe("Label name to get values for"),
    start: z.string().optional().describe("Start time (RFC3339)"),
    end: z.string().optional().describe("End time (RFC3339)"),
  },
  async ({ datasourceUid, labelName, start, end }) => {
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
        `/api/datasources/proxy/uid/${datasourceUid}/loki/api/v1/label/${encodeURIComponent(labelName)}/values?${params.toString()}`
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
      logger.error("Failed to list Loki label values", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing Loki label values: ${message}` }] };
    }
  }
);

/**
 * Query Loki log stream statistics.
 */
server.tool(
  "grafana_query_loki_stats",
  {
    datasourceUid: z.string().describe("Loki datasource UID"),
    query: z.string().describe("LogQL selector query (e.g., '{job=\"app\"}')"),
    start: z.string().optional().describe("Start time (RFC3339)"),
    end: z.string().optional().describe("End time (RFC3339)"),
  },
  async ({ datasourceUid, query, start, end }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const params = new URLSearchParams();
      params.append("query", query);
      if (start) params.append("start", start);
      if (end) params.append("end", end);

      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `/api/datasources/proxy/uid/${datasourceUid}/loki/api/v1/index/stats?${params.toString()}`
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
      logger.error("Failed to query Loki stats", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error querying Loki stats: ${message}` }] };
    }
  }
);

/**
 * Query Loki logs with LogQL.
 */
server.tool(
  "grafana_query_loki_logs",
  {
    datasourceUid: z.string().describe("Loki datasource UID"),
    expr: z.string().describe("LogQL expression"),
    limit: z.number().optional().describe("Maximum number of log entries to return"),
    start: z.string().optional().describe("Start time (RFC3339 or relative like 'now-1h')"),
    end: z.string().optional().describe("End time (RFC3339 or relative like 'now')"),
    direction: z.enum(["forward", "backward"]).optional().describe("Query direction (default: backward)"),
  },
  async ({ datasourceUid, expr, limit, start, end, direction }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const query = {
        refId: "A",
        expr,
        queryType: "range",
        maxLines: limit || 1000,
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
      logger.error("Failed to query Loki logs", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error querying Loki logs: ${message}` }] };
    }
  }
);

logger.info("Grafana Loki tools registered");

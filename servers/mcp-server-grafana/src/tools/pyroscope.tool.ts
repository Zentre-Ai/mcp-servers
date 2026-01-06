import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { grafanaRequest } from "../utils/grafana-client.js";
import { logger } from "../utils/logger.js";

/**
 * List Pyroscope label names.
 */
server.tool(
  "grafana_list_pyroscope_label_names",
  {
    datasourceUid: z.string().describe("Pyroscope datasource UID"),
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

      const result = await grafanaRequest<string[]>(
        auth,
        `/api/datasources/proxy/uid/${datasourceUid}/pyroscope/label-names?${params.toString()}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ labelNames: result || [], total: (result || []).length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list Pyroscope label names", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing Pyroscope label names: ${message}` }] };
    }
  }
);

/**
 * List Pyroscope label values.
 */
server.tool(
  "grafana_list_pyroscope_label_values",
  {
    datasourceUid: z.string().describe("Pyroscope datasource UID"),
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
      params.append("name", labelName);
      if (start) params.append("start", start);
      if (end) params.append("end", end);

      const result = await grafanaRequest<string[]>(
        auth,
        `/api/datasources/proxy/uid/${datasourceUid}/pyroscope/label-values?${params.toString()}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ labelName, values: result || [], total: (result || []).length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list Pyroscope label values", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing Pyroscope label values: ${message}` }] };
    }
  }
);

/**
 * List Pyroscope profile types.
 */
server.tool(
  "grafana_list_pyroscope_profile_types",
  {
    datasourceUid: z.string().describe("Pyroscope datasource UID"),
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

      const result = await grafanaRequest<Array<Record<string, unknown>>>(
        auth,
        `/api/datasources/proxy/uid/${datasourceUid}/pyroscope/profile-types?${params.toString()}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ profileTypes: result || [], total: (result || []).length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list Pyroscope profile types", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing Pyroscope profile types: ${message}` }] };
    }
  }
);

/**
 * Fetch Pyroscope profile.
 */
server.tool(
  "grafana_fetch_pyroscope_profile",
  {
    datasourceUid: z.string().describe("Pyroscope datasource UID"),
    query: z.string().describe("Profile query (e.g., 'process_cpu:cpu:nanoseconds:cpu:nanoseconds{service_name=\"myapp\"}')"),
    start: z.string().optional().describe("Start time (RFC3339)"),
    end: z.string().optional().describe("End time (RFC3339)"),
    maxNodes: z.number().optional().describe("Maximum number of nodes in the profile"),
  },
  async ({ datasourceUid, query, start, end, maxNodes }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const params = new URLSearchParams();
      params.append("query", query);
      if (start) params.append("from", start);
      if (end) params.append("until", end);
      if (maxNodes) params.append("maxNodes", maxNodes.toString());

      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `/api/datasources/proxy/uid/${datasourceUid}/pyroscope/render?${params.toString()}`
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
      logger.error("Failed to fetch Pyroscope profile", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error fetching Pyroscope profile: ${message}` }] };
    }
  }
);

logger.info("Grafana Pyroscope tools registered");

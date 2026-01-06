import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { grafanaRequest } from "../utils/grafana-client.js";
import { logger } from "../utils/logger.js";

const SIFT_API_BASE = "/api/plugins/grafana-sift-app/resources";

/**
 * Get Sift investigation by ID.
 */
server.tool(
  "grafana_get_sift_investigation",
  {
    investigationId: z.string().describe("Investigation UUID"),
  },
  async ({ investigationId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `${SIFT_API_BASE}/api/v1/investigations/${investigationId}`
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
      logger.error("Failed to get Sift investigation", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting Sift investigation: ${message}` }] };
    }
  }
);

/**
 * Get Sift analysis from investigation.
 */
server.tool(
  "grafana_get_sift_analysis",
  {
    investigationId: z.string().describe("Investigation UUID"),
    analysisId: z.string().describe("Analysis UUID"),
  },
  async ({ investigationId, analysisId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `${SIFT_API_BASE}/api/v1/investigations/${investigationId}/analyses/${analysisId}`
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
      logger.error("Failed to get Sift analysis", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting Sift analysis: ${message}` }] };
    }
  }
);

/**
 * List Sift investigations.
 */
server.tool(
  "grafana_list_sift_investigations",
  {
    limit: z.number().optional().describe("Maximum number of results (default: 10)"),
  },
  async ({ limit }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const params = new URLSearchParams();
      params.append("limit", (limit || 10).toString());

      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `${SIFT_API_BASE}/api/v1/investigations?${params.toString()}`
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
      logger.error("Failed to list Sift investigations", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing Sift investigations: ${message}` }] };
    }
  }
);

/**
 * Find error pattern logs.
 */
server.tool(
  "grafana_find_error_pattern_logs",
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
      const body: Record<string, unknown> = {
        datasourceUid,
        analysisType: "error-patterns",
      };

      if (start) body.start = start;
      if (end) body.end = end;

      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `${SIFT_API_BASE}/api/v1/analyses`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
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
      logger.error("Failed to find error pattern logs", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error finding error patterns: ${message}` }] };
    }
  }
);

/**
 * Find slow requests.
 */
server.tool(
  "grafana_find_slow_requests",
  {
    datasourceUid: z.string().describe("Tempo datasource UID"),
    start: z.string().optional().describe("Start time (RFC3339)"),
    end: z.string().optional().describe("End time (RFC3339)"),
    threshold: z.string().optional().describe("Latency threshold (e.g., '1s', '500ms')"),
  },
  async ({ datasourceUid, start, end, threshold }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const body: Record<string, unknown> = {
        datasourceUid,
        analysisType: "slow-requests",
      };

      if (start) body.start = start;
      if (end) body.end = end;
      if (threshold) body.threshold = threshold;

      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `${SIFT_API_BASE}/api/v1/analyses`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
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
      logger.error("Failed to find slow requests", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error finding slow requests: ${message}` }] };
    }
  }
);

logger.info("Grafana Sift tools registered");

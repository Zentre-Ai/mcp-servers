import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { logger } from "../utils/logger.js";

/**
 * Generate Grafana deeplink URL.
 */
server.tool(
  "grafana_generate_deeplink",
  {
    type: z.enum(["dashboard", "panel", "explore"]).describe("Link type"),
    dashboardUid: z.string().optional().describe("Dashboard UID (required for dashboard/panel)"),
    panelId: z.number().optional().describe("Panel ID (required for panel type)"),
    datasourceUid: z.string().optional().describe("Datasource UID (required for explore)"),
    query: z.string().optional().describe("Query string for explore"),
    from: z.string().optional().describe("Start time (e.g., 'now-1h')"),
    to: z.string().optional().describe("End time (e.g., 'now')"),
    variables: z.record(z.string()).optional().describe("Dashboard variables as key-value pairs"),
  },
  async ({ type, dashboardUid, panelId, datasourceUid, query, from, to, variables }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const baseUrl = auth.url;
      let url = "";

      switch (type) {
        case "dashboard": {
          if (!dashboardUid) {
            return {
              content: [{ type: "text", text: "Error: dashboardUid is required for dashboard links" }],
            };
          }
          url = `${baseUrl}/d/${dashboardUid}`;
          break;
        }
        case "panel": {
          if (!dashboardUid || panelId === undefined) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: dashboardUid and panelId are required for panel links",
                },
              ],
            };
          }
          url = `${baseUrl}/d/${dashboardUid}?viewPanel=${panelId}`;
          break;
        }
        case "explore": {
          if (!datasourceUid) {
            return {
              content: [{ type: "text", text: "Error: datasourceUid is required for explore links" }],
            };
          }
          const left = JSON.stringify({
            datasource: datasourceUid,
            queries: query ? [{ expr: query, refId: "A" }] : [],
            range: { from: from || "now-1h", to: to || "now" },
          });
          url = `${baseUrl}/explore?left=${encodeURIComponent(left)}`;
          break;
        }
      }

      // Add time range parameters
      const params = new URLSearchParams();
      if (from && type !== "explore") params.append("from", from);
      if (to && type !== "explore") params.append("to", to);

      // Add dashboard variables
      if (variables && type !== "explore") {
        for (const [key, value] of Object.entries(variables)) {
          params.append(`var-${key}`, value);
        }
      }

      const queryString = params.toString();
      if (queryString && type !== "panel") {
        url += (url.includes("?") ? "&" : "?") + queryString;
      } else if (queryString && type === "panel") {
        url += "&" + queryString;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ type, url }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to generate deeplink", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error generating deeplink: ${message}` }] };
    }
  }
);

logger.info("Grafana navigation tools registered");

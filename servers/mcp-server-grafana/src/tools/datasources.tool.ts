import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { grafanaRequest } from "../utils/grafana-client.js";
import { logger } from "../utils/logger.js";

/**
 * List all datasources.
 */
server.tool(
  "grafana_list_datasources",
  {
    type: z.string().optional().describe("Filter by datasource type (e.g., 'prometheus', 'loki')"),
  },
  async ({ type }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const datasources = await grafanaRequest<Array<Record<string, unknown>>>(
        auth,
        "/api/datasources"
      );

      let filtered = datasources;
      if (type) {
        filtered = datasources.filter((ds) => ds.type === type);
      }

      const summary = filtered.map((ds) => ({
        id: ds.id,
        uid: ds.uid,
        name: ds.name,
        type: ds.type,
        isDefault: ds.isDefault,
        url: ds.url,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ datasources: summary }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list datasources", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing datasources: ${message}` }] };
    }
  }
);

/**
 * Get datasource by UID.
 */
server.tool(
  "grafana_get_datasource_by_uid",
  {
    uid: z.string().describe("Datasource UID"),
  },
  async ({ uid }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const datasource = await grafanaRequest<Record<string, unknown>>(
        auth,
        `/api/datasources/uid/${uid}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(datasource, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get datasource", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting datasource: ${message}` }] };
    }
  }
);

/**
 * Get datasource by name.
 */
server.tool(
  "grafana_get_datasource_by_name",
  {
    name: z.string().describe("Datasource name"),
  },
  async ({ name }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const datasource = await grafanaRequest<Record<string, unknown>>(
        auth,
        `/api/datasources/name/${encodeURIComponent(name)}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(datasource, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get datasource by name", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting datasource: ${message}` }] };
    }
  }
);

logger.info("Grafana datasource tools registered");

import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { grafanaRequest } from "../utils/grafana-client.js";
import { logger } from "../utils/logger.js";

/**
 * Search dashboards.
 */
server.tool(
  "grafana_search_dashboards",
  {
    query: z.string().optional().describe("Search query string"),
    tag: z.array(z.string()).optional().describe("Filter by tags"),
    folderIds: z.array(z.number()).optional().describe("Filter by folder IDs"),
    limit: z.number().optional().describe("Maximum number of results"),
  },
  async ({ query, tag, folderIds, limit }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const params = new URLSearchParams();
      params.append("type", "dash-db");
      if (query) params.append("query", query);
      if (tag) tag.forEach((t) => params.append("tag", t));
      if (folderIds) folderIds.forEach((id) => params.append("folderIds", id.toString()));
      if (limit) params.append("limit", limit.toString());

      const results = await grafanaRequest<Array<Record<string, unknown>>>(
        auth,
        `/api/search?${params.toString()}`
      );

      const dashboards = results.map((item) => ({
        uid: item.uid,
        title: item.title,
        url: item.url,
        type: item.type,
        tags: item.tags,
        folderTitle: item.folderTitle,
        folderUid: item.folderUid,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ dashboards, total: dashboards.length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to search dashboards", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error searching dashboards: ${message}` }] };
    }
  }
);

/**
 * Search folders.
 */
server.tool(
  "grafana_search_folders",
  {
    query: z.string().optional().describe("Search query string"),
    limit: z.number().optional().describe("Maximum number of results"),
  },
  async ({ query, limit }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const params = new URLSearchParams();
      params.append("type", "dash-folder");
      if (query) params.append("query", query);
      if (limit) params.append("limit", limit.toString());

      const results = await grafanaRequest<Array<Record<string, unknown>>>(
        auth,
        `/api/search?${params.toString()}`
      );

      const folders = results.map((item) => ({
        uid: item.uid,
        title: item.title,
        url: item.url,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ folders, total: folders.length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to search folders", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error searching folders: ${message}` }] };
    }
  }
);

logger.info("Grafana search tools registered");

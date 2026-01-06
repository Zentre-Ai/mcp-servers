import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { grafanaRequest } from "../utils/grafana-client.js";
import { logger } from "../utils/logger.js";

/**
 * Get dashboard by UID.
 */
server.tool(
  "grafana_get_dashboard_by_uid",
  {
    uid: z.string().describe("Dashboard UID"),
  },
  async ({ uid }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const dashboard = await grafanaRequest<Record<string, unknown>>(
        auth,
        `/api/dashboards/uid/${uid}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(dashboard, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get dashboard", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting dashboard: ${message}` }] };
    }
  }
);

/**
 * Update or create a dashboard.
 */
server.tool(
  "grafana_update_dashboard",
  {
    dashboard: z.record(z.unknown()).describe("Dashboard JSON object"),
    folderUid: z.string().optional().describe("Folder UID to save dashboard in"),
    overwrite: z.boolean().optional().describe("Overwrite existing dashboard"),
    message: z.string().optional().describe("Commit message for the change"),
  },
  async ({ dashboard, folderUid, overwrite, message }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const body: Record<string, unknown> = {
        dashboard,
        overwrite: overwrite ?? true,
      };
      if (folderUid) body.folderUid = folderUid;
      if (message) body.message = message;

      const result = await grafanaRequest<Record<string, unknown>>(auth, "/api/dashboards/db", {
        method: "POST",
        body: JSON.stringify(body),
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update dashboard", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating dashboard: ${message}` }] };
    }
  }
);

/**
 * Get dashboard panel queries.
 */
server.tool(
  "grafana_get_dashboard_panel_queries",
  {
    uid: z.string().describe("Dashboard UID"),
  },
  async ({ uid }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const response = await grafanaRequest<{ dashboard: Record<string, unknown> }>(
        auth,
        `/api/dashboards/uid/${uid}`
      );

      const dashboard = response.dashboard;
      const panels = (dashboard.panels as Array<Record<string, unknown>>) || [];

      const panelQueries = panels.map((panel) => ({
        id: panel.id,
        title: panel.title,
        type: panel.type,
        datasource: panel.datasource,
        targets: panel.targets || [],
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ panels: panelQueries }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get dashboard panel queries", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting panel queries: ${message}` }] };
    }
  }
);

/**
 * Get dashboard property using JSONPath.
 */
server.tool(
  "grafana_get_dashboard_property",
  {
    uid: z.string().describe("Dashboard UID"),
    path: z.string().describe("Property path (e.g., 'title', 'panels[0].title', 'templating.list')"),
  },
  async ({ uid, path }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const response = await grafanaRequest<{ dashboard: Record<string, unknown> }>(
        auth,
        `/api/dashboards/uid/${uid}`
      );

      const dashboard = response.dashboard;

      // Simple path resolution (supports dot notation and array access)
      const parts = path.split(/\.|\[|\]/).filter(Boolean);
      let value: unknown = dashboard;

      for (const part of parts) {
        if (value === null || value === undefined) break;
        if (typeof value === "object") {
          value = (value as Record<string, unknown>)[part];
        } else {
          value = undefined;
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ path, value }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get dashboard property", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting dashboard property: ${message}` }] };
    }
  }
);

/**
 * Get dashboard summary (compact overview).
 */
server.tool(
  "grafana_get_dashboard_summary",
  {
    uid: z.string().describe("Dashboard UID"),
  },
  async ({ uid }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const response = await grafanaRequest<{
        dashboard: Record<string, unknown>;
        meta: Record<string, unknown>;
      }>(auth, `/api/dashboards/uid/${uid}`);

      const { dashboard, meta } = response;
      const panels = (dashboard.panels as Array<Record<string, unknown>>) || [];
      const templating = (dashboard.templating as { list?: Array<Record<string, unknown>> }) || {};
      const variables = templating.list || [];

      const summary = {
        uid: dashboard.uid,
        title: dashboard.title,
        description: dashboard.description,
        tags: dashboard.tags,
        folderTitle: meta.folderTitle,
        folderUrl: meta.folderUrl,
        created: meta.created,
        updated: meta.updated,
        createdBy: meta.createdBy,
        updatedBy: meta.updatedBy,
        panelCount: panels.length,
        panelTypes: [...new Set(panels.map((p) => p.type))],
        panelTitles: panels.map((p) => p.title),
        variableCount: variables.length,
        variableNames: variables.map((v) => v.name),
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get dashboard summary", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting dashboard summary: ${message}` }] };
    }
  }
);

logger.info("Grafana dashboard tools registered");

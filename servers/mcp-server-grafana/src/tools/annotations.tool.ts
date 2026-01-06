import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { grafanaRequest } from "../utils/grafana-client.js";
import { logger } from "../utils/logger.js";

/**
 * Get annotations with filters.
 */
server.tool(
  "grafana_get_annotations",
  {
    dashboardUid: z.string().optional().describe("Filter by dashboard UID"),
    panelId: z.number().optional().describe("Filter by panel ID"),
    from: z.number().optional().describe("Start time (epoch milliseconds)"),
    to: z.number().optional().describe("End time (epoch milliseconds)"),
    tags: z.array(z.string()).optional().describe("Filter by tags"),
    limit: z.number().optional().describe("Maximum number of results"),
    type: z.enum(["alert", "annotation"]).optional().describe("Filter by type"),
  },
  async ({ dashboardUid, panelId, from, to, tags, limit, type }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const params = new URLSearchParams();
      if (dashboardUid) params.append("dashboardUID", dashboardUid);
      if (panelId) params.append("panelId", panelId.toString());
      if (from) params.append("from", from.toString());
      if (to) params.append("to", to.toString());
      if (tags) tags.forEach((t) => params.append("tags", t));
      if (limit) params.append("limit", limit.toString());
      if (type) params.append("type", type);

      const annotations = await grafanaRequest<Array<Record<string, unknown>>>(
        auth,
        `/api/annotations?${params.toString()}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ annotations, total: annotations.length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get annotations", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting annotations: ${message}` }] };
    }
  }
);

/**
 * Create annotation.
 */
server.tool(
  "grafana_create_annotation",
  {
    dashboardUid: z.string().optional().describe("Dashboard UID"),
    panelId: z.number().optional().describe("Panel ID"),
    time: z.number().optional().describe("Annotation time (epoch milliseconds)"),
    timeEnd: z.number().optional().describe("End time for region annotation"),
    text: z.string().describe("Annotation text"),
    tags: z.array(z.string()).optional().describe("Annotation tags"),
  },
  async ({ dashboardUid, panelId, time, timeEnd, text, tags }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const body: Record<string, unknown> = {
        text,
        time: time || Date.now(),
      };

      if (dashboardUid) body.dashboardUID = dashboardUid;
      if (panelId) body.panelId = panelId;
      if (timeEnd) body.timeEnd = timeEnd;
      if (tags) body.tags = tags;

      const result = await grafanaRequest<Record<string, unknown>>(auth, "/api/annotations", {
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
      logger.error("Failed to create annotation", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating annotation: ${message}` }] };
    }
  }
);

/**
 * Create Graphite-style annotation.
 */
server.tool(
  "grafana_create_graphite_annotation",
  {
    what: z.string().describe("Event description"),
    when: z.number().optional().describe("Event time (epoch seconds)"),
    tags: z.array(z.string()).optional().describe("Event tags"),
    data: z.string().optional().describe("Additional event data"),
  },
  async ({ what, when, tags, data }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const body: Record<string, unknown> = {
        what,
      };

      if (when) body.when = when;
      if (tags) body.tags = tags;
      if (data) body.data = data;

      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        "/api/annotations/graphite",
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
      logger.error("Failed to create Graphite annotation", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating Graphite annotation: ${message}` }] };
    }
  }
);

/**
 * Update annotation (full update).
 */
server.tool(
  "grafana_update_annotation",
  {
    annotationId: z.number().describe("Annotation ID"),
    text: z.string().describe("Updated annotation text"),
    time: z.number().optional().describe("Updated time (epoch milliseconds)"),
    timeEnd: z.number().optional().describe("Updated end time"),
    tags: z.array(z.string()).optional().describe("Updated tags"),
  },
  async ({ annotationId, text, time, timeEnd, tags }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const body: Record<string, unknown> = {
        text,
      };

      if (time) body.time = time;
      if (timeEnd) body.timeEnd = timeEnd;
      if (tags) body.tags = tags;

      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `/api/annotations/${annotationId}`,
        {
          method: "PUT",
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
      logger.error("Failed to update annotation", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating annotation: ${message}` }] };
    }
  }
);

/**
 * Patch annotation (partial update).
 */
server.tool(
  "grafana_patch_annotation",
  {
    annotationId: z.number().describe("Annotation ID"),
    text: z.string().optional().describe("Updated annotation text"),
    time: z.number().optional().describe("Updated time (epoch milliseconds)"),
    timeEnd: z.number().optional().describe("Updated end time"),
    tags: z.array(z.string()).optional().describe("Updated tags"),
  },
  async ({ annotationId, text, time, timeEnd, tags }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const body: Record<string, unknown> = {};

      if (text) body.text = text;
      if (time) body.time = time;
      if (timeEnd) body.timeEnd = timeEnd;
      if (tags) body.tags = tags;

      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `/api/annotations/${annotationId}`,
        {
          method: "PATCH",
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
      logger.error("Failed to patch annotation", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error patching annotation: ${message}` }] };
    }
  }
);

/**
 * Get annotation tags.
 */
server.tool(
  "grafana_get_annotation_tags",
  {
    tag: z.string().optional().describe("Filter tags by prefix"),
    limit: z.number().optional().describe("Maximum number of results"),
  },
  async ({ tag, limit }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const params = new URLSearchParams();
      if (tag) params.append("tag", tag);
      if (limit) params.append("limit", limit.toString());

      const result = await grafanaRequest<{ result: { tags: Array<{ tag: string; count: number }> } }>(
        auth,
        `/api/annotations/tags?${params.toString()}`
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
      logger.error("Failed to get annotation tags", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting annotation tags: ${message}` }] };
    }
  }
);

logger.info("Grafana annotation tools registered");

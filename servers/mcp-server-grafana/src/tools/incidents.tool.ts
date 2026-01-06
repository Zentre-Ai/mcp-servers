import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { grafanaRequest } from "../utils/grafana-client.js";
import { logger } from "../utils/logger.js";

const INCIDENT_API_BASE = "/api/plugins/grafana-incident-app/resources/api/v1";

/**
 * List incidents.
 */
server.tool(
  "grafana_list_incidents",
  {
    status: z.enum(["active", "resolved"]).optional().describe("Filter by status"),
    includeDrillIncidents: z.boolean().optional().describe("Include drill/test incidents"),
    limit: z.number().optional().describe("Maximum number of results"),
  },
  async ({ status, includeDrillIncidents, limit }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const body: Record<string, unknown> = {
        query: {},
      };

      if (status) {
        body.query = { ...body.query as object, status };
      }
      if (includeDrillIncidents !== undefined) {
        body.query = { ...body.query as object, includeDrillIncidents };
      }
      if (limit) {
        body.query = { ...body.query as object, limit };
      }

      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `${INCIDENT_API_BASE}/IncidentsService.QueryIncidents`,
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
      logger.error("Failed to list incidents", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing incidents: ${message}` }] };
    }
  }
);

/**
 * Create incident.
 */
server.tool(
  "grafana_create_incident",
  {
    title: z.string().describe("Incident title"),
    severity: z.enum(["minor", "major", "critical"]).describe("Incident severity"),
    roomPrefix: z.string().describe("Room prefix for the incident"),
    status: z.enum(["active", "resolved"]).optional().describe("Initial status"),
    labels: z.array(z.object({ key: z.string(), value: z.string() })).optional().describe("Incident labels"),
  },
  async ({ title, severity, roomPrefix, status, labels }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const body: Record<string, unknown> = {
        title,
        severity,
        roomPrefix,
      };

      if (status) body.status = status;
      if (labels) body.labels = labels;

      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `${INCIDENT_API_BASE}/IncidentsService.CreateIncident`,
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
      logger.error("Failed to create incident", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating incident: ${message}` }] };
    }
  }
);

/**
 * Add activity to incident timeline.
 */
server.tool(
  "grafana_add_activity_to_incident",
  {
    incidentId: z.string().describe("Incident ID"),
    body: z.string().describe("Activity note text"),
  },
  async ({ incidentId, body: activityBody }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const body = {
        incidentID: incidentId,
        activityKind: "userNote",
        body: activityBody,
      };

      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `${INCIDENT_API_BASE}/ActivityService.AddActivity`,
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
      logger.error("Failed to add activity to incident", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error adding activity to incident: ${message}` }] };
    }
  }
);

/**
 * Get incident details.
 */
server.tool(
  "grafana_get_incident",
  {
    incidentId: z.string().describe("Incident ID"),
  },
  async ({ incidentId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const body = {
        incidentID: incidentId,
      };

      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        `${INCIDENT_API_BASE}/IncidentsService.GetIncident`,
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
      logger.error("Failed to get incident", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting incident: ${message}` }] };
    }
  }
);

logger.info("Grafana incident tools registered");

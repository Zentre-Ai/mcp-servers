import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { grafanaRequest } from "../utils/grafana-client.js";
import { logger } from "../utils/logger.js";

/**
 * List alert rules.
 */
server.tool(
  "grafana_list_alert_rules",
  {
    folderUid: z.string().optional().describe("Filter by folder UID"),
    ruleGroup: z.string().optional().describe("Filter by rule group name"),
    limit: z.number().optional().describe("Maximum number of results"),
  },
  async ({ folderUid, ruleGroup, limit }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const result = await grafanaRequest<Record<string, unknown>>(
        auth,
        "/api/v1/provisioning/alert-rules"
      );

      let rules = (result as unknown as Array<Record<string, unknown>>) || [];

      // Apply filters
      if (folderUid) {
        rules = rules.filter((r) => r.folderUID === folderUid);
      }
      if (ruleGroup) {
        rules = rules.filter((r) => r.ruleGroup === ruleGroup);
      }
      if (limit) {
        rules = rules.slice(0, limit);
      }

      const summary = rules.map((rule) => ({
        uid: rule.uid,
        title: rule.title,
        folderUID: rule.folderUID,
        ruleGroup: rule.ruleGroup,
        condition: rule.condition,
        noDataState: rule.noDataState,
        execErrState: rule.execErrState,
        for: rule.for,
        labels: rule.labels,
        annotations: rule.annotations,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ alertRules: summary, total: summary.length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list alert rules", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing alert rules: ${message}` }] };
    }
  }
);

/**
 * Get alert rule by UID.
 */
server.tool(
  "grafana_get_alert_rule_by_uid",
  {
    uid: z.string().describe("Alert rule UID"),
  },
  async ({ uid }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const rule = await grafanaRequest<Record<string, unknown>>(
        auth,
        `/api/v1/provisioning/alert-rules/${uid}`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(rule, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get alert rule", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting alert rule: ${message}` }] };
    }
  }
);

/**
 * Create alert rule.
 */
server.tool(
  "grafana_create_alert_rule",
  {
    title: z.string().describe("Alert rule title"),
    folderUid: z.string().describe("Folder UID"),
    ruleGroup: z.string().describe("Rule group name"),
    condition: z.string().describe("Condition reference (e.g., 'C')"),
    data: z.array(z.record(z.unknown())).describe("Query and condition data"),
    noDataState: z.enum(["Alerting", "NoData", "OK"]).optional().describe("State when no data"),
    execErrState: z.enum(["Alerting", "Error", "OK"]).optional().describe("State on execution error"),
    forDuration: z.string().optional().describe("For duration (e.g., '5m')"),
    labels: z.record(z.string()).optional().describe("Alert labels"),
    annotations: z.record(z.string()).optional().describe("Alert annotations"),
  },
  async ({ title, folderUid, ruleGroup, condition, data, noDataState, execErrState, forDuration, labels, annotations }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const body: Record<string, unknown> = {
        title,
        folderUID: folderUid,
        ruleGroup,
        condition,
        data,
        noDataState: noDataState || "NoData",
        execErrState: execErrState || "Error",
      };

      if (forDuration) body.for = forDuration;
      if (labels) body.labels = labels;
      if (annotations) body.annotations = annotations;

      const rule = await grafanaRequest<Record<string, unknown>>(
        auth,
        "/api/v1/provisioning/alert-rules",
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(rule, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create alert rule", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating alert rule: ${message}` }] };
    }
  }
);

/**
 * Update alert rule.
 */
server.tool(
  "grafana_update_alert_rule",
  {
    uid: z.string().describe("Alert rule UID"),
    title: z.string().describe("Alert rule title"),
    folderUid: z.string().describe("Folder UID"),
    ruleGroup: z.string().describe("Rule group name"),
    condition: z.string().describe("Condition reference"),
    data: z.array(z.record(z.unknown())).describe("Query and condition data"),
    noDataState: z.enum(["Alerting", "NoData", "OK"]).optional().describe("State when no data"),
    execErrState: z.enum(["Alerting", "Error", "OK"]).optional().describe("State on execution error"),
    forDuration: z.string().optional().describe("For duration (e.g., '5m')"),
    labels: z.record(z.string()).optional().describe("Alert labels"),
    annotations: z.record(z.string()).optional().describe("Alert annotations"),
  },
  async ({ uid, title, folderUid, ruleGroup, condition, data, noDataState, execErrState, forDuration, labels, annotations }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const body: Record<string, unknown> = {
        uid,
        title,
        folderUID: folderUid,
        ruleGroup,
        condition,
        data,
        noDataState: noDataState || "NoData",
        execErrState: execErrState || "Error",
      };

      if (forDuration) body.for = forDuration;
      if (labels) body.labels = labels;
      if (annotations) body.annotations = annotations;

      const rule = await grafanaRequest<Record<string, unknown>>(
        auth,
        `/api/v1/provisioning/alert-rules/${uid}`,
        {
          method: "PUT",
          body: JSON.stringify(body),
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(rule, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update alert rule", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating alert rule: ${message}` }] };
    }
  }
);

/**
 * Delete alert rule.
 */
server.tool(
  "grafana_delete_alert_rule",
  {
    uid: z.string().describe("Alert rule UID"),
  },
  async ({ uid }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      await grafanaRequest<void>(auth, `/api/v1/provisioning/alert-rules/${uid}`, {
        method: "DELETE",
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Alert rule ${uid} deleted` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete alert rule", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting alert rule: ${message}` }] };
    }
  }
);

/**
 * List contact points.
 */
server.tool(
  "grafana_list_contact_points",
  {
    name: z.string().optional().describe("Filter by contact point name"),
  },
  async ({ name }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const params = new URLSearchParams();
      if (name) params.append("name", name);

      const contactPoints = await grafanaRequest<Array<Record<string, unknown>>>(
        auth,
        `/api/v1/provisioning/contact-points?${params.toString()}`
      );

      const summary = contactPoints.map((cp) => ({
        uid: cp.uid,
        name: cp.name,
        type: cp.type,
        disableResolveMessage: cp.disableResolveMessage,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ contactPoints: summary, total: summary.length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list contact points", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing contact points: ${message}` }] };
    }
  }
);

logger.info("Grafana alerting tools registered");

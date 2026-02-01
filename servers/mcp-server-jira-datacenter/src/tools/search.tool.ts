import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createJiraClient, formatIssue } from "../utils/jira-client.js";
import { logger } from "../utils/logger.js";

/**
 * Search for issues using JQL (Jira Query Language).
 */
server.tool(
  "jira_search",
  {
    jql: z.string().describe("JQL query string (e.g., 'project = PROJ AND status = Open')"),
    startAt: z.number().optional().describe("Index of first result to return"),
    maxResults: z.number().optional().describe("Maximum number of results (default 50, max 100)"),
    fields: z.string().optional().describe("Comma-separated list of fields to return"),
    expand: z.string().optional().describe("Comma-separated list of fields to expand"),
  },
  async ({ jql, startAt, maxResults, fields, expand }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira credentials available" }] };
    }

    try {
      const client = createJiraClient(auth);
      const result = await client.post<{
        issues: Array<Record<string, unknown>>;
        total: number;
        startAt: number;
        maxResults: number;
      }>("/search", {
        jql,
        startAt: startAt || 0,
        maxResults: maxResults || 50,
        fields: fields ? fields.split(",").map((f) => f.trim()) : undefined,
        expand: expand ? expand.split(",").map((e) => e.trim()) : undefined,
      });

      const issues = result.issues.map(formatIssue);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: result.total,
                startAt: result.startAt,
                maxResults: result.maxResults,
                issues,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to search issues", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error searching issues: ${message}` }] };
    }
  }
);

/**
 * Search for issues assigned to current user.
 */
server.tool(
  "jira_my_issues",
  {
    status: z.string().optional().describe("Filter by status (e.g., 'Open', 'In Progress')"),
    project: z.string().optional().describe("Filter by project key"),
    maxResults: z.number().optional().describe("Maximum number of results (default 50)"),
  },
  async ({ status, project, maxResults }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira credentials available" }] };
    }

    try {
      const client = createJiraClient(auth);

      let jql = "assignee = currentUser()";
      if (status) {
        jql += ` AND status = "${status}"`;
      }
      if (project) {
        jql += ` AND project = ${project}`;
      }
      jql += " ORDER BY updated DESC";

      const result = await client.post<{
        issues: Array<Record<string, unknown>>;
        total: number;
      }>("/search", {
        jql,
        maxResults: maxResults || 50,
      });

      const issues = result.issues.map(formatIssue);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ total: result.total, issues }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get my issues", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting my issues: ${message}` }] };
    }
  }
);

/**
 * Get recently updated issues.
 */
server.tool(
  "jira_recent_issues",
  {
    project: z.string().optional().describe("Filter by project key"),
    updatedWithin: z.string().optional().describe("Time range (e.g., '-1d', '-1w', '-1h')"),
    maxResults: z.number().optional().describe("Maximum number of results (default 20)"),
  },
  async ({ project, updatedWithin = "-1d", maxResults = 20 }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira credentials available" }] };
    }

    try {
      const client = createJiraClient(auth);

      let jql = `updated >= "${updatedWithin}"`;
      if (project) {
        jql += ` AND project = ${project}`;
      }
      jql += " ORDER BY updated DESC";

      const result = await client.post<{
        issues: Array<Record<string, unknown>>;
        total: number;
      }>("/search", {
        jql,
        maxResults,
      });

      const issues = result.issues.map(formatIssue);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ total: result.total, issues }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get recent issues", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting recent issues: ${message}` }] };
    }
  }
);

/**
 * Get sprint issues.
 */
server.tool(
  "jira_sprint_issues",
  {
    sprintId: z.number().describe("Sprint ID (use jira_get_sprints to find)"),
    status: z.string().optional().describe("Filter by status"),
    maxResults: z.number().optional().describe("Maximum number of results (default 50)"),
  },
  async ({ sprintId, status, maxResults = 50 }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira credentials available" }] };
    }

    try {
      const client = createJiraClient(auth);

      let jql = `sprint = ${sprintId}`;
      if (status) {
        jql += ` AND status = "${status}"`;
      }
      jql += " ORDER BY rank ASC";

      const result = await client.post<{
        issues: Array<Record<string, unknown>>;
        total: number;
      }>("/search", {
        jql,
        maxResults,
      });

      const issues = result.issues.map(formatIssue);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ sprintId, total: result.total, issues }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get sprint issues", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting sprint issues: ${message}` }] };
    }
  }
);

/**
 * Get epic issues (issues linked to an epic).
 */
server.tool(
  "jira_epic_issues",
  {
    epicKey: z.string().describe("Epic issue key (e.g., 'PROJ-100')"),
    maxResults: z.number().optional().describe("Maximum number of results (default 50)"),
  },
  async ({ epicKey, maxResults = 50 }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira credentials available" }] };
    }

    try {
      const client = createJiraClient(auth);

      // Try both epic link field names as they vary by Jira configuration
      const jql = `"Epic Link" = ${epicKey} OR parent = ${epicKey} ORDER BY rank ASC`;

      const result = await client.post<{
        issues: Array<Record<string, unknown>>;
        total: number;
      }>("/search", {
        jql,
        maxResults,
      });

      const issues = result.issues.map(formatIssue);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ epicKey, total: result.total, issues }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get epic issues", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting epic issues: ${message}` }] };
    }
  }
);

logger.info("Jira search tools registered");

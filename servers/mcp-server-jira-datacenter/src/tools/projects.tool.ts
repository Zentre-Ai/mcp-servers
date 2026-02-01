import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createJiraClient, formatProject } from "../utils/jira-client.js";
import { logger } from "../utils/logger.js";

/**
 * List all projects.
 */
server.tool(
  "jira_list_projects",
  {
    startAt: z.number().optional().describe("Index of first project to return"),
    maxResults: z.number().optional().describe("Maximum number of projects (default 50)"),
    orderBy: z.string().optional().describe("Order by field (e.g., 'name', 'key')"),
    query: z.string().optional().describe("Filter by project name or key"),
    expand: z.string().optional().describe("Comma-separated list of fields to expand"),
  },
  async ({ startAt, maxResults, orderBy, query, expand }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira credentials available" }] };
    }

    try {
      const client = createJiraClient(auth);
      const result = await client.get<{
        values: Array<Record<string, unknown>>;
        total: number;
        startAt: number;
        maxResults: number;
      }>("/project/search", { startAt, maxResults, orderBy, query, expand });

      const projects = result.values.map(formatProject);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: result.total,
                startAt: result.startAt,
                maxResults: result.maxResults,
                projects,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list projects", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing projects: ${message}` }] };
    }
  }
);

/**
 * Get a project by key or ID.
 */
server.tool(
  "jira_get_project",
  {
    projectIdOrKey: z.string().describe("Project key (e.g., 'PROJ') or ID"),
    expand: z.string().optional().describe("Comma-separated list of fields to expand"),
  },
  async ({ projectIdOrKey, expand }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira credentials available" }] };
    }

    try {
      const client = createJiraClient(auth);
      const project = await client.get<Record<string, unknown>>(`/project/${projectIdOrKey}`, { expand });

      return { content: [{ type: "text", text: JSON.stringify(formatProject(project), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get project", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting project: ${message}` }] };
    }
  }
);

/**
 * Get issue types for a project.
 */
server.tool(
  "jira_get_issue_types",
  {
    projectIdOrKey: z.string().describe("Project key (e.g., 'PROJ') or ID"),
  },
  async ({ projectIdOrKey }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira credentials available" }] };
    }

    try {
      const client = createJiraClient(auth);
      const result = await client.get<Array<Record<string, unknown>>>(`/project/${projectIdOrKey}/statuses`);

      const issueTypes = result.map((it) => ({
        id: it.id,
        name: it.name,
        subtask: it.subtask,
        statuses: ((it.statuses as Array<Record<string, unknown>>) || []).map((s) => ({
          id: s.id,
          name: s.name,
          statusCategory: s.statusCategory,
        })),
      }));

      return { content: [{ type: "text", text: JSON.stringify({ projectIdOrKey, issueTypes }, null, 2) }] };
    } catch (error) {
      logger.error("Failed to get issue types", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting issue types: ${message}` }] };
    }
  }
);

/**
 * Get project components.
 */
server.tool(
  "jira_get_components",
  {
    projectIdOrKey: z.string().describe("Project key (e.g., 'PROJ') or ID"),
  },
  async ({ projectIdOrKey }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira credentials available" }] };
    }

    try {
      const client = createJiraClient(auth);
      const components = await client.get<Array<Record<string, unknown>>>(`/project/${projectIdOrKey}/components`);

      const result = components.map((c) => {
        const lead = c.lead as Record<string, unknown> | undefined;
        return {
          id: c.id,
          name: c.name,
          description: c.description,
          lead: lead ? { accountId: lead.accountId, displayName: lead.displayName } : undefined,
          assigneeType: c.assigneeType,
        };
      });

      return { content: [{ type: "text", text: JSON.stringify({ projectIdOrKey, components: result }, null, 2) }] };
    } catch (error) {
      logger.error("Failed to get components", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting components: ${message}` }] };
    }
  }
);

/**
 * Get project versions (releases).
 */
server.tool(
  "jira_get_versions",
  {
    projectIdOrKey: z.string().describe("Project key (e.g., 'PROJ') or ID"),
  },
  async ({ projectIdOrKey }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira credentials available" }] };
    }

    try {
      const client = createJiraClient(auth);
      const versions = await client.get<Array<Record<string, unknown>>>(`/project/${projectIdOrKey}/versions`);

      const result = versions.map((v) => ({
        id: v.id,
        name: v.name,
        description: v.description,
        released: v.released,
        archived: v.archived,
        releaseDate: v.releaseDate,
        startDate: v.startDate,
        overdue: v.overdue,
      }));

      return { content: [{ type: "text", text: JSON.stringify({ projectIdOrKey, versions: result }, null, 2) }] };
    } catch (error) {
      logger.error("Failed to get versions", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting versions: ${message}` }] };
    }
  }
);

/**
 * Get all sprints for a board.
 */
server.tool(
  "jira_get_sprints",
  {
    boardId: z.number().describe("Board ID (use jira_get_boards to find)"),
    state: z.string().optional().describe("Filter by state: active, future, closed"),
    startAt: z.number().optional().describe("Index of first sprint to return"),
    maxResults: z.number().optional().describe("Maximum number of sprints (default 50)"),
  },
  async ({ boardId, state, startAt, maxResults }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira credentials available" }] };
    }

    try {
      const client = createJiraClient(auth);
      // Note: This uses the Agile API which is at a different base URL
      // We'll construct the URL manually
      let host = auth.host.replace(/\/$/, "");
      if (!host.startsWith("http")) {
        host = `https://${host}`;
      }

      const params = new URLSearchParams();
      if (state) params.append("state", state);
      if (startAt !== undefined) params.append("startAt", String(startAt));
      if (maxResults !== undefined) params.append("maxResults", String(maxResults));

      const url = `${host}/rest/agile/1.0/board/${boardId}/sprint?${params.toString()}`;

      const headers: Record<string, string> = {
        Accept: "application/json",
      };

      if (auth.bearerToken) {
        headers.Authorization = `Bearer ${auth.bearerToken}`;
      } else if (auth.email && auth.apiToken) {
        const credentials = Buffer.from(`${auth.email}:${auth.apiToken}`).toString("base64");
        headers.Authorization = `Basic ${credentials}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`Agile API error: ${response.status} ${response.statusText}`);
      }

      const result = (await response.json()) as {
        values: Array<Record<string, unknown>>;
        total: number;
      };

      const sprints = result.values.map((s) => ({
        id: s.id,
        name: s.name,
        state: s.state,
        startDate: s.startDate,
        endDate: s.endDate,
        completeDate: s.completeDate,
        goal: s.goal,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ boardId, total: result.total, sprints }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get sprints", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting sprints: ${message}` }] };
    }
  }
);

/**
 * Get all boards.
 */
server.tool(
  "jira_get_boards",
  {
    projectKeyOrId: z.string().optional().describe("Filter by project"),
    type: z.string().optional().describe("Filter by type: scrum, kanban"),
    name: z.string().optional().describe("Filter by board name (contains)"),
    startAt: z.number().optional().describe("Index of first board to return"),
    maxResults: z.number().optional().describe("Maximum number of boards (default 50)"),
  },
  async ({ projectKeyOrId, type, name, startAt, maxResults }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira credentials available" }] };
    }

    try {
      let host = auth.host.replace(/\/$/, "");
      if (!host.startsWith("http")) {
        host = `https://${host}`;
      }

      const params = new URLSearchParams();
      if (projectKeyOrId) params.append("projectKeyOrId", projectKeyOrId);
      if (type) params.append("type", type);
      if (name) params.append("name", name);
      if (startAt !== undefined) params.append("startAt", String(startAt));
      if (maxResults !== undefined) params.append("maxResults", String(maxResults));

      const url = `${host}/rest/agile/1.0/board?${params.toString()}`;

      const headers: Record<string, string> = {
        Accept: "application/json",
      };

      if (auth.bearerToken) {
        headers.Authorization = `Bearer ${auth.bearerToken}`;
      } else if (auth.email && auth.apiToken) {
        const credentials = Buffer.from(`${auth.email}:${auth.apiToken}`).toString("base64");
        headers.Authorization = `Basic ${credentials}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`Agile API error: ${response.status} ${response.statusText}`);
      }

      const result = (await response.json()) as {
        values: Array<Record<string, unknown>>;
        total: number;
      };

      const boards = result.values.map((b) => {
        const location = b.location as Record<string, unknown> | undefined;
        return {
          id: b.id,
          name: b.name,
          type: b.type,
          location: location
            ? {
                projectId: location.projectId,
                projectKey: location.projectKey,
                projectName: location.projectName,
              }
            : undefined,
        };
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ total: result.total, boards }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get boards", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting boards: ${message}` }] };
    }
  }
);

logger.info("Jira project tools registered");

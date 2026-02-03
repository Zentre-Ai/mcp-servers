import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createGitLabClient, formatProject } from "../utils/gitlab-client.js";
import { logger } from "../utils/logger.js";

/**
 * List projects.
 */
server.tool(
  "gitlab_list_projects",
  {
    owned: z.boolean().optional().describe("Limit to projects owned by current user"),
    membership: z.boolean().optional().describe("Limit to projects current user is a member of"),
    starred: z.boolean().optional().describe("Limit to starred projects"),
    search: z.string().optional().describe("Search for projects by name"),
    visibility: z
      .enum(["public", "internal", "private"])
      .optional()
      .describe("Filter by visibility"),
    archived: z.boolean().optional().describe("Filter by archived status"),
    orderBy: z
      .enum(["id", "name", "path", "created_at", "updated_at", "last_activity_at"])
      .optional()
      .describe("Order by field"),
    sort: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    perPage: z.number().optional().describe("Number of results per page (default 20, max 100)"),
    page: z.number().optional().describe("Page number (default 1)"),
  },
  async ({ owned, membership, starred, search, visibility, archived, orderBy, sort, perPage, page }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const projects = await client.get<Array<Record<string, unknown>>>("/projects", {
        owned,
        membership,
        starred,
        search,
        visibility,
        archived,
        order_by: orderBy,
        sort,
        per_page: perPage,
        page,
      });

      const result = projects.map(formatProject);

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list projects", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing projects: ${message}` }] };
    }
  }
);

/**
 * Get a project by ID or path.
 */
server.tool(
  "gitlab_get_project",
  {
    projectId: z.string().describe("Project ID or URL-encoded path (e.g., 'namespace%2Fproject')"),
  },
  async ({ projectId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const project = await client.get<Record<string, unknown>>(`/projects/${encodedId}`);

      return { content: [{ type: "text", text: JSON.stringify(formatProject(project), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get project", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting project: ${message}` }] };
    }
  }
);

/**
 * Create a new project.
 */
server.tool(
  "gitlab_create_project",
  {
    name: z.string().describe("Project name"),
    path: z.string().optional().describe("Project path (defaults to name)"),
    namespaceId: z.number().optional().describe("Namespace ID to create project in"),
    description: z.string().optional().describe("Project description"),
    visibility: z
      .enum(["public", "internal", "private"])
      .optional()
      .describe("Project visibility (default: private)"),
    initializeWithReadme: z.boolean().optional().describe("Initialize with README"),
    defaultBranch: z.string().optional().describe("Default branch name"),
  },
  async ({ name, path, namespaceId, description, visibility, initializeWithReadme, defaultBranch }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const project = await client.post<Record<string, unknown>>("/projects", {
        name,
        path,
        namespace_id: namespaceId,
        description,
        visibility,
        initialize_with_readme: initializeWithReadme,
        default_branch: defaultBranch,
      });

      return { content: [{ type: "text", text: JSON.stringify(formatProject(project), null, 2) }] };
    } catch (error) {
      logger.error("Failed to create project", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating project: ${message}` }] };
    }
  }
);

/**
 * Update a project.
 */
server.tool(
  "gitlab_update_project",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    name: z.string().optional().describe("New project name"),
    description: z.string().optional().describe("New description"),
    visibility: z.enum(["public", "internal", "private"]).optional().describe("New visibility"),
    defaultBranch: z.string().optional().describe("New default branch"),
    archived: z.boolean().optional().describe("Archive or unarchive project"),
  },
  async ({ projectId, name, description, visibility, defaultBranch, archived }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const project = await client.put<Record<string, unknown>>(`/projects/${encodedId}`, {
        name,
        description,
        visibility,
        default_branch: defaultBranch,
        archived,
      });

      return { content: [{ type: "text", text: JSON.stringify(formatProject(project), null, 2) }] };
    } catch (error) {
      logger.error("Failed to update project", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating project: ${message}` }] };
    }
  }
);

/**
 * Delete a project.
 */
server.tool(
  "gitlab_delete_project",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
  },
  async ({ projectId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      await client.delete(`/projects/${encodedId}`);

      return { content: [{ type: "text", text: `Project ${projectId} deleted successfully` }] };
    } catch (error) {
      logger.error("Failed to delete project", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting project: ${message}` }] };
    }
  }
);

/**
 * Fork a project.
 */
server.tool(
  "gitlab_fork_project",
  {
    projectId: z.string().describe("Project ID or URL-encoded path to fork"),
    name: z.string().optional().describe("New project name (defaults to original)"),
    path: z.string().optional().describe("New project path (defaults to original)"),
    namespaceId: z.number().optional().describe("Namespace ID to fork into"),
  },
  async ({ projectId, name, path, namespaceId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const project = await client.post<Record<string, unknown>>(`/projects/${encodedId}/fork`, {
        name,
        path,
        namespace_id: namespaceId,
      });

      return { content: [{ type: "text", text: JSON.stringify(formatProject(project), null, 2) }] };
    } catch (error) {
      logger.error("Failed to fork project", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error forking project: ${message}` }] };
    }
  }
);

/**
 * Star a project.
 */
server.tool(
  "gitlab_star_project",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
  },
  async ({ projectId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const project = await client.post<Record<string, unknown>>(`/projects/${encodedId}/star`);

      return { content: [{ type: "text", text: JSON.stringify(formatProject(project), null, 2) }] };
    } catch (error) {
      logger.error("Failed to star project", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error starring project: ${message}` }] };
    }
  }
);

/**
 * Unstar a project.
 */
server.tool(
  "gitlab_unstar_project",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
  },
  async ({ projectId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const project = await client.post<Record<string, unknown>>(`/projects/${encodedId}/unstar`);

      return { content: [{ type: "text", text: JSON.stringify(formatProject(project), null, 2) }] };
    } catch (error) {
      logger.error("Failed to unstar project", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error unstarring project: ${message}` }] };
    }
  }
);

/**
 * List project members.
 */
server.tool(
  "gitlab_list_project_members",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    query: z.string().optional().describe("Search query for member name or username"),
    perPage: z.number().optional().describe("Number of results per page"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ projectId, query, perPage, page }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const members = await client.get<Array<Record<string, unknown>>>(`/projects/${encodedId}/members`, {
        query,
        per_page: perPage,
        page,
      });

      const result = members.map((member) => ({
        id: member.id,
        username: member.username,
        name: member.name,
        state: member.state,
        avatarUrl: member.avatar_url,
        webUrl: member.web_url,
        accessLevel: member.access_level,
        expiresAt: member.expires_at,
      }));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list project members", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing project members: ${message}` }] };
    }
  }
);

logger.info("GitLab project tools registered");

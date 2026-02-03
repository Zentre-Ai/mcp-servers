import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createGitLabClient, formatIssue, formatNote } from "../utils/gitlab-client.js";
import { logger } from "../utils/logger.js";

/**
 * List issues in a project.
 */
server.tool(
  "gitlab_list_issues",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    state: z.enum(["opened", "closed", "all"]).optional().describe("Filter by state"),
    labels: z.string().optional().describe("Comma-separated list of labels"),
    milestone: z.string().optional().describe("Milestone title"),
    assigneeId: z.number().optional().describe("Assignee user ID"),
    authorId: z.number().optional().describe("Author user ID"),
    search: z.string().optional().describe("Search in title and description"),
    orderBy: z.enum(["created_at", "updated_at"]).optional().describe("Order by field"),
    sort: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    perPage: z.number().optional().describe("Number of results per page"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ projectId, state, labels, milestone, assigneeId, authorId, search, orderBy, sort, perPage, page }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const issues = await client.get<Array<Record<string, unknown>>>(`/projects/${encodedId}/issues`, {
        state,
        labels,
        milestone,
        assignee_id: assigneeId,
        author_id: authorId,
        search,
        order_by: orderBy,
        sort,
        per_page: perPage,
        page,
      });

      const result = issues.map(formatIssue);

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list issues", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing issues: ${message}` }] };
    }
  }
);

/**
 * Get a single issue.
 */
server.tool(
  "gitlab_get_issue",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    issueIid: z.number().describe("Issue IID (internal ID within project)"),
  },
  async ({ projectId, issueIid }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const issue = await client.get<Record<string, unknown>>(`/projects/${encodedId}/issues/${issueIid}`);

      return { content: [{ type: "text", text: JSON.stringify(formatIssue(issue), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get issue", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting issue: ${message}` }] };
    }
  }
);

/**
 * Create a new issue.
 */
server.tool(
  "gitlab_create_issue",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    title: z.string().describe("Issue title"),
    description: z.string().optional().describe("Issue description (Markdown supported)"),
    labels: z.array(z.string()).optional().describe("Labels to apply"),
    assigneeIds: z.array(z.number()).optional().describe("Assignee user IDs"),
    milestoneId: z.number().optional().describe("Milestone ID"),
    dueDate: z.string().optional().describe("Due date (YYYY-MM-DD)"),
    confidential: z.boolean().optional().describe("Make issue confidential"),
    weight: z.number().optional().describe("Issue weight (GitLab Premium)"),
  },
  async ({ projectId, title, description, labels, assigneeIds, milestoneId, dueDate, confidential, weight }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const issue = await client.post<Record<string, unknown>>(`/projects/${encodedId}/issues`, {
        title,
        description,
        labels: labels?.join(","),
        assignee_ids: assigneeIds,
        milestone_id: milestoneId,
        due_date: dueDate,
        confidential,
        weight,
      });

      return { content: [{ type: "text", text: JSON.stringify(formatIssue(issue), null, 2) }] };
    } catch (error) {
      logger.error("Failed to create issue", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating issue: ${message}` }] };
    }
  }
);

/**
 * Update an issue.
 */
server.tool(
  "gitlab_update_issue",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    issueIid: z.number().describe("Issue IID"),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    labels: z.array(z.string()).optional().describe("New labels (replaces existing)"),
    assigneeIds: z.array(z.number()).optional().describe("New assignee IDs"),
    milestoneId: z.number().optional().describe("New milestone ID"),
    dueDate: z.string().optional().describe("New due date (YYYY-MM-DD)"),
    confidential: z.boolean().optional().describe("Update confidential status"),
    weight: z.number().optional().describe("Update weight"),
  },
  async ({ projectId, issueIid, title, description, labels, assigneeIds, milestoneId, dueDate, confidential, weight }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const issue = await client.put<Record<string, unknown>>(`/projects/${encodedId}/issues/${issueIid}`, {
        title,
        description,
        labels: labels?.join(","),
        assignee_ids: assigneeIds,
        milestone_id: milestoneId,
        due_date: dueDate,
        confidential,
        weight,
      });

      return { content: [{ type: "text", text: JSON.stringify(formatIssue(issue), null, 2) }] };
    } catch (error) {
      logger.error("Failed to update issue", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating issue: ${message}` }] };
    }
  }
);

/**
 * Close an issue.
 */
server.tool(
  "gitlab_close_issue",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    issueIid: z.number().describe("Issue IID"),
  },
  async ({ projectId, issueIid }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const issue = await client.put<Record<string, unknown>>(`/projects/${encodedId}/issues/${issueIid}`, {
        state_event: "close",
      });

      return { content: [{ type: "text", text: JSON.stringify(formatIssue(issue), null, 2) }] };
    } catch (error) {
      logger.error("Failed to close issue", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error closing issue: ${message}` }] };
    }
  }
);

/**
 * Reopen an issue.
 */
server.tool(
  "gitlab_reopen_issue",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    issueIid: z.number().describe("Issue IID"),
  },
  async ({ projectId, issueIid }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const issue = await client.put<Record<string, unknown>>(`/projects/${encodedId}/issues/${issueIid}`, {
        state_event: "reopen",
      });

      return { content: [{ type: "text", text: JSON.stringify(formatIssue(issue), null, 2) }] };
    } catch (error) {
      logger.error("Failed to reopen issue", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error reopening issue: ${message}` }] };
    }
  }
);

/**
 * Delete an issue.
 */
server.tool(
  "gitlab_delete_issue",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    issueIid: z.number().describe("Issue IID"),
  },
  async ({ projectId, issueIid }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      await client.delete(`/projects/${encodedId}/issues/${issueIid}`);

      return { content: [{ type: "text", text: `Issue #${issueIid} deleted successfully` }] };
    } catch (error) {
      logger.error("Failed to delete issue", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting issue: ${message}` }] };
    }
  }
);

/**
 * List issue notes (comments).
 */
server.tool(
  "gitlab_list_issue_notes",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    issueIid: z.number().describe("Issue IID"),
    sort: z.enum(["asc", "desc"]).optional().describe("Sort order"),
    orderBy: z.enum(["created_at", "updated_at"]).optional().describe("Order by field"),
    perPage: z.number().optional().describe("Number of results per page"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ projectId, issueIid, sort, orderBy, perPage, page }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const notes = await client.get<Array<Record<string, unknown>>>(
        `/projects/${encodedId}/issues/${issueIid}/notes`,
        {
          sort,
          order_by: orderBy,
          per_page: perPage,
          page,
        }
      );

      const result = notes.map(formatNote);

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list issue notes", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing issue notes: ${message}` }] };
    }
  }
);

/**
 * Create an issue note (comment).
 */
server.tool(
  "gitlab_create_issue_note",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    issueIid: z.number().describe("Issue IID"),
    body: z.string().describe("Note content (Markdown supported)"),
    confidential: z.boolean().optional().describe("Make note confidential"),
  },
  async ({ projectId, issueIid, body, confidential }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const note = await client.post<Record<string, unknown>>(
        `/projects/${encodedId}/issues/${issueIid}/notes`,
        {
          body,
          confidential,
        }
      );

      return { content: [{ type: "text", text: JSON.stringify(formatNote(note), null, 2) }] };
    } catch (error) {
      logger.error("Failed to create issue note", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating issue note: ${message}` }] };
    }
  }
);

logger.info("GitLab issue tools registered");

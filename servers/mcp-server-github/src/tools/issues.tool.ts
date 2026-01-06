import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createGitHubClient, formatIssue, formatComment } from "../utils/github-client.js";
import { logger } from "../utils/logger.js";

/**
 * List issues for a repository.
 */
server.tool(
  "github_list_issues",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    state: z.enum(["open", "closed", "all"]).optional().describe("Issue state filter"),
    labels: z.string().optional().describe("Comma-separated list of labels"),
    assignee: z.string().optional().describe("Filter by assignee username"),
    creator: z.string().optional().describe("Filter by creator username"),
    mentioned: z.string().optional().describe("Filter by mentioned username"),
    sort: z.enum(["created", "updated", "comments"]).optional().describe("Sort field"),
    direction: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    since: z.string().optional().describe("ISO 8601 timestamp"),
    perPage: z.number().optional().describe("Results per page (max 100)"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ owner, repo, state, labels, assignee, creator, mentioned, sort, direction, since, perPage, page }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.issues.listForRepo({
        owner,
        repo,
        state: state as "open" | "closed" | "all" | undefined,
        labels,
        assignee,
        creator,
        mentioned,
        sort: sort as "created" | "updated" | "comments" | undefined,
        direction: direction as "asc" | "desc" | undefined,
        since,
        per_page: perPage,
        page,
      });

      // Filter out pull requests (GitHub API returns PRs as issues)
      const issues = response.data.filter((i) => !i.pull_request);
      const result = issues.map((i) => formatIssue(i as unknown as Record<string, unknown>));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list issues", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing issues: ${message}` }] };
    }
  }
);

/**
 * Get a specific issue.
 */
server.tool(
  "github_get_issue",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    issueNumber: z.number().describe("Issue number"),
  },
  async ({ owner, repo, issueNumber }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatIssue(response.data as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
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
  "github_create_issue",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    title: z.string().describe("Issue title"),
    body: z.string().optional().describe("Issue body (markdown supported)"),
    assignees: z.array(z.string()).optional().describe("Array of usernames to assign"),
    labels: z.array(z.string()).optional().describe("Array of label names"),
    milestone: z.number().optional().describe("Milestone number"),
  },
  async ({ owner, repo, title, body, assignees, labels, milestone }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.issues.create({
        owner,
        repo,
        title,
        body,
        assignees,
        labels,
        milestone,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatIssue(response.data as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
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
  "github_update_issue",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    issueNumber: z.number().describe("Issue number"),
    title: z.string().optional().describe("New title"),
    body: z.string().optional().describe("New body"),
    state: z.enum(["open", "closed"]).optional().describe("Issue state"),
    stateReason: z.enum(["completed", "not_planned", "reopened"]).optional().describe("Reason for state change"),
    assignees: z.array(z.string()).optional().describe("Array of usernames"),
    labels: z.array(z.string()).optional().describe("Array of label names"),
    milestone: z.number().nullable().optional().describe("Milestone number (null to remove)"),
  },
  async ({ owner, repo, issueNumber, title, body, state, stateReason, assignees, labels, milestone }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        title,
        body,
        state: state as "open" | "closed" | undefined,
        state_reason: stateReason as "completed" | "not_planned" | "reopened" | undefined,
        assignees,
        labels,
        milestone: milestone ?? undefined,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatIssue(response.data as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update issue", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating issue: ${message}` }] };
    }
  }
);

/**
 * Add a comment to an issue.
 */
server.tool(
  "github_add_issue_comment",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    issueNumber: z.number().describe("Issue number"),
    body: z.string().describe("Comment body (markdown supported)"),
  },
  async ({ owner, repo, issueNumber, body }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatComment(response.data as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to add comment", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error adding comment: ${message}` }] };
    }
  }
);

/**
 * List comments on an issue.
 */
server.tool(
  "github_list_issue_comments",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    issueNumber: z.number().describe("Issue number"),
    since: z.string().optional().describe("ISO 8601 timestamp"),
    perPage: z.number().optional().describe("Results per page (max 100)"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ owner, repo, issueNumber, since, perPage, page }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber,
        since,
        per_page: perPage,
        page,
      });

      const result = response.data.map((c) => formatComment(c as unknown as Record<string, unknown>));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list comments", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing comments: ${message}` }] };
    }
  }
);

/**
 * Add labels to an issue.
 */
server.tool(
  "github_add_labels",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    issueNumber: z.number().describe("Issue number"),
    labels: z.array(z.string()).describe("Array of label names to add"),
  },
  async ({ owner, repo, issueNumber, labels }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels,
      });

      const result = response.data.map((l) => ({
        name: l.name,
        color: l.color,
        description: l.description,
      }));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to add labels", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error adding labels: ${message}` }] };
    }
  }
);

/**
 * Remove labels from an issue.
 */
server.tool(
  "github_remove_labels",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    issueNumber: z.number().describe("Issue number"),
    labels: z.array(z.string()).describe("Array of label names to remove"),
  },
  async ({ owner, repo, issueNumber, labels }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);

      // Remove each label individually
      const results = [];
      for (const label of labels) {
        try {
          await client.issues.removeLabel({
            owner,
            repo,
            issue_number: issueNumber,
            name: label,
          });
          results.push({ label, removed: true });
        } catch (err) {
          results.push({ label, removed: false, error: err instanceof Error ? err.message : "Unknown error" });
        }
      }

      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    } catch (error) {
      logger.error("Failed to remove labels", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error removing labels: ${message}` }] };
    }
  }
);

logger.info("GitHub issue tools registered");

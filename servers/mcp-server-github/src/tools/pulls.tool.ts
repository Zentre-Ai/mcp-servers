import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createGitHubClient, formatPullRequest, formatCommit, formatComment } from "../utils/github-client.js";
import { logger } from "../utils/logger.js";

/**
 * List pull requests for a repository.
 */
server.tool(
  "github_list_pulls",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    state: z.enum(["open", "closed", "all"]).optional().describe("PR state filter"),
    head: z.string().optional().describe("Filter by head branch (user:branch)"),
    base: z.string().optional().describe("Filter by base branch"),
    sort: z.enum(["created", "updated", "popularity", "long-running"]).optional().describe("Sort field"),
    direction: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    perPage: z.number().optional().describe("Results per page (max 100)"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ owner, repo, state, head, base, sort, direction, perPage, page }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.pulls.list({
        owner,
        repo,
        state: state as "open" | "closed" | "all" | undefined,
        head,
        base,
        sort: sort as "created" | "updated" | "popularity" | "long-running" | undefined,
        direction: direction as "asc" | "desc" | undefined,
        per_page: perPage,
        page,
      });

      const result = response.data.map((pr) => formatPullRequest(pr as unknown as Record<string, unknown>));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list pull requests", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing pull requests: ${message}` }] };
    }
  }
);

/**
 * Get a specific pull request.
 */
server.tool(
  "github_get_pull",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pullNumber: z.number().describe("Pull request number"),
  },
  async ({ owner, repo, pullNumber }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatPullRequest(response.data as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get pull request", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting pull request: ${message}` }] };
    }
  }
);

/**
 * Create a pull request.
 */
server.tool(
  "github_create_pull",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    title: z.string().describe("PR title"),
    head: z.string().describe("Branch containing changes (user:branch for cross-repo)"),
    base: z.string().describe("Branch to merge into"),
    body: z.string().optional().describe("PR description (markdown supported)"),
    draft: z.boolean().optional().describe("Create as draft PR"),
    maintainerCanModify: z.boolean().optional().describe("Allow maintainer edits"),
  },
  async ({ owner, repo, title, head, base, body, draft, maintainerCanModify }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.pulls.create({
        owner,
        repo,
        title,
        head,
        base,
        body,
        draft,
        maintainer_can_modify: maintainerCanModify,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatPullRequest(response.data as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create pull request", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating pull request: ${message}` }] };
    }
  }
);

/**
 * Update a pull request.
 */
server.tool(
  "github_update_pull",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pullNumber: z.number().describe("Pull request number"),
    title: z.string().optional().describe("New title"),
    body: z.string().optional().describe("New description"),
    state: z.enum(["open", "closed"]).optional().describe("PR state"),
    base: z.string().optional().describe("New base branch"),
    maintainerCanModify: z.boolean().optional().describe("Allow maintainer edits"),
  },
  async ({ owner, repo, pullNumber, title, body, state, base, maintainerCanModify }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.pulls.update({
        owner,
        repo,
        pull_number: pullNumber,
        title,
        body,
        state: state as "open" | "closed" | undefined,
        base,
        maintainer_can_modify: maintainerCanModify,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatPullRequest(response.data as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update pull request", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating pull request: ${message}` }] };
    }
  }
);

/**
 * Merge a pull request.
 */
server.tool(
  "github_merge_pull",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pullNumber: z.number().describe("Pull request number"),
    commitTitle: z.string().optional().describe("Merge commit title"),
    commitMessage: z.string().optional().describe("Merge commit message"),
    mergeMethod: z.enum(["merge", "squash", "rebase"]).optional().describe("Merge method"),
    sha: z.string().optional().describe("SHA that head must match to merge"),
  },
  async ({ owner, repo, pullNumber, commitTitle, commitMessage, mergeMethod, sha }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.pulls.merge({
        owner,
        repo,
        pull_number: pullNumber,
        commit_title: commitTitle,
        commit_message: commitMessage,
        merge_method: mergeMethod as "merge" | "squash" | "rebase" | undefined,
        sha,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                merged: response.data.merged,
                message: response.data.message,
                sha: response.data.sha,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to merge pull request", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error merging pull request: ${message}` }] };
    }
  }
);

/**
 * List commits in a pull request.
 */
server.tool(
  "github_list_pull_commits",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pullNumber: z.number().describe("Pull request number"),
    perPage: z.number().optional().describe("Results per page (max 100)"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ owner, repo, pullNumber, perPage, page }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.pulls.listCommits({
        owner,
        repo,
        pull_number: pullNumber,
        per_page: perPage,
        page,
      });

      const result = response.data.map((c) => formatCommit(c as unknown as Record<string, unknown>));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list PR commits", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing PR commits: ${message}` }] };
    }
  }
);

/**
 * List files changed in a pull request.
 */
server.tool(
  "github_list_pull_files",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pullNumber: z.number().describe("Pull request number"),
    perPage: z.number().optional().describe("Results per page (max 100)"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ owner, repo, pullNumber, perPage, page }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber,
        per_page: perPage,
        page,
      });

      const result = response.data.map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch,
        blobUrl: f.blob_url,
        rawUrl: f.raw_url,
      }));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list PR files", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing PR files: ${message}` }] };
    }
  }
);

/**
 * Create a review on a pull request.
 */
server.tool(
  "github_create_review",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pullNumber: z.number().describe("Pull request number"),
    body: z.string().optional().describe("Review comment body"),
    event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]).describe("Review action"),
    commitId: z.string().optional().describe("SHA of commit to review"),
  },
  async ({ owner, repo, pullNumber, body, event, commitId }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        body,
        event: event as "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
        commit_id: commitId,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: response.data.id,
                state: response.data.state,
                body: response.data.body,
                user: response.data.user
                  ? {
                      login: response.data.user.login,
                      id: response.data.user.id,
                    }
                  : null,
                submittedAt: response.data.submitted_at,
                commitId: response.data.commit_id,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create review", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating review: ${message}` }] };
    }
  }
);

/**
 * Add a comment to a pull request.
 */
server.tool(
  "github_add_pull_comment",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pullNumber: z.number().describe("Pull request number"),
    body: z.string().describe("Comment body (markdown supported)"),
  },
  async ({ owner, repo, pullNumber, body }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      // Pull request comments use the issues API
      const response = await client.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
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
      logger.error("Failed to add PR comment", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error adding PR comment: ${message}` }] };
    }
  }
);

logger.info("GitHub pull request tools registered");

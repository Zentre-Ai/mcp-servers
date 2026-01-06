import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createGitHubClient, formatBranch } from "../utils/github-client.js";
import { logger } from "../utils/logger.js";

/**
 * List branches in a repository.
 */
server.tool(
  "github_list_branches",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    protected: z.boolean().optional().describe("Filter by protection status"),
    perPage: z.number().optional().describe("Results per page (max 100)"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ owner, repo, protected: isProtected, perPage, page }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.repos.listBranches({
        owner,
        repo,
        protected: isProtected,
        per_page: perPage,
        page,
      });

      const result = response.data.map((b) => formatBranch(b as unknown as Record<string, unknown>));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list branches", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing branches: ${message}` }] };
    }
  }
);

/**
 * Get a specific branch.
 */
server.tool(
  "github_get_branch",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    branch: z.string().describe("Branch name"),
  },
  async ({ owner, repo, branch }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.repos.getBranch({
        owner,
        repo,
        branch,
      });

      const result = {
        name: response.data.name,
        protected: response.data.protected,
        commit: {
          sha: response.data.commit.sha,
          url: response.data.commit.url,
        },
        protection: response.data.protection
          ? {
              enabled: response.data.protection.enabled,
              requiredStatusChecks: response.data.protection.required_status_checks,
            }
          : null,
        protectionUrl: response.data.protection_url,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to get branch", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting branch: ${message}` }] };
    }
  }
);

/**
 * Create a new branch.
 */
server.tool(
  "github_create_branch",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    branch: z.string().describe("New branch name"),
    fromBranch: z.string().optional().describe("Source branch (defaults to default branch)"),
    fromSha: z.string().optional().describe("Source SHA (alternative to fromBranch)"),
  },
  async ({ owner, repo, branch, fromBranch, fromSha }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);

      // Get the SHA to branch from
      let sha = fromSha;
      if (!sha) {
        if (fromBranch) {
          const branchResponse = await client.repos.getBranch({
            owner,
            repo,
            branch: fromBranch,
          });
          sha = branchResponse.data.commit.sha;
        } else {
          // Get default branch
          const repoResponse = await client.repos.get({ owner, repo });
          const defaultBranch = repoResponse.data.default_branch;
          const branchResponse = await client.repos.getBranch({
            owner,
            repo,
            branch: defaultBranch,
          });
          sha = branchResponse.data.commit.sha;
        }
      }

      // Create the branch reference
      const response = await client.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ref: response.data.ref,
                sha: response.data.object.sha,
                url: response.data.url,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create branch", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating branch: ${message}` }] };
    }
  }
);

/**
 * Delete a branch.
 */
server.tool(
  "github_delete_branch",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    branch: z.string().describe("Branch name to delete"),
  },
  async ({ owner, repo, branch }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      await client.git.deleteRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Branch '${branch}' deleted` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete branch", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting branch: ${message}` }] };
    }
  }
);

/**
 * Merge branches.
 */
server.tool(
  "github_merge_branches",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    base: z.string().describe("Base branch to merge into"),
    head: z.string().describe("Head branch to merge from"),
    commitMessage: z.string().optional().describe("Merge commit message"),
  },
  async ({ owner, repo, base, head, commitMessage }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.repos.merge({
        owner,
        repo,
        base,
        head,
        commit_message: commitMessage,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                sha: response.data.sha,
                message: response.data.commit?.message,
                url: response.data.html_url,
                merged: true,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to merge branches", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error merging branches: ${message}` }] };
    }
  }
);

logger.info("GitHub branch tools registered");

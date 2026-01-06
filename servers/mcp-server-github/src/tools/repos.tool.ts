import { z } from "zod";
import { server, getCurrentToken } from "../server.js";
import { createGitHubClient, formatRepo, formatCommit } from "../utils/github-client.js";
import { logger } from "../utils/logger.js";

/**
 * List repositories for authenticated user or organization.
 */
server.tool(
  "github_list_repos",
  {
    type: z
      .enum(["all", "owner", "public", "private", "member"])
      .optional()
      .describe("Type of repositories to list"),
    org: z.string().optional().describe("Organization name (if listing org repos)"),
    sort: z
      .enum(["created", "updated", "pushed", "full_name"])
      .optional()
      .describe("Sort field"),
    direction: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    perPage: z.number().optional().describe("Results per page (max 100)"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ type, org, sort, direction, perPage, page }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);

      let repos;
      if (org) {
        const response = await client.repos.listForOrg({
          org,
          type: type as "all" | "public" | "private" | "forks" | "sources" | "member" | undefined,
          sort: sort as "created" | "updated" | "pushed" | "full_name" | undefined,
          direction: direction as "asc" | "desc" | undefined,
          per_page: perPage,
          page,
        });
        repos = response.data;
      } else {
        const response = await client.repos.listForAuthenticatedUser({
          type: type as "all" | "owner" | "public" | "private" | "member" | undefined,
          sort: sort as "created" | "updated" | "pushed" | "full_name" | undefined,
          direction: direction as "asc" | "desc" | undefined,
          per_page: perPage,
          page,
        });
        repos = response.data;
      }

      const result = repos.map((r) => formatRepo(r as unknown as Record<string, unknown>));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list repositories", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing repositories: ${message}` }] };
    }
  }
);

/**
 * Get a repository by owner and name.
 */
server.tool(
  "github_get_repo",
  {
    owner: z.string().describe("Repository owner (username or org)"),
    repo: z.string().describe("Repository name"),
  },
  async ({ owner, repo }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.repos.get({ owner, repo });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatRepo(response.data as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get repository", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting repository: ${message}` }] };
    }
  }
);

/**
 * Create a new repository.
 */
server.tool(
  "github_create_repo",
  {
    name: z.string().describe("Repository name"),
    description: z.string().optional().describe("Repository description"),
    private: z.boolean().optional().describe("Whether repository is private"),
    autoInit: z.boolean().optional().describe("Initialize with README"),
    gitignoreTemplate: z.string().optional().describe("Gitignore template name"),
    licenseTemplate: z.string().optional().describe("License template (e.g., 'mit')"),
    org: z.string().optional().describe("Organization to create repo in"),
  },
  async ({ name, description, private: isPrivate, autoInit, gitignoreTemplate, licenseTemplate, org }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);

      let response;
      if (org) {
        response = await client.repos.createInOrg({
          org,
          name,
          description,
          private: isPrivate,
          auto_init: autoInit,
          gitignore_template: gitignoreTemplate,
          license_template: licenseTemplate,
        });
      } else {
        response = await client.repos.createForAuthenticatedUser({
          name,
          description,
          private: isPrivate,
          auto_init: autoInit,
          gitignore_template: gitignoreTemplate,
          license_template: licenseTemplate,
        });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatRepo(response.data as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create repository", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating repository: ${message}` }] };
    }
  }
);

/**
 * Update a repository.
 */
server.tool(
  "github_update_repo",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    name: z.string().optional().describe("New repository name"),
    description: z.string().optional().describe("New description"),
    private: z.boolean().optional().describe("Set private status"),
    defaultBranch: z.string().optional().describe("Default branch name"),
    hasIssues: z.boolean().optional().describe("Enable issues"),
    hasProjects: z.boolean().optional().describe("Enable projects"),
    hasWiki: z.boolean().optional().describe("Enable wiki"),
    archived: z.boolean().optional().describe("Archive the repository"),
  },
  async ({ owner, repo, name, description, private: isPrivate, defaultBranch, hasIssues, hasProjects, hasWiki, archived }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.repos.update({
        owner,
        repo,
        name,
        description,
        private: isPrivate,
        default_branch: defaultBranch,
        has_issues: hasIssues,
        has_projects: hasProjects,
        has_wiki: hasWiki,
        archived,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatRepo(response.data as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update repository", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating repository: ${message}` }] };
    }
  }
);

/**
 * Delete a repository.
 */
server.tool(
  "github_delete_repo",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
  },
  async ({ owner, repo }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      await client.repos.delete({ owner, repo });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: `Repository ${owner}/${repo} deleted` }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete repository", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting repository: ${message}` }] };
    }
  }
);

/**
 * Fork a repository.
 */
server.tool(
  "github_fork_repo",
  {
    owner: z.string().describe("Repository owner to fork from"),
    repo: z.string().describe("Repository name to fork"),
    organization: z.string().optional().describe("Organization to fork into"),
    name: z.string().optional().describe("New name for the fork"),
    defaultBranchOnly: z.boolean().optional().describe("Fork only the default branch"),
  },
  async ({ owner, repo, organization, name, defaultBranchOnly }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.repos.createFork({
        owner,
        repo,
        organization,
        name,
        default_branch_only: defaultBranchOnly,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatRepo(response.data as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to fork repository", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error forking repository: ${message}` }] };
    }
  }
);

/**
 * List commits in a repository.
 */
server.tool(
  "github_list_commits",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    sha: z.string().optional().describe("SHA or branch to start from"),
    path: z.string().optional().describe("Only commits containing this file path"),
    author: z.string().optional().describe("GitHub username or email"),
    since: z.string().optional().describe("ISO 8601 timestamp"),
    until: z.string().optional().describe("ISO 8601 timestamp"),
    perPage: z.number().optional().describe("Results per page (max 100)"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ owner, repo, sha, path, author, since, until, perPage, page }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.repos.listCommits({
        owner,
        repo,
        sha,
        path,
        author,
        since,
        until,
        per_page: perPage,
        page,
      });

      const result = response.data.map((c) => formatCommit(c as unknown as Record<string, unknown>));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list commits", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing commits: ${message}` }] };
    }
  }
);

/**
 * Get a specific commit.
 */
server.tool(
  "github_get_commit",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    ref: z.string().describe("Commit SHA, branch name, or tag"),
  },
  async ({ owner, repo, ref }) => {
    const token = getCurrentToken();
    if (!token) {
      return { content: [{ type: "text", text: "Error: No GitHub token available" }] };
    }

    try {
      const client = createGitHubClient(token);
      const response = await client.repos.getCommit({
        owner,
        repo,
        ref,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatCommit(response.data as unknown as Record<string, unknown>), null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get commit", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting commit: ${message}` }] };
    }
  }
);

logger.info("GitHub repository tools registered");

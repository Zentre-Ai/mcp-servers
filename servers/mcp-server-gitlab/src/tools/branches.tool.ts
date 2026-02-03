import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createGitLabClient, formatBranch, formatCommit } from "../utils/gitlab-client.js";
import { logger } from "../utils/logger.js";

/**
 * List branches in a project.
 */
server.tool(
  "gitlab_list_branches",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    search: z.string().optional().describe("Search for branches by name"),
    perPage: z.number().optional().describe("Number of results per page"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ projectId, search, perPage, page }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const branches = await client.get<Array<Record<string, unknown>>>(`/projects/${encodedId}/repository/branches`, {
        search,
        per_page: perPage,
        page,
      });

      const result = branches.map(formatBranch);

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list branches", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing branches: ${message}` }] };
    }
  }
);

/**
 * Get a single branch.
 */
server.tool(
  "gitlab_get_branch",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    branchName: z.string().describe("Branch name"),
  },
  async ({ projectId, branchName }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const encodedBranch = encodeURIComponent(branchName);
      const branch = await client.get<Record<string, unknown>>(`/projects/${encodedId}/repository/branches/${encodedBranch}`);

      return { content: [{ type: "text", text: JSON.stringify(formatBranch(branch), null, 2) }] };
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
  "gitlab_create_branch",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    branchName: z.string().describe("New branch name"),
    ref: z.string().describe("Branch, tag, or commit SHA to create branch from"),
  },
  async ({ projectId, branchName, ref }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const branch = await client.post<Record<string, unknown>>(`/projects/${encodedId}/repository/branches`, {
        branch: branchName,
        ref,
      });

      return { content: [{ type: "text", text: JSON.stringify(formatBranch(branch), null, 2) }] };
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
  "gitlab_delete_branch",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    branchName: z.string().describe("Branch name to delete"),
  },
  async ({ projectId, branchName }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const encodedBranch = encodeURIComponent(branchName);
      await client.delete(`/projects/${encodedId}/repository/branches/${encodedBranch}`);

      return { content: [{ type: "text", text: `Branch '${branchName}' deleted successfully` }] };
    } catch (error) {
      logger.error("Failed to delete branch", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting branch: ${message}` }] };
    }
  }
);

/**
 * Protect a branch.
 */
server.tool(
  "gitlab_protect_branch",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    branchName: z.string().describe("Branch name to protect (supports wildcards like 'release-*')"),
    pushAccessLevel: z
      .number()
      .optional()
      .describe("Access level for push (0=No access, 30=Developer, 40=Maintainer, 60=Admin)"),
    mergeAccessLevel: z
      .number()
      .optional()
      .describe("Access level for merge (0=No access, 30=Developer, 40=Maintainer, 60=Admin)"),
    allowForcePush: z.boolean().optional().describe("Allow force push"),
  },
  async ({ projectId, branchName, pushAccessLevel, mergeAccessLevel, allowForcePush }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const protectedBranch = await client.post<Record<string, unknown>>(`/projects/${encodedId}/protected_branches`, {
        name: branchName,
        push_access_level: pushAccessLevel,
        merge_access_level: mergeAccessLevel,
        allow_force_push: allowForcePush,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                name: protectedBranch.name,
                pushAccessLevels: protectedBranch.push_access_levels,
                mergeAccessLevels: protectedBranch.merge_access_levels,
                allowForcePush: protectedBranch.allow_force_push,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to protect branch", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error protecting branch: ${message}` }] };
    }
  }
);

/**
 * Unprotect a branch.
 */
server.tool(
  "gitlab_unprotect_branch",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    branchName: z.string().describe("Branch name to unprotect"),
  },
  async ({ projectId, branchName }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const encodedBranch = encodeURIComponent(branchName);
      await client.delete(`/projects/${encodedId}/protected_branches/${encodedBranch}`);

      return { content: [{ type: "text", text: `Branch '${branchName}' unprotected successfully` }] };
    } catch (error) {
      logger.error("Failed to unprotect branch", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error unprotecting branch: ${message}` }] };
    }
  }
);

/**
 * List commits in a project.
 */
server.tool(
  "gitlab_list_commits",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    refName: z.string().optional().describe("Branch, tag, or commit SHA"),
    since: z.string().optional().describe("Only commits after this date (ISO 8601)"),
    until: z.string().optional().describe("Only commits before this date (ISO 8601)"),
    path: z.string().optional().describe("File path to filter commits"),
    author: z.string().optional().describe("Filter by author email"),
    perPage: z.number().optional().describe("Number of results per page"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ projectId, refName, since, until, path, author, perPage, page }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const commits = await client.get<Array<Record<string, unknown>>>(`/projects/${encodedId}/repository/commits`, {
        ref_name: refName,
        since,
        until,
        path,
        author,
        per_page: perPage,
        page,
      });

      const result = commits.map(formatCommit);

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list commits", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing commits: ${message}` }] };
    }
  }
);

/**
 * Get a single commit.
 */
server.tool(
  "gitlab_get_commit",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    sha: z.string().describe("Commit SHA"),
    stats: z.boolean().optional().describe("Include commit stats"),
  },
  async ({ projectId, sha, stats }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const commit = await client.get<Record<string, unknown>>(`/projects/${encodedId}/repository/commits/${sha}`, {
        stats,
      });

      return { content: [{ type: "text", text: JSON.stringify(formatCommit(commit), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get commit", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting commit: ${message}` }] };
    }
  }
);

/**
 * Get commit diff.
 */
server.tool(
  "gitlab_get_commit_diff",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    sha: z.string().describe("Commit SHA"),
    perPage: z.number().optional().describe("Number of results per page"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ projectId, sha, perPage, page }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const diffs = await client.get<Array<Record<string, unknown>>>(
        `/projects/${encodedId}/repository/commits/${sha}/diff`,
        { per_page: perPage, page }
      );

      const result = diffs.map((diff) => ({
        oldPath: diff.old_path,
        newPath: diff.new_path,
        aMode: diff.a_mode,
        bMode: diff.b_mode,
        newFile: diff.new_file,
        renamedFile: diff.renamed_file,
        deletedFile: diff.deleted_file,
        diff: diff.diff,
      }));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to get commit diff", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting commit diff: ${message}` }] };
    }
  }
);

logger.info("GitLab branch tools registered");

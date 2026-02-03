import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createGitLabClient, formatMergeRequest, formatNote, formatCommit } from "../utils/gitlab-client.js";
import { logger } from "../utils/logger.js";

/**
 * List merge requests in a project.
 */
server.tool(
  "gitlab_list_merge_requests",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    state: z.enum(["opened", "closed", "merged", "all"]).optional().describe("Filter by state"),
    labels: z.string().optional().describe("Comma-separated list of labels"),
    milestone: z.string().optional().describe("Milestone title"),
    sourceBranch: z.string().optional().describe("Filter by source branch"),
    targetBranch: z.string().optional().describe("Filter by target branch"),
    authorId: z.number().optional().describe("Author user ID"),
    assigneeId: z.number().optional().describe("Assignee user ID"),
    reviewerId: z.number().optional().describe("Reviewer user ID"),
    search: z.string().optional().describe("Search in title and description"),
    orderBy: z.enum(["created_at", "updated_at"]).optional().describe("Order by field"),
    sort: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    perPage: z.number().optional().describe("Number of results per page"),
    page: z.number().optional().describe("Page number"),
  },
  async ({
    projectId,
    state,
    labels,
    milestone,
    sourceBranch,
    targetBranch,
    authorId,
    assigneeId,
    reviewerId,
    search,
    orderBy,
    sort,
    perPage,
    page,
  }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const mrs = await client.get<Array<Record<string, unknown>>>(`/projects/${encodedId}/merge_requests`, {
        state,
        labels,
        milestone,
        source_branch: sourceBranch,
        target_branch: targetBranch,
        author_id: authorId,
        assignee_id: assigneeId,
        reviewer_id: reviewerId,
        search,
        order_by: orderBy,
        sort,
        per_page: perPage,
        page,
      });

      const result = mrs.map(formatMergeRequest);

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list merge requests", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing merge requests: ${message}` }] };
    }
  }
);

/**
 * Get a single merge request.
 */
server.tool(
  "gitlab_get_merge_request",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    mergeRequestIid: z.number().describe("Merge request IID"),
  },
  async ({ projectId, mergeRequestIid }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const mr = await client.get<Record<string, unknown>>(`/projects/${encodedId}/merge_requests/${mergeRequestIid}`);

      return { content: [{ type: "text", text: JSON.stringify(formatMergeRequest(mr), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get merge request", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting merge request: ${message}` }] };
    }
  }
);

/**
 * Create a merge request.
 */
server.tool(
  "gitlab_create_merge_request",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    sourceBranch: z.string().describe("Source branch name"),
    targetBranch: z.string().describe("Target branch name"),
    title: z.string().describe("Merge request title"),
    description: z.string().optional().describe("Description (Markdown supported)"),
    assigneeId: z.number().optional().describe("Assignee user ID"),
    assigneeIds: z.array(z.number()).optional().describe("Assignee user IDs"),
    reviewerIds: z.array(z.number()).optional().describe("Reviewer user IDs"),
    labels: z.array(z.string()).optional().describe("Labels to apply"),
    milestoneId: z.number().optional().describe("Milestone ID"),
    removeSourceBranch: z.boolean().optional().describe("Remove source branch after merge"),
    squash: z.boolean().optional().describe("Squash commits on merge"),
    draft: z.boolean().optional().describe("Create as draft MR"),
  },
  async ({
    projectId,
    sourceBranch,
    targetBranch,
    title,
    description,
    assigneeId,
    assigneeIds,
    reviewerIds,
    labels,
    milestoneId,
    removeSourceBranch,
    squash,
    draft,
  }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const mr = await client.post<Record<string, unknown>>(`/projects/${encodedId}/merge_requests`, {
        source_branch: sourceBranch,
        target_branch: targetBranch,
        title: draft ? `Draft: ${title}` : title,
        description,
        assignee_id: assigneeId,
        assignee_ids: assigneeIds,
        reviewer_ids: reviewerIds,
        labels: labels?.join(","),
        milestone_id: milestoneId,
        remove_source_branch: removeSourceBranch,
        squash,
      });

      return { content: [{ type: "text", text: JSON.stringify(formatMergeRequest(mr), null, 2) }] };
    } catch (error) {
      logger.error("Failed to create merge request", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating merge request: ${message}` }] };
    }
  }
);

/**
 * Update a merge request.
 */
server.tool(
  "gitlab_update_merge_request",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    mergeRequestIid: z.number().describe("Merge request IID"),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    targetBranch: z.string().optional().describe("New target branch"),
    assigneeId: z.number().optional().describe("New assignee user ID"),
    assigneeIds: z.array(z.number()).optional().describe("New assignee user IDs"),
    reviewerIds: z.array(z.number()).optional().describe("New reviewer user IDs"),
    labels: z.array(z.string()).optional().describe("New labels"),
    milestoneId: z.number().optional().describe("New milestone ID"),
    removeSourceBranch: z.boolean().optional().describe("Remove source branch after merge"),
    squash: z.boolean().optional().describe("Squash commits on merge"),
  },
  async ({
    projectId,
    mergeRequestIid,
    title,
    description,
    targetBranch,
    assigneeId,
    assigneeIds,
    reviewerIds,
    labels,
    milestoneId,
    removeSourceBranch,
    squash,
  }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const mr = await client.put<Record<string, unknown>>(`/projects/${encodedId}/merge_requests/${mergeRequestIid}`, {
        title,
        description,
        target_branch: targetBranch,
        assignee_id: assigneeId,
        assignee_ids: assigneeIds,
        reviewer_ids: reviewerIds,
        labels: labels?.join(","),
        milestone_id: milestoneId,
        remove_source_branch: removeSourceBranch,
        squash,
      });

      return { content: [{ type: "text", text: JSON.stringify(formatMergeRequest(mr), null, 2) }] };
    } catch (error) {
      logger.error("Failed to update merge request", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating merge request: ${message}` }] };
    }
  }
);

/**
 * Merge a merge request.
 */
server.tool(
  "gitlab_merge_merge_request",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    mergeRequestIid: z.number().describe("Merge request IID"),
    mergeCommitMessage: z.string().optional().describe("Custom merge commit message"),
    squashCommitMessage: z.string().optional().describe("Custom squash commit message"),
    squash: z.boolean().optional().describe("Squash commits"),
    shouldRemoveSourceBranch: z.boolean().optional().describe("Remove source branch after merge"),
    mergeWhenPipelineSucceeds: z.boolean().optional().describe("Merge when pipeline succeeds"),
  },
  async ({
    projectId,
    mergeRequestIid,
    mergeCommitMessage,
    squashCommitMessage,
    squash,
    shouldRemoveSourceBranch,
    mergeWhenPipelineSucceeds,
  }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const mr = await client.put<Record<string, unknown>>(
        `/projects/${encodedId}/merge_requests/${mergeRequestIid}/merge`,
        {
          merge_commit_message: mergeCommitMessage,
          squash_commit_message: squashCommitMessage,
          squash,
          should_remove_source_branch: shouldRemoveSourceBranch,
          merge_when_pipeline_succeeds: mergeWhenPipelineSucceeds,
        }
      );

      return { content: [{ type: "text", text: JSON.stringify(formatMergeRequest(mr), null, 2) }] };
    } catch (error) {
      logger.error("Failed to merge merge request", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error merging merge request: ${message}` }] };
    }
  }
);

/**
 * Approve a merge request.
 */
server.tool(
  "gitlab_approve_merge_request",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    mergeRequestIid: z.number().describe("Merge request IID"),
  },
  async ({ projectId, mergeRequestIid }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      await client.post(`/projects/${encodedId}/merge_requests/${mergeRequestIid}/approve`);

      return { content: [{ type: "text", text: `Merge request !${mergeRequestIid} approved successfully` }] };
    } catch (error) {
      logger.error("Failed to approve merge request", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error approving merge request: ${message}` }] };
    }
  }
);

/**
 * Unapprove a merge request.
 */
server.tool(
  "gitlab_unapprove_merge_request",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    mergeRequestIid: z.number().describe("Merge request IID"),
  },
  async ({ projectId, mergeRequestIid }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      await client.post(`/projects/${encodedId}/merge_requests/${mergeRequestIid}/unapprove`);

      return { content: [{ type: "text", text: `Merge request !${mergeRequestIid} unapproved successfully` }] };
    } catch (error) {
      logger.error("Failed to unapprove merge request", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error unapproving merge request: ${message}` }] };
    }
  }
);

/**
 * List merge request commits.
 */
server.tool(
  "gitlab_list_mr_commits",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    mergeRequestIid: z.number().describe("Merge request IID"),
    perPage: z.number().optional().describe("Number of results per page"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ projectId, mergeRequestIid, perPage, page }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const commits = await client.get<Array<Record<string, unknown>>>(
        `/projects/${encodedId}/merge_requests/${mergeRequestIid}/commits`,
        { per_page: perPage, page }
      );

      const result = commits.map(formatCommit);

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list merge request commits", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing merge request commits: ${message}` }] };
    }
  }
);

/**
 * List merge request changes (diff).
 */
server.tool(
  "gitlab_list_mr_changes",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    mergeRequestIid: z.number().describe("Merge request IID"),
  },
  async ({ projectId, mergeRequestIid }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const mr = await client.get<Record<string, unknown>>(
        `/projects/${encodedId}/merge_requests/${mergeRequestIid}/changes`
      );

      const changes = (mr.changes || []) as Array<Record<string, unknown>>;
      const result = {
        mergeRequest: formatMergeRequest(mr),
        changes: changes.map((change) => ({
          oldPath: change.old_path,
          newPath: change.new_path,
          aMode: change.a_mode,
          bMode: change.b_mode,
          newFile: change.new_file,
          renamedFile: change.renamed_file,
          deletedFile: change.deleted_file,
          diff: change.diff,
        })),
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list merge request changes", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing merge request changes: ${message}` }] };
    }
  }
);

/**
 * List merge request notes (comments).
 */
server.tool(
  "gitlab_list_mr_notes",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    mergeRequestIid: z.number().describe("Merge request IID"),
    sort: z.enum(["asc", "desc"]).optional().describe("Sort order"),
    orderBy: z.enum(["created_at", "updated_at"]).optional().describe("Order by field"),
    perPage: z.number().optional().describe("Number of results per page"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ projectId, mergeRequestIid, sort, orderBy, perPage, page }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const notes = await client.get<Array<Record<string, unknown>>>(
        `/projects/${encodedId}/merge_requests/${mergeRequestIid}/notes`,
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
      logger.error("Failed to list merge request notes", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing merge request notes: ${message}` }] };
    }
  }
);

/**
 * Create a merge request note (comment).
 */
server.tool(
  "gitlab_create_mr_note",
  {
    projectId: z.string().describe("Project ID or URL-encoded path"),
    mergeRequestIid: z.number().describe("Merge request IID"),
    body: z.string().describe("Note content (Markdown supported)"),
  },
  async ({ projectId, mergeRequestIid, body }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No GitLab credentials available" }] };
    }

    try {
      const client = createGitLabClient(auth);
      const encodedId = encodeURIComponent(projectId);
      const note = await client.post<Record<string, unknown>>(
        `/projects/${encodedId}/merge_requests/${mergeRequestIid}/notes`,
        { body }
      );

      return { content: [{ type: "text", text: JSON.stringify(formatNote(note), null, 2) }] };
    } catch (error) {
      logger.error("Failed to create merge request note", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating merge request note: ${message}` }] };
    }
  }
);

logger.info("GitLab merge request tools registered");

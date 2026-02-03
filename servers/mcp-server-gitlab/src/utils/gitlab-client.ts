import { logger } from "./logger.js";
import { config } from "../config.js";

/**
 * GitLab authentication configuration.
 */
export interface GitLabAuth {
  accessToken: string;
  host: string;
}

/**
 * GitLab API client for making REST API requests.
 */
export class GitLabClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(auth: GitLabAuth) {
    this.baseUrl = `https://${auth.host}/api/v4`;
    this.accessToken = auth.accessToken;
  }

  /**
   * Make a request to the GitLab API.
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | string[] | undefined>
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;

    // Add query parameters
    if (queryParams) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            // Handle array parameters (e.g., labels[])
            for (const v of value) {
              params.append(`${key}[]`, String(v));
            }
          } else {
            params.append(key, String(value));
          }
        }
      }
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/json",
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    logger.debug(`GitLab API: ${method} ${url}`);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `GitLab API error: ${response.status} ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.message) {
          errorMessage = errorJson.message;
        } else if (errorJson.error) {
          errorMessage = errorJson.error;
        } else if (errorJson.error_description) {
          errorMessage = errorJson.error_description;
        }
      } catch {
        if (errorBody) {
          errorMessage = errorBody;
        }
      }
      throw new Error(errorMessage);
    }

    // Handle empty responses (e.g., 204 No Content)
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  // Convenience methods
  async get<T>(
    path: string,
    queryParams?: Record<string, string | number | boolean | string[] | undefined>
  ): Promise<T> {
    return this.request<T>("GET", path, undefined, queryParams);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}

/**
 * Extract GitLab credentials from request headers.
 * Expects:
 *   - Authorization: Bearer <accessToken>
 *   - x-gitlab-host: <host> (optional, defaults to gitlab.com)
 */
export function extractGitLabAuth(
  headers: Record<string, string | string[] | undefined>
): GitLabAuth | null {
  // Extract bearer token
  const authHeader = headers["authorization"];
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    return null;
  }
  const accessToken = bearerMatch[1];

  // Extract host from header or use default
  const hostHeader = headers["x-gitlab-host"];
  const host =
    typeof hostHeader === "string" ? hostHeader : config.GITLAB_DEFAULT_HOST;

  return { accessToken, host };
}

/**
 * Create a GitLab client from authentication config.
 */
export function createGitLabClient(auth: GitLabAuth): GitLabClient {
  return new GitLabClient(auth);
}

// ============================================================
// Formatters
// ============================================================

/**
 * Format user for response.
 */
export function formatUser(user: Record<string, unknown>): Record<string, unknown> {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    state: user.state,
    avatarUrl: user.avatar_url,
    webUrl: user.web_url,
    createdAt: user.created_at,
    isAdmin: user.is_admin,
    bio: user.bio,
    location: user.location,
    publicEmail: user.public_email,
    organization: user.organization,
  };
}

/**
 * Format project for response.
 */
export function formatProject(project: Record<string, unknown>): Record<string, unknown> {
  const namespace = project.namespace as Record<string, unknown> | undefined;
  const owner = project.owner as Record<string, unknown> | undefined;

  return {
    id: project.id,
    name: project.name,
    path: project.path,
    pathWithNamespace: project.path_with_namespace,
    description: project.description,
    visibility: project.visibility,
    defaultBranch: project.default_branch,
    webUrl: project.web_url,
    sshUrlToRepo: project.ssh_url_to_repo,
    httpUrlToRepo: project.http_url_to_repo,
    namespace: namespace
      ? {
          id: namespace.id,
          name: namespace.name,
          path: namespace.path,
          kind: namespace.kind,
          fullPath: namespace.full_path,
        }
      : undefined,
    owner: owner
      ? {
          id: owner.id,
          username: owner.username,
          name: owner.name,
        }
      : undefined,
    createdAt: project.created_at,
    lastActivityAt: project.last_activity_at,
    starCount: project.star_count,
    forksCount: project.forks_count,
    openIssuesCount: project.open_issues_count,
    archived: project.archived,
    topics: project.topics,
  };
}

/**
 * Format issue for response.
 */
export function formatIssue(issue: Record<string, unknown>): Record<string, unknown> {
  const author = issue.author as Record<string, unknown> | undefined;
  const assignee = issue.assignee as Record<string, unknown> | undefined;
  const assignees = issue.assignees as Array<Record<string, unknown>> | undefined;
  const milestone = issue.milestone as Record<string, unknown> | undefined;

  return {
    id: issue.id,
    iid: issue.iid,
    projectId: issue.project_id,
    title: issue.title,
    description: issue.description,
    state: issue.state,
    webUrl: issue.web_url,
    author: author
      ? { id: author.id, username: author.username, name: author.name }
      : undefined,
    assignee: assignee
      ? { id: assignee.id, username: assignee.username, name: assignee.name }
      : undefined,
    assignees: assignees?.map((a) => ({
      id: a.id,
      username: a.username,
      name: a.name,
    })),
    milestone: milestone
      ? { id: milestone.id, iid: milestone.iid, title: milestone.title }
      : undefined,
    labels: issue.labels,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at,
    dueDate: issue.due_date,
    confidential: issue.confidential,
    weight: issue.weight,
    upvotes: issue.upvotes,
    downvotes: issue.downvotes,
    userNotesCount: issue.user_notes_count,
  };
}

/**
 * Format merge request for response.
 */
export function formatMergeRequest(mr: Record<string, unknown>): Record<string, unknown> {
  const author = mr.author as Record<string, unknown> | undefined;
  const assignee = mr.assignee as Record<string, unknown> | undefined;
  const assignees = mr.assignees as Array<Record<string, unknown>> | undefined;
  const reviewers = mr.reviewers as Array<Record<string, unknown>> | undefined;
  const milestone = mr.milestone as Record<string, unknown> | undefined;

  return {
    id: mr.id,
    iid: mr.iid,
    projectId: mr.project_id,
    title: mr.title,
    description: mr.description,
    state: mr.state,
    mergeStatus: mr.merge_status,
    detailedMergeStatus: mr.detailed_merge_status,
    webUrl: mr.web_url,
    sourceBranch: mr.source_branch,
    targetBranch: mr.target_branch,
    sourceProjectId: mr.source_project_id,
    targetProjectId: mr.target_project_id,
    author: author
      ? { id: author.id, username: author.username, name: author.name }
      : undefined,
    assignee: assignee
      ? { id: assignee.id, username: assignee.username, name: assignee.name }
      : undefined,
    assignees: assignees?.map((a) => ({
      id: a.id,
      username: a.username,
      name: a.name,
    })),
    reviewers: reviewers?.map((r) => ({
      id: r.id,
      username: r.username,
      name: r.name,
    })),
    milestone: milestone
      ? { id: milestone.id, iid: milestone.iid, title: milestone.title }
      : undefined,
    labels: mr.labels,
    draft: mr.draft,
    workInProgress: mr.work_in_progress,
    createdAt: mr.created_at,
    updatedAt: mr.updated_at,
    mergedAt: mr.merged_at,
    closedAt: mr.closed_at,
    sha: mr.sha,
    mergeCommitSha: mr.merge_commit_sha,
    squashCommitSha: mr.squash_commit_sha,
    userNotesCount: mr.user_notes_count,
    changesCount: mr.changes_count,
    upvotes: mr.upvotes,
    downvotes: mr.downvotes,
  };
}

/**
 * Format branch for response.
 */
export function formatBranch(branch: Record<string, unknown>): Record<string, unknown> {
  const commit = branch.commit as Record<string, unknown> | undefined;

  return {
    name: branch.name,
    merged: branch.merged,
    protected: branch.protected,
    default: branch.default,
    developersCanPush: branch.developers_can_push,
    developersCanMerge: branch.developers_can_merge,
    canPush: branch.can_push,
    webUrl: branch.web_url,
    commit: commit
      ? {
          id: commit.id,
          shortId: commit.short_id,
          title: commit.title,
          authorName: commit.author_name,
          authorEmail: commit.author_email,
          authoredDate: commit.authored_date,
          committedDate: commit.committed_date,
        }
      : undefined,
  };
}

/**
 * Format pipeline for response.
 */
export function formatPipeline(pipeline: Record<string, unknown>): Record<string, unknown> {
  const user = pipeline.user as Record<string, unknown> | undefined;

  return {
    id: pipeline.id,
    iid: pipeline.iid,
    projectId: pipeline.project_id,
    sha: pipeline.sha,
    ref: pipeline.ref,
    status: pipeline.status,
    source: pipeline.source,
    webUrl: pipeline.web_url,
    user: user
      ? { id: user.id, username: user.username, name: user.name }
      : undefined,
    createdAt: pipeline.created_at,
    updatedAt: pipeline.updated_at,
    startedAt: pipeline.started_at,
    finishedAt: pipeline.finished_at,
    duration: pipeline.duration,
    queuedDuration: pipeline.queued_duration,
    coverage: pipeline.coverage,
  };
}

/**
 * Format commit for response.
 */
export function formatCommit(commit: Record<string, unknown>): Record<string, unknown> {
  return {
    id: commit.id,
    shortId: commit.short_id,
    title: commit.title,
    message: commit.message,
    authorName: commit.author_name,
    authorEmail: commit.author_email,
    authoredDate: commit.authored_date,
    committerName: commit.committer_name,
    committerEmail: commit.committer_email,
    committedDate: commit.committed_date,
    webUrl: commit.web_url,
    parentIds: commit.parent_ids,
    stats: commit.stats,
  };
}

/**
 * Format group for response.
 */
export function formatGroup(group: Record<string, unknown>): Record<string, unknown> {
  return {
    id: group.id,
    name: group.name,
    path: group.path,
    fullName: group.full_name,
    fullPath: group.full_path,
    description: group.description,
    visibility: group.visibility,
    webUrl: group.web_url,
    parentId: group.parent_id,
    createdAt: group.created_at,
    projectsCount: group.projects_count,
  };
}

/**
 * Format note (comment) for response.
 */
export function formatNote(note: Record<string, unknown>): Record<string, unknown> {
  const author = note.author as Record<string, unknown> | undefined;

  return {
    id: note.id,
    body: note.body,
    author: author
      ? { id: author.id, username: author.username, name: author.name }
      : undefined,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
    system: note.system,
    noteableId: note.noteable_id,
    noteableType: note.noteable_type,
    noteableIid: note.noteable_iid,
    resolvable: note.resolvable,
    resolved: note.resolved,
  };
}

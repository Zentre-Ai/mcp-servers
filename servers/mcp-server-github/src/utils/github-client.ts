import { Octokit } from "@octokit/rest";

/**
 * Create an Octokit client with the provided token.
 */
export function createGitHubClient(token: string): Octokit {
  return new Octokit({
    auth: token,
  });
}

/**
 * Extract GitHub token from request headers.
 */
export function extractGitHubToken(
  headers: Record<string, string | string[] | undefined>
): string | null {
  // Check for x-github-token header
  const githubToken = headers["x-github-token"];
  if (githubToken) {
    return Array.isArray(githubToken) ? githubToken[0] : githubToken;
  }

  // Check for Authorization: Bearer header
  const authHeader = headers["authorization"];
  if (authHeader) {
    const auth = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (auth.toLowerCase().startsWith("bearer ")) {
      return auth.slice(7);
    }
  }

  return null;
}

/**
 * Format a repository object for output.
 */
export function formatRepo(repo: Record<string, unknown>): Record<string, unknown> {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    private: repo.private,
    fork: repo.fork,
    url: repo.html_url,
    cloneUrl: repo.clone_url,
    defaultBranch: repo.default_branch,
    language: repo.language,
    stargazersCount: repo.stargazers_count,
    forksCount: repo.forks_count,
    openIssuesCount: repo.open_issues_count,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    pushedAt: repo.pushed_at,
    owner: repo.owner
      ? {
          login: (repo.owner as Record<string, unknown>).login,
          id: (repo.owner as Record<string, unknown>).id,
          avatarUrl: (repo.owner as Record<string, unknown>).avatar_url,
          type: (repo.owner as Record<string, unknown>).type,
        }
      : null,
  };
}

/**
 * Format an issue object for output.
 */
export function formatIssue(issue: Record<string, unknown>): Record<string, unknown> {
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    state: issue.state,
    body: issue.body,
    url: issue.html_url,
    user: issue.user
      ? {
          login: (issue.user as Record<string, unknown>).login,
          id: (issue.user as Record<string, unknown>).id,
        }
      : null,
    labels: Array.isArray(issue.labels)
      ? issue.labels.map((l: Record<string, unknown>) => ({
          name: l.name,
          color: l.color,
        }))
      : [],
    assignees: Array.isArray(issue.assignees)
      ? issue.assignees.map((a: Record<string, unknown>) => ({
          login: a.login,
          id: a.id,
        }))
      : [],
    milestone: issue.milestone
      ? {
          title: (issue.milestone as Record<string, unknown>).title,
          number: (issue.milestone as Record<string, unknown>).number,
        }
      : null,
    comments: issue.comments,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at,
  };
}

/**
 * Format a pull request object for output.
 */
export function formatPullRequest(pr: Record<string, unknown>): Record<string, unknown> {
  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    body: pr.body,
    url: pr.html_url,
    draft: pr.draft,
    merged: pr.merged,
    mergeable: pr.mergeable,
    mergedAt: pr.merged_at,
    user: pr.user
      ? {
          login: (pr.user as Record<string, unknown>).login,
          id: (pr.user as Record<string, unknown>).id,
        }
      : null,
    head: pr.head
      ? {
          ref: (pr.head as Record<string, unknown>).ref,
          sha: (pr.head as Record<string, unknown>).sha,
        }
      : null,
    base: pr.base
      ? {
          ref: (pr.base as Record<string, unknown>).ref,
          sha: (pr.base as Record<string, unknown>).sha,
        }
      : null,
    labels: Array.isArray(pr.labels)
      ? pr.labels.map((l: Record<string, unknown>) => ({
          name: l.name,
          color: l.color,
        }))
      : [],
    assignees: Array.isArray(pr.assignees)
      ? pr.assignees.map((a: Record<string, unknown>) => ({
          login: a.login,
          id: a.id,
        }))
      : [],
    requestedReviewers: Array.isArray(pr.requested_reviewers)
      ? pr.requested_reviewers.map((r: Record<string, unknown>) => ({
          login: r.login,
          id: r.id,
        }))
      : [],
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
    commits: pr.commits,
    comments: pr.comments,
    reviewComments: pr.review_comments,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    closedAt: pr.closed_at,
  };
}

/**
 * Format a branch object for output.
 */
export function formatBranch(branch: Record<string, unknown>): Record<string, unknown> {
  return {
    name: branch.name,
    protected: branch.protected,
    commit: branch.commit
      ? {
          sha: (branch.commit as Record<string, unknown>).sha,
          url: (branch.commit as Record<string, unknown>).url,
        }
      : null,
  };
}

/**
 * Format a commit object for output.
 */
export function formatCommit(commit: Record<string, unknown>): Record<string, unknown> {
  const commitData = commit.commit as Record<string, unknown> | undefined;
  const author = commitData?.author as Record<string, unknown> | undefined;
  const committer = commitData?.committer as Record<string, unknown> | undefined;

  return {
    sha: commit.sha,
    message: commitData?.message,
    url: commit.html_url,
    author: author
      ? {
          name: author.name,
          email: author.email,
          date: author.date,
        }
      : null,
    committer: committer
      ? {
          name: committer.name,
          email: committer.email,
          date: committer.date,
        }
      : null,
    githubAuthor: commit.author
      ? {
          login: (commit.author as Record<string, unknown>).login,
          id: (commit.author as Record<string, unknown>).id,
        }
      : null,
    stats: commit.stats,
    files: Array.isArray(commit.files)
      ? commit.files.map((f: Record<string, unknown>) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
        }))
      : undefined,
  };
}

/**
 * Format a user object for output.
 */
export function formatUser(user: Record<string, unknown>): Record<string, unknown> {
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url,
    url: user.html_url,
    type: user.type,
    bio: user.bio,
    company: user.company,
    location: user.location,
    blog: user.blog,
    publicRepos: user.public_repos,
    publicGists: user.public_gists,
    followers: user.followers,
    following: user.following,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

/**
 * Format a comment object for output.
 */
export function formatComment(comment: Record<string, unknown>): Record<string, unknown> {
  return {
    id: comment.id,
    body: comment.body,
    url: comment.html_url,
    user: comment.user
      ? {
          login: (comment.user as Record<string, unknown>).login,
          id: (comment.user as Record<string, unknown>).id,
        }
      : null,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
  };
}

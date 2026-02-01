import { logger } from "./logger.js";

/**
 * Jira authentication configuration.
 */
export interface JiraAuth {
  host: string;
  email?: string;
  apiToken?: string;
  bearerToken?: string;
}

/**
 * Creates authorization header for Jira API requests.
 */
function getAuthHeader(auth: JiraAuth): string {
  if (auth.bearerToken) {
    return `Bearer ${auth.bearerToken}`;
  }
  if (auth.email && auth.apiToken) {
    const credentials = Buffer.from(`${auth.email}:${auth.apiToken}`).toString("base64");
    return `Basic ${credentials}`;
  }
  throw new Error("Invalid Jira authentication: provide either bearer token or email+apiToken");
}

/**
 * Jira API client for making REST API requests.
 */
export class JiraClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(auth: JiraAuth) {
    // Ensure host doesn't have trailing slash and has https
    let host = auth.host.replace(/\/$/, "");
    if (!host.startsWith("http")) {
      host = `https://${host}`;
    }
    this.baseUrl = `${host}/rest/api/3`;
    this.authHeader = getAuthHeader(auth);
  }

  /**
   * Make a request to the Jira API.
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;

    // Add query parameters
    if (queryParams) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      }
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      Accept: "application/json",
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    logger.debug(`Jira API: ${method} ${url}`);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `Jira API error: ${response.status} ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.errorMessages?.length) {
          errorMessage = errorJson.errorMessages.join(", ");
        } else if (errorJson.errors) {
          errorMessage = Object.entries(errorJson.errors)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ");
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
  async get<T>(path: string, queryParams?: Record<string, string | number | boolean | undefined>): Promise<T> {
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
 * Extract Jira credentials from request headers.
 */
export function extractJiraAuth(
  headers: Record<string, string | string[] | undefined>
): JiraAuth | null {
  const host = headers["x-jira-host"];
  if (!host || typeof host !== "string") {
    return null;
  }

  // Check for bearer token first
  const authHeader = headers["authorization"];
  if (authHeader && typeof authHeader === "string") {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch) {
      return { host, bearerToken: bearerMatch[1] };
    }
  }

  // Check for basic auth (email + API token)
  const email = headers["x-jira-email"];
  const apiToken = headers["x-jira-token"];
  if (email && typeof email === "string" && apiToken && typeof apiToken === "string") {
    return { host, email, apiToken };
  }

  return null;
}

/**
 * Create a Jira client from authentication config.
 */
export function createJiraClient(auth: JiraAuth): JiraClient {
  return new JiraClient(auth);
}

/**
 * Format issue for response.
 */
export function formatIssue(issue: Record<string, unknown>): Record<string, unknown> {
  const fields = (issue.fields || {}) as Record<string, unknown>;
  const status = fields.status as Record<string, unknown> | undefined;
  const priority = fields.priority as Record<string, unknown> | undefined;
  const assignee = fields.assignee as Record<string, unknown> | undefined;
  const reporter = fields.reporter as Record<string, unknown> | undefined;
  const issueType = fields.issuetype as Record<string, unknown> | undefined;
  const project = fields.project as Record<string, unknown> | undefined;
  const parent = fields.parent as Record<string, unknown> | undefined;

  return {
    id: issue.id,
    key: issue.key,
    self: issue.self,
    summary: fields.summary,
    description: fields.description,
    status: status ? { id: status.id, name: status.name } : undefined,
    priority: priority ? { id: priority.id, name: priority.name } : undefined,
    assignee: assignee ? { accountId: assignee.accountId, displayName: assignee.displayName } : undefined,
    reporter: reporter ? { accountId: reporter.accountId, displayName: reporter.displayName } : undefined,
    issueType: issueType ? { id: issueType.id, name: issueType.name } : undefined,
    project: project ? { id: project.id, key: project.key, name: project.name } : undefined,
    parent: parent ? { id: parent.id, key: parent.key } : undefined,
    labels: fields.labels,
    created: fields.created,
    updated: fields.updated,
    duedate: fields.duedate,
    resolutiondate: fields.resolutiondate,
  };
}

/**
 * Format project for response.
 */
export function formatProject(project: Record<string, unknown>): Record<string, unknown> {
  const lead = project.lead as Record<string, unknown> | undefined;
  return {
    id: project.id,
    key: project.key,
    name: project.name,
    description: project.description,
    projectTypeKey: project.projectTypeKey,
    style: project.style,
    lead: lead ? { accountId: lead.accountId, displayName: lead.displayName } : undefined,
    url: project.url,
    self: project.self,
  };
}

/**
 * Format user for response.
 */
export function formatUser(user: Record<string, unknown>): Record<string, unknown> {
  return {
    accountId: user.accountId,
    accountType: user.accountType,
    displayName: user.displayName,
    emailAddress: user.emailAddress,
    active: user.active,
    timeZone: user.timeZone,
    self: user.self,
  };
}

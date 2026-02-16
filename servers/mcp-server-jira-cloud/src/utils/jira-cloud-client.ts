import { logger } from "./logger.js";

/**
 * Jira Cloud authentication configuration.
 * cloudId may be undefined if the user has multiple sites and hasn't selected one yet.
 */
export interface JiraCloudAuth {
  accessToken: string;
  cloudId?: string;
}

/**
 * Jira Cloud API client for making REST API requests.
 * Uses the Atlassian Cloud API at api.atlassian.com.
 */
export class JiraCloudClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(auth: JiraCloudAuth & { cloudId: string }) {
    // Jira Cloud API uses the cloud ID in the URL
    this.baseUrl = `https://api.atlassian.com/ex/jira/${auth.cloudId}/rest/api/3`;
    this.accessToken = auth.accessToken;
  }

  /**
   * Get the base URL for Agile API.
   */
  private getAgileBaseUrl(cloudId: string): string {
    return `https://api.atlassian.com/ex/jira/${cloudId}/rest/agile/1.0`;
  }

  /**
   * Make a request to the Jira Cloud API.
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
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/json",
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    logger.debug(`Jira Cloud API: ${method} ${url}`);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `Jira Cloud API error: ${response.status} ${response.statusText}`;
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

  /**
   * Make a request to the Agile API.
   */
  async agileRequest<T>(
    cloudId: string,
    method: string,
    path: string,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    let url = `${this.getAgileBaseUrl(cloudId)}${path}`;

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
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/json",
    };

    logger.debug(`Jira Cloud Agile API: ${method} ${url}`);

    const response = await fetch(url, {
      method,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Jira Cloud Agile API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

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
 * Extract the Bearer access token from request headers.
 * Expects: Authorization: Bearer <accessToken>
 */
export function extractAccessToken(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const authHeader = headers["authorization"];
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    return null;
  }

  return bearerMatch[1];
}

/**
 * Create a Jira Cloud client from authentication config.
 * Requires cloudId to be set.
 */
export function createJiraCloudClient(auth: JiraCloudAuth & { cloudId: string }): JiraCloudClient {
  return new JiraCloudClient(auth);
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

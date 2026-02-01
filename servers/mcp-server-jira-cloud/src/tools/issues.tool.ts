import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createJiraCloudClient, formatIssue } from "../utils/jira-cloud-client.js";
import { logger } from "../utils/logger.js";

/**
 * Get an issue by key or ID.
 */
server.tool(
  "jira_cloud_get_issue",
  {
    issueIdOrKey: z.string().describe("Issue key (e.g., 'PROJ-123') or ID"),
    fields: z.string().optional().describe("Comma-separated list of fields to return"),
    expand: z.string().optional().describe("Comma-separated list of fields to expand (e.g., 'changelog,transitions')"),
  },
  async ({ issueIdOrKey, fields, expand }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira Cloud credentials available" }] };
    }

    try {
      const client = createJiraCloudClient(auth);
      const issue = await client.get<Record<string, unknown>>(`/issue/${issueIdOrKey}`, {
        fields,
        expand,
      });

      return { content: [{ type: "text", text: JSON.stringify(formatIssue(issue), null, 2) }] };
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
  "jira_cloud_create_issue",
  {
    projectKey: z.string().describe("Project key (e.g., 'PROJ')"),
    issueType: z.string().describe("Issue type (e.g., 'Task', 'Bug', 'Story')"),
    summary: z.string().describe("Issue summary/title"),
    description: z.string().optional().describe("Issue description (supports Atlassian Document Format or plain text)"),
    assigneeId: z.string().optional().describe("Assignee account ID"),
    priority: z.string().optional().describe("Priority name (e.g., 'High', 'Medium', 'Low')"),
    labels: z.array(z.string()).optional().describe("Array of labels"),
    parentKey: z.string().optional().describe("Parent issue key for subtasks"),
    dueDate: z.string().optional().describe("Due date (YYYY-MM-DD format)"),
  },
  async ({ projectKey, issueType, summary, description, assigneeId, priority, labels, parentKey, dueDate }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira Cloud credentials available" }] };
    }

    try {
      const client = createJiraCloudClient(auth);

      const fields: Record<string, unknown> = {
        project: { key: projectKey },
        issuetype: { name: issueType },
        summary,
      };

      if (description) {
        // Convert plain text to Atlassian Document Format if needed
        if (typeof description === "string" && !description.startsWith("{")) {
          fields.description = {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: description }],
              },
            ],
          };
        } else {
          fields.description = JSON.parse(description);
        }
      }

      if (assigneeId) {
        fields.assignee = { accountId: assigneeId };
      }
      if (priority) {
        fields.priority = { name: priority };
      }
      if (labels) {
        fields.labels = labels;
      }
      if (parentKey) {
        fields.parent = { key: parentKey };
      }
      if (dueDate) {
        fields.duedate = dueDate;
      }

      const result = await client.post<Record<string, unknown>>("/issue", { fields });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                id: result.id,
                key: result.key,
                self: result.self,
              },
              null,
              2
            ),
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
 * Update an existing issue.
 */
server.tool(
  "jira_cloud_update_issue",
  {
    issueIdOrKey: z.string().describe("Issue key (e.g., 'PROJ-123') or ID"),
    summary: z.string().optional().describe("New summary"),
    description: z.string().optional().describe("New description"),
    assigneeId: z.string().optional().describe("New assignee account ID (use empty string to unassign)"),
    priority: z.string().optional().describe("New priority name"),
    labels: z.array(z.string()).optional().describe("New labels array (replaces existing)"),
    dueDate: z.string().optional().describe("New due date (YYYY-MM-DD format)"),
  },
  async ({ issueIdOrKey, summary, description, assigneeId, priority, labels, dueDate }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira Cloud credentials available" }] };
    }

    try {
      const client = createJiraCloudClient(auth);

      const fields: Record<string, unknown> = {};

      if (summary !== undefined) {
        fields.summary = summary;
      }
      if (description !== undefined) {
        if (typeof description === "string" && !description.startsWith("{")) {
          fields.description = {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: description }],
              },
            ],
          };
        } else {
          fields.description = JSON.parse(description);
        }
      }
      if (assigneeId !== undefined) {
        fields.assignee = assigneeId ? { accountId: assigneeId } : null;
      }
      if (priority !== undefined) {
        fields.priority = { name: priority };
      }
      if (labels !== undefined) {
        fields.labels = labels;
      }
      if (dueDate !== undefined) {
        fields.duedate = dueDate;
      }

      await client.put(`/issue/${issueIdOrKey}`, { fields });

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, issueIdOrKey, updated: true }, null, 2) }],
      };
    } catch (error) {
      logger.error("Failed to update issue", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating issue: ${message}` }] };
    }
  }
);

/**
 * Delete an issue.
 */
server.tool(
  "jira_cloud_delete_issue",
  {
    issueIdOrKey: z.string().describe("Issue key (e.g., 'PROJ-123') or ID"),
    deleteSubtasks: z.boolean().optional().describe("Whether to delete subtasks (default false)"),
  },
  async ({ issueIdOrKey, deleteSubtasks }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira Cloud credentials available" }] };
    }

    try {
      const client = createJiraCloudClient(auth);
      await client.request("DELETE", `/issue/${issueIdOrKey}`, undefined, {
        deleteSubtasks: deleteSubtasks ? "true" : "false",
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, issueIdOrKey, deleted: true }, null, 2) }],
      };
    } catch (error) {
      logger.error("Failed to delete issue", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting issue: ${message}` }] };
    }
  }
);

/**
 * Get available transitions for an issue.
 */
server.tool(
  "jira_cloud_get_transitions",
  {
    issueIdOrKey: z.string().describe("Issue key (e.g., 'PROJ-123') or ID"),
  },
  async ({ issueIdOrKey }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira Cloud credentials available" }] };
    }

    try {
      const client = createJiraCloudClient(auth);
      const result = await client.get<{ transitions: Array<Record<string, unknown>> }>(
        `/issue/${issueIdOrKey}/transitions`
      );

      const transitions = result.transitions.map((t) => ({
        id: t.id,
        name: t.name,
        to: t.to ? { id: (t.to as Record<string, unknown>).id, name: (t.to as Record<string, unknown>).name } : undefined,
      }));

      return { content: [{ type: "text", text: JSON.stringify({ issueIdOrKey, transitions }, null, 2) }] };
    } catch (error) {
      logger.error("Failed to get transitions", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting transitions: ${message}` }] };
    }
  }
);

/**
 * Transition an issue to a new status.
 */
server.tool(
  "jira_cloud_transition_issue",
  {
    issueIdOrKey: z.string().describe("Issue key (e.g., 'PROJ-123') or ID"),
    transitionId: z.string().describe("Transition ID (use jira_cloud_get_transitions to find available transitions)"),
    comment: z.string().optional().describe("Comment to add with the transition"),
  },
  async ({ issueIdOrKey, transitionId, comment }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira Cloud credentials available" }] };
    }

    try {
      const client = createJiraCloudClient(auth);

      const body: Record<string, unknown> = {
        transition: { id: transitionId },
      };

      if (comment) {
        body.update = {
          comment: [
            {
              add: {
                body: {
                  type: "doc",
                  version: 1,
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: comment }],
                    },
                  ],
                },
              },
            },
          ],
        };
      }

      await client.post(`/issue/${issueIdOrKey}/transitions`, body);

      return {
        content: [
          { type: "text", text: JSON.stringify({ success: true, issueIdOrKey, transitioned: true }, null, 2) },
        ],
      };
    } catch (error) {
      logger.error("Failed to transition issue", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error transitioning issue: ${message}` }] };
    }
  }
);

/**
 * Add a comment to an issue.
 */
server.tool(
  "jira_cloud_add_comment",
  {
    issueIdOrKey: z.string().describe("Issue key (e.g., 'PROJ-123') or ID"),
    body: z.string().describe("Comment body text"),
  },
  async ({ issueIdOrKey, body }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira Cloud credentials available" }] };
    }

    try {
      const client = createJiraCloudClient(auth);

      const result = await client.post<Record<string, unknown>>(`/issue/${issueIdOrKey}/comment`, {
        body: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: body }],
            },
          ],
        },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                id: result.id,
                created: result.created,
              },
              null,
              2
            ),
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
 * Get comments for an issue.
 */
server.tool(
  "jira_cloud_get_comments",
  {
    issueIdOrKey: z.string().describe("Issue key (e.g., 'PROJ-123') or ID"),
    startAt: z.number().optional().describe("Index of the first comment to return"),
    maxResults: z.number().optional().describe("Maximum number of comments to return (default 50)"),
  },
  async ({ issueIdOrKey, startAt, maxResults }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira Cloud credentials available" }] };
    }

    try {
      const client = createJiraCloudClient(auth);
      const result = await client.get<{
        comments: Array<Record<string, unknown>>;
        total: number;
        startAt: number;
        maxResults: number;
      }>(`/issue/${issueIdOrKey}/comment`, { startAt, maxResults });

      const comments = result.comments.map((c) => {
        const author = c.author as Record<string, unknown> | undefined;
        return {
          id: c.id,
          body: c.body,
          author: author ? { accountId: author.accountId, displayName: author.displayName } : undefined,
          created: c.created,
          updated: c.updated,
        };
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                issueIdOrKey,
                total: result.total,
                startAt: result.startAt,
                maxResults: result.maxResults,
                comments,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get comments", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting comments: ${message}` }] };
    }
  }
);

/**
 * Assign an issue to a user.
 */
server.tool(
  "jira_cloud_assign_issue",
  {
    issueIdOrKey: z.string().describe("Issue key (e.g., 'PROJ-123') or ID"),
    accountId: z.string().optional().describe("Account ID of assignee (omit or use null to unassign)"),
  },
  async ({ issueIdOrKey, accountId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Jira Cloud credentials available" }] };
    }

    try {
      const client = createJiraCloudClient(auth);
      await client.put(`/issue/${issueIdOrKey}/assignee`, {
        accountId: accountId || null,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { success: true, issueIdOrKey, assignedTo: accountId || "unassigned" },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to assign issue", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error assigning issue: ${message}` }] };
    }
  }
);

logger.info("Jira Cloud issue tools registered");

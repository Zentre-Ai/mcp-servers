import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createZohoPeopleClient, formatLeave } from "../utils/zoho-people-client.js";
import { logger } from "../utils/logger.js";

/**
 * List leave types.
 */
server.tool(
  "zoho_people_list_leave_types",
  {
    userId: z.string().optional().describe("User ID to get leave types for (optional)"),
  },
  async ({ userId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho People credentials available" }] };
    }

    try {
      const client = createZohoPeopleClient(auth);

      const params: Record<string, string | number | boolean | undefined> = {};
      if (userId) params.userId = userId;

      const result = await client.get<{
        response: {
          result: Array<Record<string, unknown>>;
        };
      }>("/leave/getLeaveTypeDetails", params);

      const leaveTypes = Array.isArray(result.response?.result)
        ? result.response.result.map((lt) => ({
            id: lt.Id || lt.id,
            name: lt.Name || lt.name || lt.Leavetype,
            unit: lt.Unit || lt.unit,
            permittedCount: lt.PermittedCount || lt.permittedCount,
            balance: lt.Balance || lt.balance,
          }))
        : [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ leaveTypes, count: leaveTypes.length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list leave types", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing leave types: ${message}` }] };
    }
  }
);

/**
 * Get leave balance for an employee.
 */
server.tool(
  "zoho_people_get_leave_balance",
  {
    userId: z.string().describe("User ID or Employee ID"),
  },
  async ({ userId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho People credentials available" }] };
    }

    try {
      const client = createZohoPeopleClient(auth);

      const result = await client.get<{
        response: {
          result: Array<Record<string, unknown>>;
        };
      }>("/leave/getLeaveTypeDetails", { userId });

      const leaveBalances = Array.isArray(result.response?.result)
        ? result.response.result.map((lt) => ({
            leaveType: lt.Name || lt.name || lt.Leavetype,
            id: lt.Id || lt.id,
            permitted: lt.PermittedCount || lt.permittedCount,
            balance: lt.Balance || lt.balance,
            used: lt.Used || lt.used,
            unit: lt.Unit || lt.unit,
          }))
        : [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ userId, leaveBalances }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get leave balance", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting leave balance: ${message}` }] };
    }
  }
);

/**
 * Apply for leave.
 */
server.tool(
  "zoho_people_apply_leave",
  {
    leaveType: z.string().describe("Leave type ID or name"),
    from: z.string().describe("Start date (dd-MMM-yyyy)"),
    to: z.string().describe("End date (dd-MMM-yyyy)"),
    reason: z.string().optional().describe("Reason for leave"),
    teamEmailIds: z.string().optional().describe("Comma-separated team email IDs to notify"),
    empId: z.string().optional().describe("Employee ID (if applying on behalf of someone)"),
  },
  async ({ leaveType, from, to, reason, teamEmailIds, empId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho People credentials available" }] };
    }

    try {
      const client = createZohoPeopleClient(auth);

      const params: Record<string, string | number | boolean | undefined> = {
        Leavetype: leaveType,
        From: from,
        To: to,
      };

      if (reason) params.Reason = reason;
      if (teamEmailIds) params.Team_EmailID = teamEmailIds;
      if (empId) params.empId = empId;

      const result = await client.formRequest<{
        response: {
          result: { pkId?: string; message?: string };
        };
      }>("POST", "/leave/addLeave", params);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                leaveId: result.response?.result?.pkId,
                message: result.response?.result?.message || "Leave application submitted",
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to apply for leave", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error applying for leave: ${message}` }] };
    }
  }
);

/**
 * Get leave requests.
 */
server.tool(
  "zoho_people_get_leave_requests",
  {
    userId: z.string().optional().describe("Filter by user ID"),
    approvalStatus: z.enum(["Pending", "Approved", "Rejected", "Cancelled"]).optional().describe("Filter by approval status"),
    sdate: z.string().optional().describe("Start date filter (dd-MMM-yyyy)"),
    edate: z.string().optional().describe("End date filter (dd-MMM-yyyy)"),
    sIndex: z.number().optional().describe("Start index for pagination"),
    limit: z.number().optional().describe("Number of records to fetch"),
  },
  async ({ userId, approvalStatus, sdate, edate, sIndex, limit }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho People credentials available" }] };
    }

    try {
      const client = createZohoPeopleClient(auth);

      const params: Record<string, string | number | boolean | undefined> = {
        sIndex: sIndex || 1,
        limit: limit || 200,
      };

      if (userId) params.userId = userId;
      if (approvalStatus) params.approvalStatus = approvalStatus;
      if (sdate) params.sdate = sdate;
      if (edate) params.edate = edate;

      const result = await client.get<{
        response: {
          result: Array<Record<string, unknown>>;
        };
      }>("/forms/leave/getRecords", params);

      const leaveRequests = Array.isArray(result.response?.result)
        ? result.response.result.map((lr) => {
            const leaveData = Object.values(lr)[0] as Record<string, unknown>;
            return formatLeave(leaveData);
          })
        : [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ leaveRequests, count: leaveRequests.length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get leave requests", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting leave requests: ${message}` }] };
    }
  }
);

/**
 * Approve or reject a leave request.
 */
server.tool(
  "zoho_people_approve_leave",
  {
    recordId: z.string().describe("Leave request record ID"),
    action: z.enum(["Approve", "Reject", "Cancel"]).describe("Action to take"),
    comments: z.string().optional().describe("Comments for the action"),
  },
  async ({ recordId, action, comments }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho People credentials available" }] };
    }

    try {
      const client = createZohoPeopleClient(auth);

      const params: Record<string, string | number | boolean | undefined> = {
        recordId,
        action,
      };

      if (comments) params.comments = comments;

      const result = await client.formRequest<{
        response: {
          result: { message?: string };
        };
      }>("POST", "/leave/approveLeave", params);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                recordId,
                action,
                message: result.response?.result?.message || `Leave ${action.toLowerCase()}d successfully`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to approve leave", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error approving leave: ${message}` }] };
    }
  }
);

/**
 * Get pending leave approvals for a manager.
 */
server.tool(
  "zoho_people_get_pending_approvals",
  {
    sdate: z.string().optional().describe("Start date filter (dd-MMM-yyyy)"),
    edate: z.string().optional().describe("End date filter (dd-MMM-yyyy)"),
    sIndex: z.number().optional().describe("Start index for pagination"),
    limit: z.number().optional().describe("Number of records to fetch"),
  },
  async ({ sdate, edate, sIndex, limit }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho People credentials available" }] };
    }

    try {
      const client = createZohoPeopleClient(auth);

      const params: Record<string, string | number | boolean | undefined> = {
        approvalStatus: "Pending",
        sIndex: sIndex || 1,
        limit: limit || 200,
      };

      if (sdate) params.sdate = sdate;
      if (edate) params.edate = edate;

      const result = await client.get<{
        response: {
          result: Array<Record<string, unknown>>;
        };
      }>("/forms/leave/getRecords", params);

      const pendingApprovals = Array.isArray(result.response?.result)
        ? result.response.result.map((lr) => {
            const leaveData = Object.values(lr)[0] as Record<string, unknown>;
            return formatLeave(leaveData);
          })
        : [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "Pending",
                pendingApprovals,
                count: pendingApprovals.length,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get pending approvals", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting pending approvals: ${message}` }] };
    }
  }
);

/**
 * Get team leave requests (leave requests for employees reporting to a manager).
 */
server.tool(
  "zoho_people_get_team_leave_requests",
  {
    teamMemberIds: z.array(z.string()).describe("Array of team member user IDs"),
    approvalStatus: z.enum(["Pending", "Approved", "Rejected", "Cancelled", "All"]).optional().describe("Filter by approval status"),
    sdate: z.string().optional().describe("Start date filter (dd-MMM-yyyy)"),
    edate: z.string().optional().describe("End date filter (dd-MMM-yyyy)"),
    sIndex: z.number().optional().describe("Start index for pagination"),
    limit: z.number().optional().describe("Number of records to fetch per member"),
  },
  async ({ teamMemberIds, approvalStatus, sdate, edate, sIndex, limit }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho People credentials available" }] };
    }

    try {
      const client = createZohoPeopleClient(auth);
      const allLeaveRequests: Array<{ userId: string; leaves: Array<Record<string, unknown>> }> = [];

      // Fetch leave requests for each team member
      for (const userId of teamMemberIds) {
        const params: Record<string, string | number | boolean | undefined> = {
          userId,
          sIndex: sIndex || 1,
          limit: limit || 50,
        };

        if (approvalStatus && approvalStatus !== "All") params.approvalStatus = approvalStatus;
        if (sdate) params.sdate = sdate;
        if (edate) params.edate = edate;

        try {
          const result = await client.get<{
            response: {
              result: Array<Record<string, unknown>>;
            };
          }>("/forms/leave/getRecords", params);

          const leaves = Array.isArray(result.response?.result)
            ? result.response.result.map((lr) => {
                const leaveData = Object.values(lr)[0] as Record<string, unknown>;
                return formatLeave(leaveData);
              })
            : [];

          if (leaves.length > 0) {
            allLeaveRequests.push({ userId, leaves });
          }
        } catch {
          // Continue with other team members if one fails
          logger.warn(`Failed to get leave requests for user ${userId}`);
        }
      }

      const totalLeaves = allLeaveRequests.reduce((sum, member) => sum + member.leaves.length, 0);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                teamLeaveRequests: allLeaveRequests,
                teamMemberCount: teamMemberIds.length,
                totalLeaveRequests: totalLeaves,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get team leave requests", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting team leave requests: ${message}` }] };
    }
  }
);

/**
 * Get team leave summary (leave balances for all team members).
 */
server.tool(
  "zoho_people_get_team_leave_summary",
  {
    teamMemberIds: z.array(z.string()).describe("Array of team member user IDs"),
  },
  async ({ teamMemberIds }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho People credentials available" }] };
    }

    try {
      const client = createZohoPeopleClient(auth);
      const teamLeaveSummary: Array<{
        userId: string;
        leaveBalances: Array<Record<string, unknown>>;
      }> = [];

      // Fetch leave balances for each team member
      for (const userId of teamMemberIds) {
        try {
          const result = await client.get<{
            response: {
              result: Array<Record<string, unknown>>;
            };
          }>("/leave/getLeaveTypeDetails", { userId });

          const leaveBalances = Array.isArray(result.response?.result)
            ? result.response.result.map((lt) => ({
                leaveType: lt.Name || lt.name || lt.Leavetype,
                id: lt.Id || lt.id,
                permitted: lt.PermittedCount || lt.permittedCount,
                balance: lt.Balance || lt.balance,
                used: lt.Used || lt.used,
                unit: lt.Unit || lt.unit,
              }))
            : [];

          teamLeaveSummary.push({ userId, leaveBalances });
        } catch {
          // Continue with other team members if one fails
          logger.warn(`Failed to get leave balance for user ${userId}`);
          teamLeaveSummary.push({ userId, leaveBalances: [] });
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                teamLeaveSummary,
                teamMemberCount: teamMemberIds.length,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get team leave summary", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting team leave summary: ${message}` }] };
    }
  }
);

logger.info("Zoho People leave tools registered");

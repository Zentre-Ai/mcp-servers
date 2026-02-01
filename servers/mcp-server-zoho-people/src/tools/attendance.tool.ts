import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createZohoPeopleClient, formatAttendance } from "../utils/zoho-people-client.js";
import { logger } from "../utils/logger.js";

/**
 * Check in an employee.
 */
server.tool(
  "zoho_people_checkin",
  {
    dateFormat: z.string().optional().describe("Date format (default: dd-MMM-yyyy HH:mm:ss)"),
    checkIn: z.string().optional().describe("Check-in time (if not provided, uses current time)"),
    empId: z.string().optional().describe("Employee ID (if not provided, uses authenticated user)"),
  },
  async ({ dateFormat, checkIn, empId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho People credentials available" }] };
    }

    try {
      const client = createZohoPeopleClient(auth);

      const params: Record<string, string | number | boolean | undefined> = {
        dateFormat: dateFormat || "dd-MMM-yyyy HH:mm:ss",
      };

      if (checkIn) params.checkIn = checkIn;
      if (empId) params.empId = empId;

      const result = await client.get<{
        response: {
          result: { message?: string; checkIn?: string };
        };
      }>("/attendance/checkin", params);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                checkIn: result.response?.result?.checkIn,
                message: result.response?.result?.message || "Check-in successful",
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to check in", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error checking in: ${message}` }] };
    }
  }
);

/**
 * Check out an employee.
 */
server.tool(
  "zoho_people_checkout",
  {
    dateFormat: z.string().optional().describe("Date format (default: dd-MMM-yyyy HH:mm:ss)"),
    checkOut: z.string().optional().describe("Check-out time (if not provided, uses current time)"),
    empId: z.string().optional().describe("Employee ID (if not provided, uses authenticated user)"),
  },
  async ({ dateFormat, checkOut, empId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho People credentials available" }] };
    }

    try {
      const client = createZohoPeopleClient(auth);

      const params: Record<string, string | number | boolean | undefined> = {
        dateFormat: dateFormat || "dd-MMM-yyyy HH:mm:ss",
      };

      if (checkOut) params.checkOut = checkOut;
      if (empId) params.empId = empId;

      const result = await client.get<{
        response: {
          result: { message?: string; checkOut?: string };
        };
      }>("/attendance/checkout", params);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                checkOut: result.response?.result?.checkOut,
                message: result.response?.result?.message || "Check-out successful",
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to check out", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error checking out: ${message}` }] };
    }
  }
);

/**
 * Get attendance for an employee.
 */
server.tool(
  "zoho_people_get_attendance",
  {
    empId: z.string().describe("Employee ID"),
    date: z.string().optional().describe("Specific date (YYYY-MM-DD or dd-MMM-yyyy)"),
    sdate: z.string().optional().describe("Start date for range (YYYY-MM-DD)"),
    edate: z.string().optional().describe("End date for range (YYYY-MM-DD)"),
  },
  async ({ empId, date, sdate, edate }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho People credentials available" }] };
    }

    try {
      const client = createZohoPeopleClient(auth);

      const params: Record<string, string | number | boolean | undefined> = {
        empId,
      };

      if (date) params.date = date;
      if (sdate) params.sdate = sdate;
      if (edate) params.edate = edate;

      const result = await client.get<{
        response: {
          result: Array<Record<string, unknown>> | Record<string, unknown>;
        };
      }>("/attendance/getUserReport", params);

      const resultData = result.response?.result;
      const attendanceRecords = Array.isArray(resultData)
        ? resultData.map(formatAttendance)
        : resultData
        ? [formatAttendance(resultData)]
        : [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ attendance: attendanceRecords, count: attendanceRecords.length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get attendance", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting attendance: ${message}` }] };
    }
  }
);

/**
 * Get attendance report for multiple employees.
 */
server.tool(
  "zoho_people_get_attendance_report",
  {
    sdate: z.string().describe("Start date (YYYY-MM-DD)"),
    edate: z.string().describe("End date (YYYY-MM-DD)"),
    department: z.string().optional().describe("Filter by department"),
    empId: z.string().optional().describe("Filter by employee ID"),
  },
  async ({ sdate, edate, department, empId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho People credentials available" }] };
    }

    try {
      const client = createZohoPeopleClient(auth);

      const params: Record<string, string | number | boolean | undefined> = {
        sdate,
        edate,
      };

      if (department) params.department = department;
      if (empId) params.empId = empId;

      const result = await client.get<{
        response: {
          result: Array<Record<string, unknown>>;
        };
      }>("/attendance/getAttendanceReport", params);

      const attendanceRecords = Array.isArray(result.response?.result)
        ? result.response.result.map(formatAttendance)
        : [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                attendance: attendanceRecords,
                count: attendanceRecords.length,
                dateRange: { from: sdate, to: edate },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get attendance report", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting attendance report: ${message}` }] };
    }
  }
);

/**
 * Bulk import attendance.
 */
server.tool(
  "zoho_people_bulk_import_attendance",
  {
    records: z.array(z.object({
      empId: z.string().describe("Employee ID"),
      checkIn: z.string().describe("Check-in time"),
      checkOut: z.string().optional().describe("Check-out time"),
      date: z.string().optional().describe("Date (if not included in checkIn/checkOut)"),
    })).describe("Array of attendance records to import"),
    dateFormat: z.string().optional().describe("Date format (default: dd-MMM-yyyy HH:mm:ss)"),
  },
  async ({ records, dateFormat }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho People credentials available" }] };
    }

    try {
      const client = createZohoPeopleClient(auth);

      const data = records.map((r) => ({
        empId: r.empId,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        date: r.date,
      }));

      const result = await client.formRequest<{
        response: {
          result: { message?: string; successCount?: number; failureCount?: number };
        };
      }>("POST", "/attendance/bulkImport", {
        data: JSON.stringify(data),
        dateFormat: dateFormat || "dd-MMM-yyyy HH:mm:ss",
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: result.response?.result?.message || "Bulk import completed",
                successCount: result.response?.result?.successCount,
                failureCount: result.response?.result?.failureCount,
                totalRecords: records.length,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to bulk import attendance", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error bulk importing attendance: ${message}` }] };
    }
  }
);

logger.info("Zoho People attendance tools registered");

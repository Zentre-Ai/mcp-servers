import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createZohoPeopleClient, formatEmployee } from "../utils/zoho-people-client.js";
import { logger } from "../utils/logger.js";

/**
 * List employees.
 */
server.tool(
  "zoho_people_list_employees",
  {
    sIndex: z.number().optional().describe("Start index for pagination (default 1)"),
    limit: z.number().optional().describe("Number of records to fetch (max 200)"),
    searchColumn: z.string().optional().describe("Column to search (e.g., 'FirstName', 'Email')"),
    searchValue: z.string().optional().describe("Value to search for"),
  },
  async ({ sIndex, limit, searchColumn, searchValue }) => {
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

      if (searchColumn && searchValue) {
        params.searchColumn = searchColumn;
        params.searchValue = searchValue;
      }

      const result = await client.get<{
        response: {
          result: Array<Record<string, unknown>>;
          message?: string;
        };
      }>("/forms/employee/getRecords", params);

      const employees = Array.isArray(result.response?.result)
        ? result.response.result.map((emp) => {
            // Handle nested structure from Zoho People
            const empData = Object.values(emp)[0] as Record<string, unknown>;
            return formatEmployee(empData);
          })
        : [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ employees, count: employees.length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list employees", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing employees: ${message}` }] };
    }
  }
);

/**
 * Get an employee by ID.
 */
server.tool(
  "zoho_people_get_employee",
  {
    employeeId: z.string().describe("Employee ID"),
  },
  async ({ employeeId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho People credentials available" }] };
    }

    try {
      const client = createZohoPeopleClient(auth);
      const result = await client.get<{
        response: {
          result: Record<string, unknown>;
        };
      }>(`/forms/employee/getRecordByID`, { recordId: employeeId });

      const empData = result.response?.result;
      if (!empData) {
        return { content: [{ type: "text", text: `Error: Employee not found` }] };
      }

      return { content: [{ type: "text", text: JSON.stringify(formatEmployee(empData), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get employee", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting employee: ${message}` }] };
    }
  }
);

/**
 * Add a new employee.
 */
server.tool(
  "zoho_people_add_employee",
  {
    firstName: z.string().describe("First name"),
    lastName: z.string().describe("Last name"),
    email: z.string().describe("Email address"),
    employeeId: z.string().optional().describe("Employee ID (auto-generated if not provided)"),
    department: z.string().optional().describe("Department"),
    designation: z.string().optional().describe("Designation/Job title"),
    dateOfJoining: z.string().optional().describe("Date of joining (YYYY-MM-DD)"),
    reportingTo: z.string().optional().describe("Reporting manager's email or employee ID"),
    employeeType: z.string().optional().describe("Employee type (e.g., 'Permanent', 'Contract')"),
    workPhone: z.string().optional().describe("Work phone number"),
    mobile: z.string().optional().describe("Mobile number"),
    location: z.string().optional().describe("Work location"),
  },
  async ({ firstName, lastName, email, employeeId, department, designation, dateOfJoining, reportingTo, employeeType, workPhone, mobile, location }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho People credentials available" }] };
    }

    try {
      const client = createZohoPeopleClient(auth);

      const inputData: Record<string, string> = {
        FirstName: firstName,
        LastName: lastName,
        EmailID: email,
      };

      if (employeeId) inputData.EmployeeID = employeeId;
      if (department) inputData.Department = department;
      if (designation) inputData.Designation = designation;
      if (dateOfJoining) inputData.Dateofjoining = dateOfJoining;
      if (reportingTo) inputData.Reportingto = reportingTo;
      if (employeeType) inputData.Employeetype = employeeType;
      if (workPhone) inputData.Work_phone = workPhone;
      if (mobile) inputData.Mobile = mobile;
      if (location) inputData.Location = location;

      const result = await client.formRequest<{
        response: {
          result: { pkId: string; message?: string };
        };
      }>("POST", "/forms/json/employee/insertRecord", {
        inputData: JSON.stringify(inputData),
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                employeeId: result.response?.result?.pkId,
                message: result.response?.result?.message || "Employee added successfully",
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to add employee", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error adding employee: ${message}` }] };
    }
  }
);

/**
 * Update an employee.
 */
server.tool(
  "zoho_people_update_employee",
  {
    recordId: z.string().describe("Record ID of the employee to update"),
    firstName: z.string().optional().describe("First name"),
    lastName: z.string().optional().describe("Last name"),
    email: z.string().optional().describe("Email address"),
    department: z.string().optional().describe("Department"),
    designation: z.string().optional().describe("Designation/Job title"),
    reportingTo: z.string().optional().describe("Reporting manager's email or employee ID"),
    workPhone: z.string().optional().describe("Work phone number"),
    mobile: z.string().optional().describe("Mobile number"),
    location: z.string().optional().describe("Work location"),
  },
  async ({ recordId, firstName, lastName, email, department, designation, reportingTo, workPhone, mobile, location }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho People credentials available" }] };
    }

    try {
      const client = createZohoPeopleClient(auth);

      const inputData: Record<string, string> = {};

      if (firstName) inputData.FirstName = firstName;
      if (lastName) inputData.LastName = lastName;
      if (email) inputData.EmailID = email;
      if (department) inputData.Department = department;
      if (designation) inputData.Designation = designation;
      if (reportingTo) inputData.Reportingto = reportingTo;
      if (workPhone) inputData.Work_phone = workPhone;
      if (mobile) inputData.Mobile = mobile;
      if (location) inputData.Location = location;

      const result = await client.formRequest<{
        response: {
          result: { message?: string };
        };
      }>("POST", "/forms/json/employee/updateRecord", {
        inputData: JSON.stringify(inputData),
        recordId,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                recordId,
                message: result.response?.result?.message || "Employee updated successfully",
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update employee", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating employee: ${message}` }] };
    }
  }
);

/**
 * Search employees.
 */
server.tool(
  "zoho_people_search_employees",
  {
    searchColumn: z.string().describe("Column to search (e.g., 'FirstName', 'Email', 'Department')"),
    searchValue: z.string().describe("Value to search for"),
    sIndex: z.number().optional().describe("Start index for pagination (default 1)"),
    limit: z.number().optional().describe("Number of records to fetch (max 200)"),
  },
  async ({ searchColumn, searchValue, sIndex, limit }) => {
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
      }>("/forms/employee/getRecords", {
        searchColumn,
        searchValue,
        sIndex: sIndex || 1,
        limit: limit || 200,
      });

      const employees = Array.isArray(result.response?.result)
        ? result.response.result.map((emp) => {
            const empData = Object.values(emp)[0] as Record<string, unknown>;
            return formatEmployee(empData);
          })
        : [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ employees, count: employees.length, searchColumn, searchValue }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to search employees", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error searching employees: ${message}` }] };
    }
  }
);

/**
 * Get team members (employees reporting to a manager).
 */
server.tool(
  "zoho_people_get_team_members",
  {
    managerId: z.string().describe("Manager's employee ID or email to get their direct reports"),
    sIndex: z.number().optional().describe("Start index for pagination (default 1)"),
    limit: z.number().optional().describe("Number of records to fetch (max 200)"),
  },
  async ({ managerId, sIndex, limit }) => {
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
      }>("/forms/employee/getRecords", {
        searchColumn: "Reporting_To",
        searchValue: managerId,
        sIndex: sIndex || 1,
        limit: limit || 200,
      });

      const teamMembers = Array.isArray(result.response?.result)
        ? result.response.result.map((emp) => {
            const empData = Object.values(emp)[0] as Record<string, unknown>;
            return formatEmployee(empData);
          })
        : [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                managerId,
                teamMembers,
                count: teamMembers.length,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get team members", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting team members: ${message}` }] };
    }
  }
);

/**
 * Get employees by department.
 */
server.tool(
  "zoho_people_get_department_employees",
  {
    department: z.string().describe("Department name"),
    sIndex: z.number().optional().describe("Start index for pagination (default 1)"),
    limit: z.number().optional().describe("Number of records to fetch (max 200)"),
  },
  async ({ department, sIndex, limit }) => {
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
      }>("/forms/employee/getRecords", {
        searchColumn: "Department",
        searchValue: department,
        sIndex: sIndex || 1,
        limit: limit || 200,
      });

      const employees = Array.isArray(result.response?.result)
        ? result.response.result.map((emp) => {
            const empData = Object.values(emp)[0] as Record<string, unknown>;
            return formatEmployee(empData);
          })
        : [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                department,
                employees,
                count: employees.length,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get department employees", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting department employees: ${message}` }] };
    }
  }
);

logger.info("Zoho People employee tools registered");

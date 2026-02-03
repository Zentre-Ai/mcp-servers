import { logger } from "./logger.js";
import { getDatacenterConfig, ZohoDatacenter } from "./datacenters.js";

/**
 * Zoho People authentication configuration.
 */
export interface ZohoPeopleAuth {
  accessToken: string;
  datacenter: ZohoDatacenter;
}

/**
 * Zoho People API client for making REST API requests.
 */
export class ZohoPeopleClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(auth: ZohoPeopleAuth) {
    const dcConfig = getDatacenterConfig(auth.datacenter);
    this.baseUrl = `https://${dcConfig.peopleDomain}/people/api`;
    this.accessToken = auth.accessToken;
  }

  /**
   * Make a request to the Zoho People API.
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const params = new URLSearchParams();

    // Add query parameters
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      }
    }

    const queryString = params.toString();
    const url = queryString ? `${this.baseUrl}${path}?${queryString}` : `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Zoho-oauthtoken ${this.accessToken}`,
      Accept: "application/json",
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    logger.debug(`Zoho People API: ${method} ${url}`);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data: Record<string, unknown>;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Invalid JSON response: ${text}`);
    }

    // Zoho People uses response.message.status for success/failure
    const responseData = data.response as Record<string, unknown> | undefined;
    if (responseData) {
      const result = responseData.result as Record<string, unknown> | Array<unknown> | undefined;
      const errors = responseData.errors as Record<string, unknown> | undefined;

      if (errors) {
        const errorMessage = (errors.message as string) || JSON.stringify(errors);
        throw new Error(errorMessage);
      }

      // Return the result if present
      if (result !== undefined) {
        return { response: responseData } as T;
      }
    }

    // For some endpoints, data might be directly returned
    if (!response.ok) {
      const message = (data.message as string) || `Zoho People API error: ${response.status}`;
      throw new Error(message);
    }

    return data as T;
  }

  /**
   * Make a form-encoded request (some Zoho People APIs use form encoding).
   */
  async formRequest<T>(
    method: string,
    path: string,
    formData?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const params = new URLSearchParams();
    if (formData) {
      for (const [key, value] of Object.entries(formData)) {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      }
    }

    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Zoho-oauthtoken ${this.accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    };

    logger.debug(`Zoho People API (form): ${method} ${url}`);

    const response = await fetch(url, {
      method,
      headers,
      body: params.toString(),
    });

    const text = await response.text();
    let data: Record<string, unknown>;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Invalid JSON response: ${text}`);
    }

    const responseData = data.response as Record<string, unknown> | undefined;
    if (responseData) {
      const errors = responseData.errors as Record<string, unknown> | undefined;
      if (errors) {
        const errorMessage = (errors.message as string) || JSON.stringify(errors);
        throw new Error(errorMessage);
      }
    }

    if (!response.ok) {
      const message = (data.message as string) || `Zoho People API error: ${response.status}`;
      throw new Error(message);
    }

    return data as T;
  }

  // Convenience methods
  async get<T>(path: string, queryParams?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>("GET", path, undefined, queryParams);
  }

  async post<T>(path: string, body?: unknown, queryParams?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>("POST", path, body, queryParams);
  }

  async put<T>(path: string, body?: unknown, queryParams?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>("PUT", path, body, queryParams);
  }

  async delete<T>(path: string, queryParams?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>("DELETE", path, undefined, queryParams);
  }
}

/**
 * Extract Zoho People credentials from request headers.
 * Expects:
 *   - Authorization: Bearer <accessToken>
 *   - x-zoho-datacenter: <datacenter> (optional, defaults to 'com')
 */
export function extractZohoPeopleAuth(
  headers: Record<string, string | string[] | undefined>
): ZohoPeopleAuth | null {
  // Extract Bearer token from Authorization header
  const authHeader = headers["authorization"];
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  // Match Bearer token format (OAuth2 standard)
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    return null;
  }
  const accessToken = bearerMatch[1];

  // Extract datacenter (optional, defaults to 'com')
  const datacenter = (headers["x-zoho-datacenter"] as ZohoDatacenter) || "com";

  return { accessToken, datacenter };
}

/**
 * Create a Zoho People client from authentication config.
 */
export function createZohoPeopleClient(auth: ZohoPeopleAuth): ZohoPeopleClient {
  return new ZohoPeopleClient(auth);
}

/**
 * Format employee for response.
 */
export function formatEmployee(employee: Record<string, unknown>): Record<string, unknown> {
  return {
    employeeId: employee.Employeeid || employee.EmployeeID || employee.employeeId,
    firstName: employee.FirstName || employee.firstName,
    lastName: employee.LastName || employee.lastName,
    email: employee.Email || employee.EmailID || employee.email,
    department: employee.Department || employee.department,
    designation: employee.Designation || employee.designation,
    employeeStatus: employee.Employeestatus || employee.EmployeeStatus || employee.employeeStatus,
    dateOfJoining: employee.Dateofjoining || employee.DateOfJoining || employee.dateOfJoining,
    reportingTo: employee.Reportingto || employee.ReportingTo || employee.reportingTo,
    employeeType: employee.Employeetype || employee.EmployeeType || employee.employeeType,
    workPhone: employee.Work_phone || employee.WorkPhone || employee.workPhone,
    mobile: employee.Mobile || employee.mobile,
    location: employee.Location || employee.location,
    photoUrl: employee.Photo || employee.photo,
  };
}

/**
 * Format attendance record for response.
 */
export function formatAttendance(attendance: Record<string, unknown>): Record<string, unknown> {
  return {
    employeeId: attendance.Employeeid || attendance.EmployeeID || attendance.employeeId,
    date: attendance.Date || attendance.date,
    checkIn: attendance.CheckIn || attendance.FirstIn || attendance.checkIn,
    checkOut: attendance.CheckOut || attendance.LastOut || attendance.checkOut,
    totalHours: attendance.TotalHours || attendance.totalHours,
    status: attendance.Status || attendance.status,
    source: attendance.Source || attendance.source,
  };
}

/**
 * Format leave record for response.
 */
export function formatLeave(leave: Record<string, unknown>): Record<string, unknown> {
  return {
    leaveId: leave.ID || leave.Id || leave.id || leave.leaveId,
    employeeId: leave.Employeeid || leave.EmployeeID || leave.employeeId,
    employeeName: leave.Employee_Name || leave.EmployeeName || leave.employeeName,
    leaveType: leave.Leavetype || leave.LeaveType || leave.leaveType,
    from: leave.From || leave.from,
    to: leave.To || leave.to,
    days: leave.Days_Count || leave.DaysCount || leave.days,
    reason: leave.Reason || leave.reason,
    status: leave.ApprovalStatus || leave.Status || leave.status,
    appliedDate: leave.Applieddate || leave.AppliedDate || leave.appliedDate,
  };
}

/**
 * Format form record for response.
 */
export function formatFormRecord(record: Record<string, unknown>): Record<string, unknown> {
  // Form records have dynamic fields, so we return them as-is with some normalization
  const formatted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    // Convert snake_case or PascalCase to camelCase for consistency
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      .replace(/^([A-Z])/, (letter) => letter.toLowerCase());
    formatted[camelKey] = value;
  }

  return formatted;
}

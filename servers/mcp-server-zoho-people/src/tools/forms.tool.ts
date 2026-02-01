import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createZohoPeopleClient, formatFormRecord } from "../utils/zoho-people-client.js";
import { logger } from "../utils/logger.js";

/**
 * List available forms.
 */
server.tool(
  "zoho_people_list_forms",
  {},
  async () => {
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
      }>("/forms");

      const forms = Array.isArray(result.response?.result)
        ? result.response.result.map((form) => ({
            formLinkName: form.formLinkName || form.componentName,
            displayName: form.displayName || form.componentLabel,
            componentId: form.componentId,
            isSystemForm: form.isSystemForm,
          }))
        : [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ forms, count: forms.length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list forms", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing forms: ${message}` }] };
    }
  }
);

/**
 * Get records from a form.
 */
server.tool(
  "zoho_people_get_form_records",
  {
    formLinkName: z.string().describe("Form link name (e.g., 'employee', 'leave', 'P_Attendance')"),
    sIndex: z.number().optional().describe("Start index for pagination (default 1)"),
    limit: z.number().optional().describe("Number of records to fetch (max 200)"),
    searchColumn: z.string().optional().describe("Column to search"),
    searchValue: z.string().optional().describe("Value to search for"),
  },
  async ({ formLinkName, sIndex, limit, searchColumn, searchValue }) => {
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
        };
      }>(`/forms/${formLinkName}/getRecords`, params);

      const records = Array.isArray(result.response?.result)
        ? result.response.result.map((record) => {
            // Handle nested structure
            const recordData = Object.values(record)[0] as Record<string, unknown>;
            return formatFormRecord(recordData);
          })
        : [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ formLinkName, records, count: records.length }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get form records", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting form records: ${message}` }] };
    }
  }
);

/**
 * Add a record to a form.
 */
server.tool(
  "zoho_people_add_form_record",
  {
    formLinkName: z.string().describe("Form link name (e.g., 'employee', 'leave')"),
    inputData: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).describe("Field values as key-value pairs"),
  },
  async ({ formLinkName, inputData }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho People credentials available" }] };
    }

    try {
      const client = createZohoPeopleClient(auth);

      const result = await client.formRequest<{
        response: {
          result: { pkId?: string; message?: string };
        };
      }>("POST", `/forms/json/${formLinkName}/insertRecord`, {
        inputData: JSON.stringify(inputData),
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                formLinkName,
                recordId: result.response?.result?.pkId,
                message: result.response?.result?.message || "Record added successfully",
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to add form record", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error adding form record: ${message}` }] };
    }
  }
);

/**
 * Update a record in a form.
 */
server.tool(
  "zoho_people_update_form_record",
  {
    formLinkName: z.string().describe("Form link name (e.g., 'employee', 'leave')"),
    recordId: z.string().describe("Record ID to update"),
    inputData: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).describe("Field values to update as key-value pairs"),
  },
  async ({ formLinkName, recordId, inputData }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho People credentials available" }] };
    }

    try {
      const client = createZohoPeopleClient(auth);

      const result = await client.formRequest<{
        response: {
          result: { message?: string };
        };
      }>("POST", `/forms/json/${formLinkName}/updateRecord`, {
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
                formLinkName,
                recordId,
                message: result.response?.result?.message || "Record updated successfully",
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update form record", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating form record: ${message}` }] };
    }
  }
);

logger.info("Zoho People form tools registered");

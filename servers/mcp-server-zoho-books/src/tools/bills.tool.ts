import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createZohoBooksClient, formatBill } from "../utils/zoho-books-client.js";
import { logger } from "../utils/logger.js";

/**
 * List bills.
 */
server.tool(
  "zoho_books_list_bills",
  {
    page: z.number().optional().describe("Page number (default 1)"),
    perPage: z.number().optional().describe("Number of bills per page (max 200)"),
    status: z.enum(["draft", "open", "overdue", "paid", "void", "partially_paid"]).optional().describe("Filter by bill status"),
    vendorId: z.string().optional().describe("Filter by vendor ID"),
    billNumber: z.string().optional().describe("Search by bill number"),
    referenceNumber: z.string().optional().describe("Search by reference number"),
    dateStart: z.string().optional().describe("Filter bills from this date (YYYY-MM-DD)"),
    dateEnd: z.string().optional().describe("Filter bills until this date (YYYY-MM-DD)"),
    sortColumn: z.enum(["vendor_name", "bill_number", "date", "due_date", "total", "balance", "created_time"]).optional().describe("Column to sort by"),
    sortOrder: z.enum(["ascending", "descending"]).optional().describe("Sort order"),
  },
  async ({ page, perPage, status, vendorId, billNumber, referenceNumber, dateStart, dateEnd, sortColumn, sortOrder }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);
      const result = await client.get<{
        bills: Array<Record<string, unknown>>;
        page_context: { page: number; per_page: number; has_more_page: boolean; total: number };
      }>("/bills", {
        page,
        per_page: perPage,
        status,
        vendor_id: vendorId,
        bill_number: billNumber,
        reference_number: referenceNumber,
        date_start: dateStart,
        date_end: dateEnd,
        sort_column: sortColumn,
        sort_order: sortOrder,
      });

      const bills = result.bills.map(formatBill);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                bills,
                pageContext: {
                  page: result.page_context.page,
                  perPage: result.page_context.per_page,
                  hasMorePage: result.page_context.has_more_page,
                  total: result.page_context.total,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list bills", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing bills: ${message}` }] };
    }
  }
);

/**
 * Get a bill by ID.
 */
server.tool(
  "zoho_books_get_bill",
  {
    billId: z.string().describe("Bill ID"),
  },
  async ({ billId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);
      const result = await client.get<{ bill: Record<string, unknown> }>(`/bills/${billId}`);

      return { content: [{ type: "text", text: JSON.stringify(formatBill(result.bill), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get bill", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting bill: ${message}` }] };
    }
  }
);

/**
 * Create a new bill.
 */
server.tool(
  "zoho_books_create_bill",
  {
    vendorId: z.string().describe("Vendor ID"),
    billNumber: z.string().optional().describe("Bill number (auto-generated if not provided)"),
    referenceNumber: z.string().optional().describe("Reference number"),
    date: z.string().optional().describe("Bill date (YYYY-MM-DD, defaults to today)"),
    dueDate: z.string().optional().describe("Due date (YYYY-MM-DD)"),
    paymentTerms: z.number().optional().describe("Payment terms in days"),
    lineItems: z.array(z.object({
      itemId: z.string().optional().describe("Item ID"),
      accountId: z.string().optional().describe("Account ID"),
      name: z.string().describe("Item name"),
      description: z.string().optional().describe("Item description"),
      rate: z.number().describe("Unit price"),
      quantity: z.number().describe("Quantity"),
      unit: z.string().optional().describe("Unit"),
      taxId: z.string().optional().describe("Tax ID"),
      customerId: z.string().optional().describe("Customer ID (for billable expenses)"),
    })).describe("Line items for the bill"),
    notes: z.string().optional().describe("Notes"),
    terms: z.string().optional().describe("Terms and conditions"),
  },
  async ({ vendorId, billNumber, referenceNumber, date, dueDate, paymentTerms, lineItems, notes, terms }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);

      const billData: Record<string, unknown> = {
        vendor_id: vendorId,
        line_items: lineItems.map((item) => ({
          item_id: item.itemId,
          account_id: item.accountId,
          name: item.name,
          description: item.description,
          rate: item.rate,
          quantity: item.quantity,
          unit: item.unit,
          tax_id: item.taxId,
          customer_id: item.customerId,
        })),
      };

      if (billNumber) billData.bill_number = billNumber;
      if (referenceNumber) billData.reference_number = referenceNumber;
      if (date) billData.date = date;
      if (dueDate) billData.due_date = dueDate;
      if (paymentTerms !== undefined) billData.payment_terms = paymentTerms;
      if (notes) billData.notes = notes;
      if (terms) billData.terms = terms;

      const result = await client.post<{ bill: Record<string, unknown> }>("/bills", billData);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, bill: formatBill(result.bill) }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create bill", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating bill: ${message}` }] };
    }
  }
);

/**
 * Update a bill.
 */
server.tool(
  "zoho_books_update_bill",
  {
    billId: z.string().describe("Bill ID to update"),
    vendorId: z.string().optional().describe("Vendor ID"),
    billNumber: z.string().optional().describe("Bill number"),
    referenceNumber: z.string().optional().describe("Reference number"),
    date: z.string().optional().describe("Bill date (YYYY-MM-DD)"),
    dueDate: z.string().optional().describe("Due date (YYYY-MM-DD)"),
    paymentTerms: z.number().optional().describe("Payment terms in days"),
    lineItems: z.array(z.object({
      lineItemId: z.string().optional().describe("Line item ID (for existing items)"),
      itemId: z.string().optional().describe("Item ID"),
      accountId: z.string().optional().describe("Account ID"),
      name: z.string().describe("Item name"),
      description: z.string().optional().describe("Item description"),
      rate: z.number().describe("Unit price"),
      quantity: z.number().describe("Quantity"),
      unit: z.string().optional().describe("Unit"),
      taxId: z.string().optional().describe("Tax ID"),
    })).optional().describe("Line items for the bill"),
    notes: z.string().optional().describe("Notes"),
    terms: z.string().optional().describe("Terms and conditions"),
  },
  async ({ billId, vendorId, billNumber, referenceNumber, date, dueDate, paymentTerms, lineItems, notes, terms }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);

      const billData: Record<string, unknown> = {};

      if (vendorId) billData.vendor_id = vendorId;
      if (billNumber) billData.bill_number = billNumber;
      if (referenceNumber) billData.reference_number = referenceNumber;
      if (date) billData.date = date;
      if (dueDate) billData.due_date = dueDate;
      if (paymentTerms !== undefined) billData.payment_terms = paymentTerms;
      if (notes) billData.notes = notes;
      if (terms) billData.terms = terms;
      if (lineItems) {
        billData.line_items = lineItems.map((item) => ({
          line_item_id: item.lineItemId,
          item_id: item.itemId,
          account_id: item.accountId,
          name: item.name,
          description: item.description,
          rate: item.rate,
          quantity: item.quantity,
          unit: item.unit,
          tax_id: item.taxId,
        }));
      }

      const result = await client.put<{ bill: Record<string, unknown> }>(`/bills/${billId}`, billData);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, bill: formatBill(result.bill) }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update bill", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating bill: ${message}` }] };
    }
  }
);

/**
 * Delete a bill.
 */
server.tool(
  "zoho_books_delete_bill",
  {
    billId: z.string().describe("Bill ID to delete"),
  },
  async ({ billId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);
      await client.delete(`/bills/${billId}`);

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, billId, deleted: true }, null, 2) }],
      };
    } catch (error) {
      logger.error("Failed to delete bill", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting bill: ${message}` }] };
    }
  }
);

logger.info("Zoho Books bill tools registered");

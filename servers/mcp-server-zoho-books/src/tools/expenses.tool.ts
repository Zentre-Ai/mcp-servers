import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createZohoBooksClient, formatExpense } from "../utils/zoho-books-client.js";
import { logger } from "../utils/logger.js";

/**
 * List expenses.
 */
server.tool(
  "zoho_books_list_expenses",
  {
    page: z.number().optional().describe("Page number (default 1)"),
    perPage: z.number().optional().describe("Number of expenses per page (max 200)"),
    status: z.enum(["unbilled", "invoiced", "reimbursed", "non-billable"]).optional().describe("Filter by expense status"),
    accountId: z.string().optional().describe("Filter by expense account ID"),
    customerId: z.string().optional().describe("Filter by customer ID"),
    vendorId: z.string().optional().describe("Filter by vendor ID"),
    dateStart: z.string().optional().describe("Filter expenses from this date (YYYY-MM-DD)"),
    dateEnd: z.string().optional().describe("Filter expenses until this date (YYYY-MM-DD)"),
    sortColumn: z.enum(["date", "account_name", "total", "created_time", "last_modified_time"]).optional().describe("Column to sort by"),
    sortOrder: z.enum(["ascending", "descending"]).optional().describe("Sort order"),
  },
  async ({ page, perPage, status, accountId, customerId, vendorId, dateStart, dateEnd, sortColumn, sortOrder }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);
      const result = await client.get<{
        expenses: Array<Record<string, unknown>>;
        page_context: { page: number; per_page: number; has_more_page: boolean; total: number };
      }>("/expenses", {
        page,
        per_page: perPage,
        status,
        account_id: accountId,
        customer_id: customerId,
        vendor_id: vendorId,
        date_start: dateStart,
        date_end: dateEnd,
        sort_column: sortColumn,
        sort_order: sortOrder,
      });

      const expenses = result.expenses.map(formatExpense);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                expenses,
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
      logger.error("Failed to list expenses", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing expenses: ${message}` }] };
    }
  }
);

/**
 * Get an expense by ID.
 */
server.tool(
  "zoho_books_get_expense",
  {
    expenseId: z.string().describe("Expense ID"),
  },
  async ({ expenseId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);
      const result = await client.get<{ expense: Record<string, unknown> }>(`/expenses/${expenseId}`);

      return { content: [{ type: "text", text: JSON.stringify(formatExpense(result.expense), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get expense", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting expense: ${message}` }] };
    }
  }
);

/**
 * Create a new expense.
 */
server.tool(
  "zoho_books_create_expense",
  {
    accountId: z.string().describe("Expense account ID"),
    paidThroughAccountId: z.string().describe("Account ID used to pay the expense"),
    date: z.string().describe("Expense date (YYYY-MM-DD)"),
    amount: z.number().describe("Expense amount"),
    description: z.string().optional().describe("Expense description"),
    referenceNumber: z.string().optional().describe("Reference number"),
    customerId: z.string().optional().describe("Customer ID (for billable expenses)"),
    vendorId: z.string().optional().describe("Vendor ID"),
    isBillable: z.boolean().optional().describe("Whether the expense is billable to customer"),
    taxId: z.string().optional().describe("Tax ID"),
    isInclusiveTax: z.boolean().optional().describe("Whether amount is inclusive of tax"),
    projectId: z.string().optional().describe("Project ID"),
    currencyId: z.string().optional().describe("Currency ID"),
    exchangeRate: z.number().optional().describe("Exchange rate"),
  },
  async ({ accountId, paidThroughAccountId, date, amount, description, referenceNumber, customerId, vendorId, isBillable, taxId, isInclusiveTax, projectId, currencyId, exchangeRate }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);

      const expenseData: Record<string, unknown> = {
        account_id: accountId,
        paid_through_account_id: paidThroughAccountId,
        date,
        amount,
      };

      if (description) expenseData.description = description;
      if (referenceNumber) expenseData.reference_number = referenceNumber;
      if (customerId) expenseData.customer_id = customerId;
      if (vendorId) expenseData.vendor_id = vendorId;
      if (isBillable !== undefined) expenseData.is_billable = isBillable;
      if (taxId) expenseData.tax_id = taxId;
      if (isInclusiveTax !== undefined) expenseData.is_inclusive_tax = isInclusiveTax;
      if (projectId) expenseData.project_id = projectId;
      if (currencyId) expenseData.currency_id = currencyId;
      if (exchangeRate !== undefined) expenseData.exchange_rate = exchangeRate;

      const result = await client.post<{ expense: Record<string, unknown> }>("/expenses", expenseData);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, expense: formatExpense(result.expense) }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create expense", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating expense: ${message}` }] };
    }
  }
);

/**
 * Delete an expense.
 */
server.tool(
  "zoho_books_delete_expense",
  {
    expenseId: z.string().describe("Expense ID to delete"),
  },
  async ({ expenseId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);
      await client.delete(`/expenses/${expenseId}`);

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, expenseId, deleted: true }, null, 2) }],
      };
    } catch (error) {
      logger.error("Failed to delete expense", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting expense: ${message}` }] };
    }
  }
);

logger.info("Zoho Books expense tools registered");

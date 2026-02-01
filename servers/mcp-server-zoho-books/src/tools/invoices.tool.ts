import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createZohoBooksClient, formatInvoice } from "../utils/zoho-books-client.js";
import { logger } from "../utils/logger.js";

/**
 * List invoices.
 */
server.tool(
  "zoho_books_list_invoices",
  {
    page: z.number().optional().describe("Page number (default 1)"),
    perPage: z.number().optional().describe("Number of invoices per page (max 200)"),
    status: z.enum(["draft", "sent", "overdue", "paid", "void", "unpaid", "partially_paid"]).optional().describe("Filter by invoice status"),
    customerId: z.string().optional().describe("Filter by customer ID"),
    invoiceNumber: z.string().optional().describe("Search by invoice number"),
    referenceNumber: z.string().optional().describe("Search by reference number"),
    dateStart: z.string().optional().describe("Filter invoices from this date (YYYY-MM-DD)"),
    dateEnd: z.string().optional().describe("Filter invoices until this date (YYYY-MM-DD)"),
    sortColumn: z.enum(["customer_name", "invoice_number", "date", "due_date", "total", "balance", "created_time"]).optional().describe("Column to sort by"),
    sortOrder: z.enum(["ascending", "descending"]).optional().describe("Sort order"),
  },
  async ({ page, perPage, status, customerId, invoiceNumber, referenceNumber, dateStart, dateEnd, sortColumn, sortOrder }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);
      const result = await client.get<{
        invoices: Array<Record<string, unknown>>;
        page_context: { page: number; per_page: number; has_more_page: boolean; total: number };
      }>("/invoices", {
        page,
        per_page: perPage,
        status,
        customer_id: customerId,
        invoice_number: invoiceNumber,
        reference_number: referenceNumber,
        date_start: dateStart,
        date_end: dateEnd,
        sort_column: sortColumn,
        sort_order: sortOrder,
      });

      const invoices = result.invoices.map(formatInvoice);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                invoices,
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
      logger.error("Failed to list invoices", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing invoices: ${message}` }] };
    }
  }
);

/**
 * Get an invoice by ID.
 */
server.tool(
  "zoho_books_get_invoice",
  {
    invoiceId: z.string().describe("Invoice ID"),
  },
  async ({ invoiceId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);
      const result = await client.get<{ invoice: Record<string, unknown> }>(`/invoices/${invoiceId}`);

      return { content: [{ type: "text", text: JSON.stringify(formatInvoice(result.invoice), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get invoice", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting invoice: ${message}` }] };
    }
  }
);

/**
 * Create a new invoice.
 */
server.tool(
  "zoho_books_create_invoice",
  {
    customerId: z.string().describe("Customer ID"),
    invoiceNumber: z.string().optional().describe("Invoice number (auto-generated if not provided)"),
    referenceNumber: z.string().optional().describe("Reference number"),
    date: z.string().optional().describe("Invoice date (YYYY-MM-DD, defaults to today)"),
    dueDate: z.string().optional().describe("Due date (YYYY-MM-DD)"),
    paymentTerms: z.number().optional().describe("Payment terms in days"),
    paymentTermsLabel: z.string().optional().describe("Payment terms label"),
    discount: z.number().optional().describe("Discount amount or percentage"),
    isDiscountBeforeTax: z.boolean().optional().describe("Apply discount before tax"),
    discountType: z.enum(["entity_level", "item_level"]).optional().describe("Discount type"),
    lineItems: z.array(z.object({
      itemId: z.string().optional().describe("Item ID"),
      name: z.string().describe("Item name"),
      description: z.string().optional().describe("Item description"),
      rate: z.number().describe("Unit price"),
      quantity: z.number().describe("Quantity"),
      unit: z.string().optional().describe("Unit"),
      discount: z.number().optional().describe("Discount for this line item"),
      taxId: z.string().optional().describe("Tax ID"),
    })).describe("Line items for the invoice"),
    notes: z.string().optional().describe("Customer notes"),
    terms: z.string().optional().describe("Terms and conditions"),
    salespersonName: z.string().optional().describe("Salesperson name"),
  },
  async ({ customerId, invoiceNumber, referenceNumber, date, dueDate, paymentTerms, paymentTermsLabel, discount, isDiscountBeforeTax, discountType, lineItems, notes, terms, salespersonName }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);

      const invoiceData: Record<string, unknown> = {
        customer_id: customerId,
        line_items: lineItems.map((item) => ({
          item_id: item.itemId,
          name: item.name,
          description: item.description,
          rate: item.rate,
          quantity: item.quantity,
          unit: item.unit,
          discount: item.discount,
          tax_id: item.taxId,
        })),
      };

      if (invoiceNumber) invoiceData.invoice_number = invoiceNumber;
      if (referenceNumber) invoiceData.reference_number = referenceNumber;
      if (date) invoiceData.date = date;
      if (dueDate) invoiceData.due_date = dueDate;
      if (paymentTerms !== undefined) invoiceData.payment_terms = paymentTerms;
      if (paymentTermsLabel) invoiceData.payment_terms_label = paymentTermsLabel;
      if (discount !== undefined) invoiceData.discount = discount;
      if (isDiscountBeforeTax !== undefined) invoiceData.is_discount_before_tax = isDiscountBeforeTax;
      if (discountType) invoiceData.discount_type = discountType;
      if (notes) invoiceData.notes = notes;
      if (terms) invoiceData.terms = terms;
      if (salespersonName) invoiceData.salesperson_name = salespersonName;

      const result = await client.post<{ invoice: Record<string, unknown> }>("/invoices", invoiceData);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                invoice: formatInvoice(result.invoice),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create invoice", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating invoice: ${message}` }] };
    }
  }
);

/**
 * Update an invoice.
 */
server.tool(
  "zoho_books_update_invoice",
  {
    invoiceId: z.string().describe("Invoice ID to update"),
    customerId: z.string().optional().describe("Customer ID"),
    invoiceNumber: z.string().optional().describe("Invoice number"),
    referenceNumber: z.string().optional().describe("Reference number"),
    date: z.string().optional().describe("Invoice date (YYYY-MM-DD)"),
    dueDate: z.string().optional().describe("Due date (YYYY-MM-DD)"),
    paymentTerms: z.number().optional().describe("Payment terms in days"),
    discount: z.number().optional().describe("Discount amount or percentage"),
    lineItems: z.array(z.object({
      lineItemId: z.string().optional().describe("Line item ID (for existing items)"),
      itemId: z.string().optional().describe("Item ID"),
      name: z.string().describe("Item name"),
      description: z.string().optional().describe("Item description"),
      rate: z.number().describe("Unit price"),
      quantity: z.number().describe("Quantity"),
      unit: z.string().optional().describe("Unit"),
      discount: z.number().optional().describe("Discount for this line item"),
      taxId: z.string().optional().describe("Tax ID"),
    })).optional().describe("Line items for the invoice"),
    notes: z.string().optional().describe("Customer notes"),
    terms: z.string().optional().describe("Terms and conditions"),
  },
  async ({ invoiceId, customerId, invoiceNumber, referenceNumber, date, dueDate, paymentTerms, discount, lineItems, notes, terms }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);

      const invoiceData: Record<string, unknown> = {};

      if (customerId) invoiceData.customer_id = customerId;
      if (invoiceNumber) invoiceData.invoice_number = invoiceNumber;
      if (referenceNumber) invoiceData.reference_number = referenceNumber;
      if (date) invoiceData.date = date;
      if (dueDate) invoiceData.due_date = dueDate;
      if (paymentTerms !== undefined) invoiceData.payment_terms = paymentTerms;
      if (discount !== undefined) invoiceData.discount = discount;
      if (notes) invoiceData.notes = notes;
      if (terms) invoiceData.terms = terms;
      if (lineItems) {
        invoiceData.line_items = lineItems.map((item) => ({
          line_item_id: item.lineItemId,
          item_id: item.itemId,
          name: item.name,
          description: item.description,
          rate: item.rate,
          quantity: item.quantity,
          unit: item.unit,
          discount: item.discount,
          tax_id: item.taxId,
        }));
      }

      const result = await client.put<{ invoice: Record<string, unknown> }>(`/invoices/${invoiceId}`, invoiceData);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, invoice: formatInvoice(result.invoice) }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update invoice", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating invoice: ${message}` }] };
    }
  }
);

/**
 * Delete an invoice.
 */
server.tool(
  "zoho_books_delete_invoice",
  {
    invoiceId: z.string().describe("Invoice ID to delete"),
  },
  async ({ invoiceId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);
      await client.delete(`/invoices/${invoiceId}`);

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, invoiceId, deleted: true }, null, 2) }],
      };
    } catch (error) {
      logger.error("Failed to delete invoice", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting invoice: ${message}` }] };
    }
  }
);

/**
 * Email an invoice to customer.
 */
server.tool(
  "zoho_books_email_invoice",
  {
    invoiceId: z.string().describe("Invoice ID to email"),
    toMailIds: z.array(z.string()).describe("Email addresses to send to"),
    ccMailIds: z.array(z.string()).optional().describe("CC email addresses"),
    subject: z.string().optional().describe("Email subject"),
    body: z.string().optional().describe("Email body"),
    sendFromOrgEmailId: z.boolean().optional().describe("Send from organization email"),
  },
  async ({ invoiceId, toMailIds, ccMailIds, subject, body, sendFromOrgEmailId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);

      const emailData: Record<string, unknown> = {
        to_mail_ids: toMailIds,
      };

      if (ccMailIds) emailData.cc_mail_ids = ccMailIds;
      if (subject) emailData.subject = subject;
      if (body) emailData.body = body;
      if (sendFromOrgEmailId !== undefined) emailData.send_from_org_email_id = sendFromOrgEmailId;

      await client.post(`/invoices/${invoiceId}/email`, emailData);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, invoiceId, emailed: true, recipients: toMailIds }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to email invoice", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error emailing invoice: ${message}` }] };
    }
  }
);

logger.info("Zoho Books invoice tools registered");

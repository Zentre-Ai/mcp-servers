import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createStripeClient, getStripeOptions, formatInvoice, formatStripeError } from "../utils/stripe-client.js";
import { logger } from "../utils/logger.js";

/**
 * List invoices with pagination and filters.
 */
server.tool(
  "stripe_list_invoices",
  {
    limit: z.number().min(1).max(100).optional().describe("Number of invoices to return (1-100, default 10)"),
    startingAfter: z.string().optional().describe("Cursor for pagination - invoice ID to start after"),
    endingBefore: z.string().optional().describe("Cursor for pagination - invoice ID to end before"),
    customer: z.string().optional().describe("Filter by customer ID"),
    subscription: z.string().optional().describe("Filter by subscription ID"),
    status: z.enum(["draft", "open", "paid", "uncollectible", "void"]).optional().describe("Filter by invoice status"),
    collectionMethod: z.enum(["charge_automatically", "send_invoice"]).optional().describe("Filter by collection method"),
    created: z.object({
      gt: z.number().optional().describe("Return items created after this Unix timestamp"),
      gte: z.number().optional().describe("Return items created at or after this Unix timestamp"),
      lt: z.number().optional().describe("Return items created before this Unix timestamp"),
      lte: z.number().optional().describe("Return items created at or before this Unix timestamp"),
    }).optional().describe("Filter by creation date"),
  },
  async ({ limit, startingAfter, endingBefore, customer, subscription, status, collectionMethod, created }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const invoices = await stripe.invoices.list(
        {
          limit: limit || 10,
          starting_after: startingAfter,
          ending_before: endingBefore,
          customer,
          subscription,
          status,
          collection_method: collectionMethod,
          created,
        },
        options
      );

      const result = {
        invoices: invoices.data.map(formatInvoice),
        hasMore: invoices.has_more,
        total: invoices.data.length,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list invoices", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Get an invoice by ID.
 */
server.tool(
  "stripe_get_invoice",
  {
    invoiceId: z.string().describe("The invoice ID (e.g., 'in_xxx')"),
  },
  async ({ invoiceId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const invoice = await stripe.invoices.retrieve(invoiceId, options);

      return { content: [{ type: "text", text: JSON.stringify(formatInvoice(invoice), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get invoice", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Create an invoice.
 */
server.tool(
  "stripe_create_invoice",
  {
    customer: z.string().describe("Customer ID for the invoice"),
    description: z.string().optional().describe("Description for the invoice"),
    metadata: z.record(z.string()).optional().describe("Custom metadata key-value pairs"),
    autoAdvance: z.boolean().optional().describe("Auto-finalize the invoice (default: true)"),
    collectionMethod: z.enum(["charge_automatically", "send_invoice"]).optional().describe("How to collect payment"),
    daysUntilDue: z.number().int().positive().optional().describe("Days until invoice is due (only for send_invoice)"),
    footer: z.string().optional().describe("Footer text for the invoice"),
  },
  async ({ customer, description, metadata, autoAdvance, collectionMethod, daysUntilDue, footer }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const invoice = await stripe.invoices.create(
        {
          customer,
          description,
          metadata,
          auto_advance: autoAdvance,
          collection_method: collectionMethod,
          days_until_due: daysUntilDue,
          footer,
        },
        options
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                invoice: formatInvoice(invoice),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create invoice", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Add an invoice item to a draft invoice.
 */
server.tool(
  "stripe_create_invoice_item",
  {
    customer: z.string().describe("Customer ID"),
    invoice: z.string().optional().describe("Invoice ID to add the item to (if not provided, will be added to next invoice)"),
    price: z.string().optional().describe("Price ID for the item"),
    amount: z.number().int().optional().describe("Amount in smallest currency unit (alternative to price)"),
    currency: z.string().length(3).optional().describe("Currency code (required if using amount)"),
    description: z.string().optional().describe("Description of the line item"),
    quantity: z.number().int().positive().optional().describe("Quantity of the item"),
    metadata: z.record(z.string()).optional().describe("Custom metadata"),
  },
  async ({ customer, invoice, price, amount, currency, description, quantity, metadata }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const invoiceItem = await stripe.invoiceItems.create(
        {
          customer,
          invoice,
          price,
          amount,
          currency: currency?.toLowerCase(),
          description,
          quantity,
          metadata,
        },
        options
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                invoiceItem: {
                  id: invoiceItem.id,
                  invoice: invoiceItem.invoice,
                  amount: invoiceItem.amount,
                  currency: invoiceItem.currency,
                  description: invoiceItem.description,
                  quantity: invoiceItem.quantity,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create invoice item", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Finalize a draft invoice.
 */
server.tool(
  "stripe_finalize_invoice",
  {
    invoiceId: z.string().describe("The invoice ID to finalize"),
    autoAdvance: z.boolean().optional().describe("Whether to auto-advance the invoice after finalizing"),
  },
  async ({ invoiceId, autoAdvance }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const invoice = await stripe.invoices.finalizeInvoice(
        invoiceId,
        {
          auto_advance: autoAdvance,
        },
        options
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                invoice: formatInvoice(invoice),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to finalize invoice", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Pay an invoice.
 */
server.tool(
  "stripe_pay_invoice",
  {
    invoiceId: z.string().describe("The invoice ID to pay"),
    paymentMethod: z.string().optional().describe("Payment method ID to use"),
    source: z.string().optional().describe("Source ID to use (legacy)"),
  },
  async ({ invoiceId, paymentMethod, source }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const invoice = await stripe.invoices.pay(
        invoiceId,
        {
          payment_method: paymentMethod,
          source,
        },
        options
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                invoice: formatInvoice(invoice),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to pay invoice", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Send an invoice for manual payment.
 */
server.tool(
  "stripe_send_invoice",
  {
    invoiceId: z.string().describe("The invoice ID to send"),
  },
  async ({ invoiceId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const invoice = await stripe.invoices.sendInvoice(invoiceId, options);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: "Invoice sent",
                invoice: formatInvoice(invoice),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to send invoice", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Void an invoice.
 */
server.tool(
  "stripe_void_invoice",
  {
    invoiceId: z.string().describe("The invoice ID to void"),
  },
  async ({ invoiceId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const invoice = await stripe.invoices.voidInvoice(invoiceId, options);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                invoice: formatInvoice(invoice),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to void invoice", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Search invoices.
 */
server.tool(
  "stripe_search_invoices",
  {
    query: z.string().describe("Search query using Stripe's search query language (e.g., \"status:'paid'\" or \"customer:'cus_xxx'\")"),
    limit: z.number().min(1).max(100).optional().describe("Number of results to return (1-100, default 10)"),
  },
  async ({ query, limit }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const results = await stripe.invoices.search(
        {
          query,
          limit: limit || 10,
        },
        options
      );

      const result = {
        invoices: results.data.map(formatInvoice),
        hasMore: results.has_more,
        total: results.data.length,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to search invoices", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

logger.info("Stripe invoice tools registered");

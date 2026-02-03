import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createStripeClient, getStripeOptions, formatCustomer, formatStripeError } from "../utils/stripe-client.js";
import { logger } from "../utils/logger.js";

/**
 * List customers with pagination and filters.
 */
server.tool(
  "stripe_list_customers",
  {
    limit: z.number().min(1).max(100).optional().describe("Number of customers to return (1-100, default 10)"),
    startingAfter: z.string().optional().describe("Cursor for pagination - customer ID to start after"),
    endingBefore: z.string().optional().describe("Cursor for pagination - customer ID to end before"),
    email: z.string().optional().describe("Filter by customer email address"),
    created: z.object({
      gt: z.number().optional().describe("Return customers created after this Unix timestamp"),
      gte: z.number().optional().describe("Return customers created at or after this Unix timestamp"),
      lt: z.number().optional().describe("Return customers created before this Unix timestamp"),
      lte: z.number().optional().describe("Return customers created at or before this Unix timestamp"),
    }).optional().describe("Filter by creation date"),
  },
  async ({ limit, startingAfter, endingBefore, email, created }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const customers = await stripe.customers.list(
        {
          limit: limit || 10,
          starting_after: startingAfter,
          ending_before: endingBefore,
          email,
          created,
        },
        options
      );

      const result = {
        customers: customers.data.map(formatCustomer),
        hasMore: customers.has_more,
        total: customers.data.length,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list customers", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Get a customer by ID.
 */
server.tool(
  "stripe_get_customer",
  {
    customerId: z.string().describe("The Stripe customer ID (e.g., 'cus_xxx')"),
  },
  async ({ customerId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const customer = await stripe.customers.retrieve(customerId, options);

      return { content: [{ type: "text", text: JSON.stringify(formatCustomer(customer), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get customer", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Create a new customer.
 */
server.tool(
  "stripe_create_customer",
  {
    email: z.string().optional().describe("Customer email address"),
    name: z.string().optional().describe("Customer full name"),
    phone: z.string().optional().describe("Customer phone number"),
    description: z.string().optional().describe("Description of the customer"),
    metadata: z.record(z.string()).optional().describe("Custom metadata key-value pairs"),
    paymentMethod: z.string().optional().describe("Payment method ID to attach and set as default"),
  },
  async ({ email, name, phone, description, metadata, paymentMethod }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const customer = await stripe.customers.create(
        {
          email,
          name,
          phone,
          description,
          metadata,
          payment_method: paymentMethod,
          invoice_settings: paymentMethod
            ? { default_payment_method: paymentMethod }
            : undefined,
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
                customer: formatCustomer(customer),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create customer", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Update an existing customer.
 */
server.tool(
  "stripe_update_customer",
  {
    customerId: z.string().describe("The Stripe customer ID to update"),
    email: z.string().optional().describe("New email address"),
    name: z.string().optional().describe("New full name"),
    phone: z.string().optional().describe("New phone number"),
    description: z.string().optional().describe("New description"),
    metadata: z.record(z.string()).optional().describe("Metadata to merge (use empty string to delete a key)"),
    defaultPaymentMethod: z.string().optional().describe("Payment method ID to set as default"),
  },
  async ({ customerId, email, name, phone, description, metadata, defaultPaymentMethod }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const customer = await stripe.customers.update(
        customerId,
        {
          email,
          name,
          phone,
          description,
          metadata,
          invoice_settings: defaultPaymentMethod
            ? { default_payment_method: defaultPaymentMethod }
            : undefined,
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
                customer: formatCustomer(customer),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update customer", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Delete a customer.
 */
server.tool(
  "stripe_delete_customer",
  {
    customerId: z.string().describe("The Stripe customer ID to delete"),
  },
  async ({ customerId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const deleted = await stripe.customers.del(customerId, options);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                id: deleted.id,
                deleted: deleted.deleted,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to delete customer", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Search customers.
 */
server.tool(
  "stripe_search_customers",
  {
    query: z.string().describe("Search query using Stripe's search query language (e.g., \"email:'test@example.com'\" or \"metadata['key']:'value'\")"),
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

      const results = await stripe.customers.search(
        {
          query,
          limit: limit || 10,
        },
        options
      );

      const result = {
        customers: results.data.map(formatCustomer),
        hasMore: results.has_more,
        total: results.data.length,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to search customers", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

logger.info("Stripe customer tools registered");

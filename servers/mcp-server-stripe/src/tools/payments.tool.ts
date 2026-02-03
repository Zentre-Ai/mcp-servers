import { z } from "zod";
import Stripe from "stripe";
import { server, getCurrentAuth } from "../server.js";
import { createStripeClient, getStripeOptions, formatPaymentIntent, formatStripeError } from "../utils/stripe-client.js";
import { logger } from "../utils/logger.js";

/**
 * List payment intents with pagination and filters.
 */
server.tool(
  "stripe_list_payment_intents",
  {
    limit: z.number().min(1).max(100).optional().describe("Number of payment intents to return (1-100, default 10)"),
    startingAfter: z.string().optional().describe("Cursor for pagination - payment intent ID to start after"),
    endingBefore: z.string().optional().describe("Cursor for pagination - payment intent ID to end before"),
    customer: z.string().optional().describe("Filter by customer ID"),
    created: z.object({
      gt: z.number().optional().describe("Return items created after this Unix timestamp"),
      gte: z.number().optional().describe("Return items created at or after this Unix timestamp"),
      lt: z.number().optional().describe("Return items created before this Unix timestamp"),
      lte: z.number().optional().describe("Return items created at or before this Unix timestamp"),
    }).optional().describe("Filter by creation date"),
  },
  async ({ limit, startingAfter, endingBefore, customer, created }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const paymentIntents = await stripe.paymentIntents.list(
        {
          limit: limit || 10,
          starting_after: startingAfter,
          ending_before: endingBefore,
          customer,
          created,
        },
        options
      );

      const result = {
        paymentIntents: paymentIntents.data.map(formatPaymentIntent),
        hasMore: paymentIntents.has_more,
        total: paymentIntents.data.length,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list payment intents", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Get a payment intent by ID.
 */
server.tool(
  "stripe_get_payment_intent",
  {
    paymentIntentId: z.string().describe("The payment intent ID (e.g., 'pi_xxx')"),
  },
  async ({ paymentIntentId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, options);

      return { content: [{ type: "text", text: JSON.stringify(formatPaymentIntent(paymentIntent), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get payment intent", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Create a payment intent.
 */
server.tool(
  "stripe_create_payment_intent",
  {
    amount: z.number().int().positive().describe("Amount in smallest currency unit (e.g., cents for USD)"),
    currency: z.string().length(3).describe("Three-letter ISO currency code (e.g., 'usd', 'eur')"),
    customer: z.string().optional().describe("Customer ID to associate with this payment"),
    description: z.string().optional().describe("Description of the payment"),
    metadata: z.record(z.string()).optional().describe("Custom metadata key-value pairs"),
    paymentMethod: z.string().optional().describe("Payment method ID to use"),
    confirm: z.boolean().optional().describe("Set to true to confirm the payment intent immediately"),
    automaticPaymentMethods: z.boolean().optional().describe("Enable automatic payment methods (default true)"),
    receiptEmail: z.string().email().optional().describe("Email to send receipt to"),
  },
  async ({ amount, currency, customer, description, metadata, paymentMethod, confirm, automaticPaymentMethods, receiptEmail }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const params: Stripe.PaymentIntentCreateParams = {
        amount,
        currency: currency.toLowerCase(),
        customer,
        description,
        metadata,
        payment_method: paymentMethod,
        confirm,
        receipt_email: receiptEmail,
      };

      // Enable automatic payment methods unless explicitly disabled
      if (automaticPaymentMethods !== false) {
        params.automatic_payment_methods = { enabled: true };
      }

      const paymentIntent = await stripe.paymentIntents.create(params, options);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                paymentIntent: formatPaymentIntent(paymentIntent),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create payment intent", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Confirm a payment intent.
 */
server.tool(
  "stripe_confirm_payment_intent",
  {
    paymentIntentId: z.string().describe("The payment intent ID to confirm"),
    paymentMethod: z.string().optional().describe("Payment method ID to use for this payment"),
    returnUrl: z.string().url().optional().describe("URL to redirect to after payment (required for some payment methods)"),
  },
  async ({ paymentIntentId, paymentMethod, returnUrl }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const paymentIntent = await stripe.paymentIntents.confirm(
        paymentIntentId,
        {
          payment_method: paymentMethod,
          return_url: returnUrl,
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
                paymentIntent: formatPaymentIntent(paymentIntent),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to confirm payment intent", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Cancel a payment intent.
 */
server.tool(
  "stripe_cancel_payment_intent",
  {
    paymentIntentId: z.string().describe("The payment intent ID to cancel"),
    cancellationReason: z.enum(["duplicate", "fraudulent", "requested_by_customer", "abandoned"]).optional().describe("Reason for cancellation"),
  },
  async ({ paymentIntentId, cancellationReason }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const paymentIntent = await stripe.paymentIntents.cancel(
        paymentIntentId,
        {
          cancellation_reason: cancellationReason,
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
                paymentIntent: formatPaymentIntent(paymentIntent),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to cancel payment intent", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Capture a payment intent (for manual capture).
 */
server.tool(
  "stripe_capture_payment_intent",
  {
    paymentIntentId: z.string().describe("The payment intent ID to capture"),
    amountToCapture: z.number().int().positive().optional().describe("Amount to capture (defaults to full amount)"),
  },
  async ({ paymentIntentId, amountToCapture }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const paymentIntent = await stripe.paymentIntents.capture(
        paymentIntentId,
        {
          amount_to_capture: amountToCapture,
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
                paymentIntent: formatPaymentIntent(paymentIntent),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to capture payment intent", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Search payment intents.
 */
server.tool(
  "stripe_search_payment_intents",
  {
    query: z.string().describe("Search query using Stripe's search query language (e.g., \"status:'succeeded'\" or \"customer:'cus_xxx'\")"),
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

      const results = await stripe.paymentIntents.search(
        {
          query,
          limit: limit || 10,
        },
        options
      );

      const result = {
        paymentIntents: results.data.map(formatPaymentIntent),
        hasMore: results.has_more,
        total: results.data.length,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to search payment intents", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

logger.info("Stripe payment tools registered");

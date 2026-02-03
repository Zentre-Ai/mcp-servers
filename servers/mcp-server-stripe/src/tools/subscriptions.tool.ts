import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createStripeClient, getStripeOptions, formatSubscription, formatStripeError } from "../utils/stripe-client.js";
import { logger } from "../utils/logger.js";

/**
 * List subscriptions with pagination and filters.
 */
server.tool(
  "stripe_list_subscriptions",
  {
    limit: z.number().min(1).max(100).optional().describe("Number of subscriptions to return (1-100, default 10)"),
    startingAfter: z.string().optional().describe("Cursor for pagination - subscription ID to start after"),
    endingBefore: z.string().optional().describe("Cursor for pagination - subscription ID to end before"),
    customer: z.string().optional().describe("Filter by customer ID"),
    price: z.string().optional().describe("Filter by price ID"),
    status: z.enum(["active", "past_due", "unpaid", "canceled", "incomplete", "incomplete_expired", "trialing", "all"]).optional().describe("Filter by subscription status"),
    created: z.object({
      gt: z.number().optional().describe("Return items created after this Unix timestamp"),
      gte: z.number().optional().describe("Return items created at or after this Unix timestamp"),
      lt: z.number().optional().describe("Return items created before this Unix timestamp"),
      lte: z.number().optional().describe("Return items created at or before this Unix timestamp"),
    }).optional().describe("Filter by creation date"),
  },
  async ({ limit, startingAfter, endingBefore, customer, price, status, created }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const subscriptions = await stripe.subscriptions.list(
        {
          limit: limit || 10,
          starting_after: startingAfter,
          ending_before: endingBefore,
          customer,
          price,
          status: status === "all" ? undefined : status,
          created,
        },
        options
      );

      const result = {
        subscriptions: subscriptions.data.map(formatSubscription),
        hasMore: subscriptions.has_more,
        total: subscriptions.data.length,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list subscriptions", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Get a subscription by ID.
 */
server.tool(
  "stripe_get_subscription",
  {
    subscriptionId: z.string().describe("The subscription ID (e.g., 'sub_xxx')"),
  },
  async ({ subscriptionId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const subscription = await stripe.subscriptions.retrieve(subscriptionId, options);

      return { content: [{ type: "text", text: JSON.stringify(formatSubscription(subscription), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get subscription", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Create a subscription.
 */
server.tool(
  "stripe_create_subscription",
  {
    customer: z.string().describe("Customer ID for the subscription"),
    items: z.array(z.object({
      price: z.string().describe("Price ID for the subscription item"),
      quantity: z.number().int().positive().optional().describe("Quantity of the item"),
    })).min(1).describe("List of subscription items (at least one required)"),
    defaultPaymentMethod: z.string().optional().describe("Payment method ID to use for this subscription"),
    trialPeriodDays: z.number().int().positive().optional().describe("Number of trial days before billing starts"),
    metadata: z.record(z.string()).optional().describe("Custom metadata key-value pairs"),
    cancelAtPeriodEnd: z.boolean().optional().describe("Whether to cancel at the end of the current period"),
    collectionMethod: z.enum(["charge_automatically", "send_invoice"]).optional().describe("How to collect payment"),
  },
  async ({ customer, items, defaultPaymentMethod, trialPeriodDays, metadata, cancelAtPeriodEnd, collectionMethod }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const subscription = await stripe.subscriptions.create(
        {
          customer,
          items: items.map((item) => ({
            price: item.price,
            quantity: item.quantity,
          })),
          default_payment_method: defaultPaymentMethod,
          trial_period_days: trialPeriodDays,
          metadata,
          cancel_at_period_end: cancelAtPeriodEnd,
          collection_method: collectionMethod,
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
                subscription: formatSubscription(subscription),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create subscription", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Update a subscription.
 */
server.tool(
  "stripe_update_subscription",
  {
    subscriptionId: z.string().describe("The subscription ID to update"),
    items: z.array(z.object({
      id: z.string().optional().describe("Subscription item ID to update (required for updating existing items)"),
      price: z.string().optional().describe("New price ID"),
      quantity: z.number().int().positive().optional().describe("New quantity"),
      deleted: z.boolean().optional().describe("Set to true to remove this item"),
    })).optional().describe("Updated subscription items"),
    defaultPaymentMethod: z.string().optional().describe("New default payment method"),
    metadata: z.record(z.string()).optional().describe("Metadata to merge"),
    cancelAtPeriodEnd: z.boolean().optional().describe("Whether to cancel at the end of the current period"),
    prorationBehavior: z.enum(["create_prorations", "none", "always_invoice"]).optional().describe("How to handle proration"),
  },
  async ({ subscriptionId, items, defaultPaymentMethod, metadata, cancelAtPeriodEnd, prorationBehavior }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const subscription = await stripe.subscriptions.update(
        subscriptionId,
        {
          items: items?.map((item) => ({
            id: item.id,
            price: item.price,
            quantity: item.quantity,
            deleted: item.deleted,
          })),
          default_payment_method: defaultPaymentMethod,
          metadata,
          cancel_at_period_end: cancelAtPeriodEnd,
          proration_behavior: prorationBehavior,
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
                subscription: formatSubscription(subscription),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update subscription", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Cancel a subscription.
 */
server.tool(
  "stripe_cancel_subscription",
  {
    subscriptionId: z.string().describe("The subscription ID to cancel"),
    cancelAtPeriodEnd: z.boolean().optional().describe("If true, cancel at period end instead of immediately (default: true)"),
    invoiceNow: z.boolean().optional().describe("If true, generate a final invoice immediately"),
    prorate: z.boolean().optional().describe("If true, prorate the subscription"),
  },
  async ({ subscriptionId, cancelAtPeriodEnd, invoiceNow, prorate }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      // If cancelAtPeriodEnd is true or not specified, update instead of delete
      if (cancelAtPeriodEnd !== false) {
        const subscription = await stripe.subscriptions.update(
          subscriptionId,
          { cancel_at_period_end: true },
          options
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: "Subscription will be canceled at period end",
                  subscription: formatSubscription(subscription),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Cancel immediately
      const subscription = await stripe.subscriptions.cancel(
        subscriptionId,
        {
          invoice_now: invoiceNow,
          prorate,
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
                message: "Subscription canceled immediately",
                subscription: formatSubscription(subscription),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to cancel subscription", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Resume a paused subscription.
 */
server.tool(
  "stripe_resume_subscription",
  {
    subscriptionId: z.string().describe("The subscription ID to resume"),
    billingCycleAnchor: z.enum(["now", "unchanged"]).optional().describe("When to resume billing (default: unchanged)"),
  },
  async ({ subscriptionId, billingCycleAnchor }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const subscription = await stripe.subscriptions.resume(
        subscriptionId,
        {
          billing_cycle_anchor: billingCycleAnchor,
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
                subscription: formatSubscription(subscription),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to resume subscription", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Search subscriptions.
 */
server.tool(
  "stripe_search_subscriptions",
  {
    query: z.string().describe("Search query using Stripe's search query language (e.g., \"status:'active'\" or \"metadata['key']:'value'\")"),
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

      const results = await stripe.subscriptions.search(
        {
          query,
          limit: limit || 10,
        },
        options
      );

      const result = {
        subscriptions: results.data.map(formatSubscription),
        hasMore: results.has_more,
        total: results.data.length,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to search subscriptions", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

logger.info("Stripe subscription tools registered");

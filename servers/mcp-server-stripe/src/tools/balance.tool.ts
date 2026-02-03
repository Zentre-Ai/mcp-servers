import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createStripeClient, getStripeOptions, formatBalance, formatPayout, formatStripeError } from "../utils/stripe-client.js";
import { logger } from "../utils/logger.js";

/**
 * Get account balance.
 */
server.tool(
  "stripe_get_balance",
  {},
  async () => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const balance = await stripe.balance.retrieve(options);

      return { content: [{ type: "text", text: JSON.stringify(formatBalance(balance), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get balance", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * List balance transactions.
 */
server.tool(
  "stripe_list_balance_transactions",
  {
    limit: z.number().min(1).max(100).optional().describe("Number of transactions to return (1-100, default 10)"),
    startingAfter: z.string().optional().describe("Cursor for pagination - transaction ID to start after"),
    endingBefore: z.string().optional().describe("Cursor for pagination - transaction ID to end before"),
    type: z.string().optional().describe("Filter by transaction type (e.g., 'charge', 'refund', 'payout')"),
    source: z.string().optional().describe("Filter by source ID (charge, payout, etc.)"),
    payout: z.string().optional().describe("Filter by payout ID"),
    created: z.object({
      gt: z.number().optional().describe("Return items created after this Unix timestamp"),
      gte: z.number().optional().describe("Return items created at or after this Unix timestamp"),
      lt: z.number().optional().describe("Return items created before this Unix timestamp"),
      lte: z.number().optional().describe("Return items created at or before this Unix timestamp"),
    }).optional().describe("Filter by creation date"),
  },
  async ({ limit, startingAfter, endingBefore, type, source, payout, created }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const transactions = await stripe.balanceTransactions.list(
        {
          limit: limit || 10,
          starting_after: startingAfter,
          ending_before: endingBefore,
          type,
          source,
          payout,
          created,
        },
        options
      );

      const result = {
        transactions: transactions.data.map((t) => ({
          id: t.id,
          amount: t.amount,
          currency: t.currency,
          net: t.net,
          fee: t.fee,
          type: t.type,
          status: t.status,
          created: t.created,
          availableOn: t.available_on,
          description: t.description,
          source: t.source,
        })),
        hasMore: transactions.has_more,
        total: transactions.data.length,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list balance transactions", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Get a balance transaction by ID.
 */
server.tool(
  "stripe_get_balance_transaction",
  {
    transactionId: z.string().describe("The balance transaction ID (e.g., 'txn_xxx')"),
  },
  async ({ transactionId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const transaction = await stripe.balanceTransactions.retrieve(transactionId, options);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: transaction.id,
                amount: transaction.amount,
                currency: transaction.currency,
                net: transaction.net,
                fee: transaction.fee,
                feeDetails: transaction.fee_details,
                type: transaction.type,
                status: transaction.status,
                created: transaction.created,
                availableOn: transaction.available_on,
                description: transaction.description,
                source: transaction.source,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get balance transaction", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * List payouts with pagination and filters.
 */
server.tool(
  "stripe_list_payouts",
  {
    limit: z.number().min(1).max(100).optional().describe("Number of payouts to return (1-100, default 10)"),
    startingAfter: z.string().optional().describe("Cursor for pagination - payout ID to start after"),
    endingBefore: z.string().optional().describe("Cursor for pagination - payout ID to end before"),
    status: z.enum(["pending", "paid", "failed", "canceled"]).optional().describe("Filter by payout status"),
    destination: z.string().optional().describe("Filter by destination (bank account or card ID)"),
    created: z.object({
      gt: z.number().optional().describe("Return items created after this Unix timestamp"),
      gte: z.number().optional().describe("Return items created at or after this Unix timestamp"),
      lt: z.number().optional().describe("Return items created before this Unix timestamp"),
      lte: z.number().optional().describe("Return items created at or before this Unix timestamp"),
    }).optional().describe("Filter by creation date"),
    arrivalDate: z.object({
      gt: z.number().optional().describe("Return items arriving after this Unix timestamp"),
      gte: z.number().optional().describe("Return items arriving at or after this Unix timestamp"),
      lt: z.number().optional().describe("Return items arriving before this Unix timestamp"),
      lte: z.number().optional().describe("Return items arriving at or before this Unix timestamp"),
    }).optional().describe("Filter by arrival date"),
  },
  async ({ limit, startingAfter, endingBefore, status, destination, created, arrivalDate }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const payouts = await stripe.payouts.list(
        {
          limit: limit || 10,
          starting_after: startingAfter,
          ending_before: endingBefore,
          status,
          destination,
          created,
          arrival_date: arrivalDate,
        },
        options
      );

      const result = {
        payouts: payouts.data.map(formatPayout),
        hasMore: payouts.has_more,
        total: payouts.data.length,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list payouts", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Get a payout by ID.
 */
server.tool(
  "stripe_get_payout",
  {
    payoutId: z.string().describe("The payout ID (e.g., 'po_xxx')"),
  },
  async ({ payoutId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const payout = await stripe.payouts.retrieve(payoutId, options);

      return { content: [{ type: "text", text: JSON.stringify(formatPayout(payout), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get payout", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Create a payout.
 */
server.tool(
  "stripe_create_payout",
  {
    amount: z.number().int().positive().describe("Amount to payout in smallest currency unit"),
    currency: z.string().length(3).describe("Three-letter ISO currency code"),
    description: z.string().optional().describe("Description for the payout"),
    destination: z.string().optional().describe("Bank account or card ID to send to"),
    metadata: z.record(z.string()).optional().describe("Custom metadata key-value pairs"),
    method: z.enum(["standard", "instant"]).optional().describe("Payout method (instant may have fees)"),
    sourceType: z.enum(["bank_account", "card", "fpx"]).optional().describe("Source type for the payout"),
    statementDescriptor: z.string().optional().describe("Statement descriptor for the payout"),
  },
  async ({ amount, currency, description, destination, metadata, method, sourceType, statementDescriptor }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const payout = await stripe.payouts.create(
        {
          amount,
          currency: currency.toLowerCase(),
          description,
          destination,
          metadata,
          method,
          source_type: sourceType,
          statement_descriptor: statementDescriptor,
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
                payout: formatPayout(payout),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create payout", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Cancel a payout.
 */
server.tool(
  "stripe_cancel_payout",
  {
    payoutId: z.string().describe("The payout ID to cancel"),
  },
  async ({ payoutId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const payout = await stripe.payouts.cancel(payoutId, options);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                payout: formatPayout(payout),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to cancel payout", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

logger.info("Stripe balance and payout tools registered");

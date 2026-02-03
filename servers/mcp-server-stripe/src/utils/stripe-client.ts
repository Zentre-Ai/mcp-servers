import Stripe from "stripe";
import { logger } from "./logger.js";

/**
 * Stripe authentication configuration.
 */
export interface StripeAuth {
  apiKey: string;
  stripeAccountId?: string; // Optional: for connected account operations
}

/**
 * Create a Stripe client with the provided API key.
 */
export function createStripeClient(auth: StripeAuth): Stripe {
  const stripe = new Stripe(auth.apiKey, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });

  logger.debug("Stripe client created", { hasAccountId: !!auth.stripeAccountId });

  return stripe;
}

/**
 * Get Stripe request options for connected account operations.
 */
export function getStripeOptions(auth: StripeAuth): Stripe.RequestOptions {
  const options: Stripe.RequestOptions = {};

  if (auth.stripeAccountId) {
    options.stripeAccount = auth.stripeAccountId;
  }

  return options;
}

/**
 * Extract Stripe credentials from request headers.
 * Expects:
 *   - x-stripe-api-key: <apiKey> (required)
 *   - x-stripe-account: <stripeAccountId> (optional, for connected account operations)
 */
export function extractStripeAuth(
  headers: Record<string, string | string[] | undefined>
): StripeAuth | null {
  // Extract API key from header
  const apiKey = headers["x-stripe-api-key"];
  if (!apiKey || typeof apiKey !== "string") {
    return null;
  }

  // Extract optional Stripe account ID for connected account operations
  const stripeAccountId = headers["x-stripe-account"];

  return {
    apiKey,
    stripeAccountId: typeof stripeAccountId === "string" ? stripeAccountId : undefined,
  };
}

/**
 * Format a Stripe error for user-friendly display.
 */
export function formatStripeError(error: unknown): string {
  if (error instanceof Stripe.errors.StripeError) {
    return `Stripe API error: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Format amount in cents to a readable currency string.
 */
export function formatAmount(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  });
  return formatter.format(amount / 100);
}

/**
 * Format a Stripe customer for response.
 */
export function formatCustomer(customer: Stripe.Customer | Stripe.DeletedCustomer): Record<string, unknown> {
  if ("deleted" in customer && customer.deleted) {
    return {
      id: customer.id,
      deleted: true,
    };
  }

  const c = customer as Stripe.Customer;
  return {
    id: c.id,
    email: c.email,
    name: c.name,
    phone: c.phone,
    description: c.description,
    created: c.created,
    currency: c.currency,
    defaultSource: c.default_source,
    invoicePrefix: c.invoice_prefix,
    balance: c.balance,
    delinquent: c.delinquent,
    metadata: c.metadata,
  };
}

/**
 * Format a Stripe payment intent for response.
 */
export function formatPaymentIntent(pi: Stripe.PaymentIntent): Record<string, unknown> {
  return {
    id: pi.id,
    amount: pi.amount,
    amountReceived: pi.amount_received,
    currency: pi.currency,
    status: pi.status,
    description: pi.description,
    customer: pi.customer,
    paymentMethod: pi.payment_method,
    created: pi.created,
    clientSecret: pi.client_secret,
    metadata: pi.metadata,
    latestCharge: pi.latest_charge,
  };
}

/**
 * Format a Stripe subscription for response.
 */
export function formatSubscription(sub: Stripe.Subscription): Record<string, unknown> {
  return {
    id: sub.id,
    customer: sub.customer,
    status: sub.status,
    currentPeriodStart: sub.current_period_start,
    currentPeriodEnd: sub.current_period_end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: sub.canceled_at,
    endedAt: sub.ended_at,
    created: sub.created,
    items: sub.items.data.map((item) => ({
      id: item.id,
      priceId: item.price.id,
      quantity: item.quantity,
    })),
    metadata: sub.metadata,
    trialStart: sub.trial_start,
    trialEnd: sub.trial_end,
  };
}

/**
 * Format a Stripe invoice for response.
 */
export function formatInvoice(invoice: Stripe.Invoice): Record<string, unknown> {
  return {
    id: invoice.id,
    customer: invoice.customer,
    subscription: invoice.subscription,
    status: invoice.status,
    total: invoice.total,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    currency: invoice.currency,
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    amountRemaining: invoice.amount_remaining,
    created: invoice.created,
    dueDate: invoice.due_date,
    paid: invoice.paid,
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    invoicePdf: invoice.invoice_pdf,
    metadata: invoice.metadata,
  };
}

/**
 * Format a Stripe product for response.
 */
export function formatProduct(product: Stripe.Product): Record<string, unknown> {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    active: product.active,
    created: product.created,
    updated: product.updated,
    images: product.images,
    metadata: product.metadata,
    defaultPrice: product.default_price,
    type: product.type,
  };
}

/**
 * Format a Stripe price for response.
 */
export function formatPrice(price: Stripe.Price): Record<string, unknown> {
  return {
    id: price.id,
    product: price.product,
    active: price.active,
    currency: price.currency,
    unitAmount: price.unit_amount,
    type: price.type,
    recurring: price.recurring
      ? {
          interval: price.recurring.interval,
          intervalCount: price.recurring.interval_count,
        }
      : null,
    metadata: price.metadata,
    created: price.created,
  };
}

/**
 * Format a Stripe balance for response.
 */
export function formatBalance(balance: Stripe.Balance): Record<string, unknown> {
  return {
    available: balance.available.map((b) => ({
      amount: b.amount,
      currency: b.currency,
    })),
    pending: balance.pending.map((b) => ({
      amount: b.amount,
      currency: b.currency,
    })),
    livemode: balance.livemode,
  };
}

/**
 * Format a Stripe payout for response.
 */
export function formatPayout(payout: Stripe.Payout): Record<string, unknown> {
  return {
    id: payout.id,
    amount: payout.amount,
    currency: payout.currency,
    status: payout.status,
    arrivalDate: payout.arrival_date,
    created: payout.created,
    description: payout.description,
    destination: payout.destination,
    method: payout.method,
    type: payout.type,
    metadata: payout.metadata,
  };
}

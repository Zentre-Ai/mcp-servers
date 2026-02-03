import { z } from "zod";
import Stripe from "stripe";
import { server, getCurrentAuth } from "../server.js";
import { createStripeClient, getStripeOptions, formatProduct, formatPrice, formatStripeError } from "../utils/stripe-client.js";
import { logger } from "../utils/logger.js";

/**
 * List products with pagination and filters.
 */
server.tool(
  "stripe_list_products",
  {
    limit: z.number().min(1).max(100).optional().describe("Number of products to return (1-100, default 10)"),
    startingAfter: z.string().optional().describe("Cursor for pagination - product ID to start after"),
    endingBefore: z.string().optional().describe("Cursor for pagination - product ID to end before"),
    active: z.boolean().optional().describe("Filter by active status"),
    created: z.object({
      gt: z.number().optional().describe("Return items created after this Unix timestamp"),
      gte: z.number().optional().describe("Return items created at or after this Unix timestamp"),
      lt: z.number().optional().describe("Return items created before this Unix timestamp"),
      lte: z.number().optional().describe("Return items created at or before this Unix timestamp"),
    }).optional().describe("Filter by creation date"),
  },
  async ({ limit, startingAfter, endingBefore, active, created }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const products = await stripe.products.list(
        {
          limit: limit || 10,
          starting_after: startingAfter,
          ending_before: endingBefore,
          active,
          created,
        },
        options
      );

      const result = {
        products: products.data.map(formatProduct),
        hasMore: products.has_more,
        total: products.data.length,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list products", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Get a product by ID.
 */
server.tool(
  "stripe_get_product",
  {
    productId: z.string().describe("The product ID (e.g., 'prod_xxx')"),
  },
  async ({ productId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const product = await stripe.products.retrieve(productId, options);

      return { content: [{ type: "text", text: JSON.stringify(formatProduct(product), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get product", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Create a product.
 */
server.tool(
  "stripe_create_product",
  {
    name: z.string().describe("Product name"),
    description: z.string().optional().describe("Product description"),
    active: z.boolean().optional().describe("Whether the product is active (default: true)"),
    metadata: z.record(z.string()).optional().describe("Custom metadata key-value pairs"),
    images: z.array(z.string().url()).optional().describe("Array of image URLs"),
    defaultPriceData: z.object({
      currency: z.string().length(3).describe("Currency code"),
      unitAmount: z.number().int().positive().describe("Price in smallest currency unit"),
      recurring: z.object({
        interval: z.enum(["day", "week", "month", "year"]).describe("Billing interval"),
        intervalCount: z.number().int().positive().optional().describe("Number of intervals between billings"),
      }).optional().describe("Recurring price configuration"),
    }).optional().describe("Default price for the product"),
  },
  async ({ name, description, active, metadata, images, defaultPriceData }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const params: Stripe.ProductCreateParams = {
        name,
        description,
        active,
        metadata,
        images,
      };

      if (defaultPriceData) {
        params.default_price_data = {
          currency: defaultPriceData.currency.toLowerCase(),
          unit_amount: defaultPriceData.unitAmount,
          recurring: defaultPriceData.recurring
            ? {
                interval: defaultPriceData.recurring.interval,
                interval_count: defaultPriceData.recurring.intervalCount,
              }
            : undefined,
        };
      }

      const product = await stripe.products.create(params, options);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                product: formatProduct(product),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create product", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Update a product.
 */
server.tool(
  "stripe_update_product",
  {
    productId: z.string().describe("The product ID to update"),
    name: z.string().optional().describe("New product name"),
    description: z.string().optional().describe("New description"),
    active: z.boolean().optional().describe("New active status"),
    metadata: z.record(z.string()).optional().describe("Metadata to merge"),
    images: z.array(z.string().url()).optional().describe("New array of image URLs"),
    defaultPrice: z.string().optional().describe("Price ID to set as default"),
  },
  async ({ productId, name, description, active, metadata, images, defaultPrice }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const product = await stripe.products.update(
        productId,
        {
          name,
          description,
          active,
          metadata,
          images,
          default_price: defaultPrice,
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
                product: formatProduct(product),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update product", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Delete a product.
 */
server.tool(
  "stripe_delete_product",
  {
    productId: z.string().describe("The product ID to delete"),
  },
  async ({ productId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const deleted = await stripe.products.del(productId, options);

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
      logger.error("Failed to delete product", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Search products.
 */
server.tool(
  "stripe_search_products",
  {
    query: z.string().describe("Search query using Stripe's search query language (e.g., \"name~'premium'\" or \"active:'true'\")"),
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

      const results = await stripe.products.search(
        {
          query,
          limit: limit || 10,
        },
        options
      );

      const result = {
        products: results.data.map(formatProduct),
        hasMore: results.has_more,
        total: results.data.length,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to search products", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

// Price tools

/**
 * List prices with pagination and filters.
 */
server.tool(
  "stripe_list_prices",
  {
    limit: z.number().min(1).max(100).optional().describe("Number of prices to return (1-100, default 10)"),
    startingAfter: z.string().optional().describe("Cursor for pagination - price ID to start after"),
    endingBefore: z.string().optional().describe("Cursor for pagination - price ID to end before"),
    product: z.string().optional().describe("Filter by product ID"),
    active: z.boolean().optional().describe("Filter by active status"),
    type: z.enum(["one_time", "recurring"]).optional().describe("Filter by price type"),
    currency: z.string().length(3).optional().describe("Filter by currency"),
    created: z.object({
      gt: z.number().optional().describe("Return items created after this Unix timestamp"),
      gte: z.number().optional().describe("Return items created at or after this Unix timestamp"),
      lt: z.number().optional().describe("Return items created before this Unix timestamp"),
      lte: z.number().optional().describe("Return items created at or before this Unix timestamp"),
    }).optional().describe("Filter by creation date"),
  },
  async ({ limit, startingAfter, endingBefore, product, active, type, currency, created }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const prices = await stripe.prices.list(
        {
          limit: limit || 10,
          starting_after: startingAfter,
          ending_before: endingBefore,
          product,
          active,
          type,
          currency: currency?.toLowerCase(),
          created,
        },
        options
      );

      const result = {
        prices: prices.data.map(formatPrice),
        hasMore: prices.has_more,
        total: prices.data.length,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to list prices", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Get a price by ID.
 */
server.tool(
  "stripe_get_price",
  {
    priceId: z.string().describe("The price ID (e.g., 'price_xxx')"),
  },
  async ({ priceId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const price = await stripe.prices.retrieve(priceId, options);

      return { content: [{ type: "text", text: JSON.stringify(formatPrice(price), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get price", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Create a price.
 */
server.tool(
  "stripe_create_price",
  {
    product: z.string().describe("Product ID this price belongs to"),
    currency: z.string().length(3).describe("Three-letter ISO currency code"),
    unitAmount: z.number().int().nonnegative().describe("Price in smallest currency unit (e.g., cents)"),
    active: z.boolean().optional().describe("Whether the price is active (default: true)"),
    metadata: z.record(z.string()).optional().describe("Custom metadata key-value pairs"),
    recurring: z.object({
      interval: z.enum(["day", "week", "month", "year"]).describe("Billing interval"),
      intervalCount: z.number().int().positive().optional().describe("Number of intervals between billings"),
      usageType: z.enum(["licensed", "metered"]).optional().describe("Usage type for metered billing"),
    }).optional().describe("Recurring price configuration"),
    nickname: z.string().optional().describe("Nickname for the price (for your reference)"),
  },
  async ({ product, currency, unitAmount, active, metadata, recurring, nickname }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const price = await stripe.prices.create(
        {
          product,
          currency: currency.toLowerCase(),
          unit_amount: unitAmount,
          active,
          metadata,
          recurring: recurring
            ? {
                interval: recurring.interval,
                interval_count: recurring.intervalCount,
                usage_type: recurring.usageType,
              }
            : undefined,
          nickname,
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
                price: formatPrice(price),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create price", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Update a price.
 */
server.tool(
  "stripe_update_price",
  {
    priceId: z.string().describe("The price ID to update"),
    active: z.boolean().optional().describe("New active status"),
    metadata: z.record(z.string()).optional().describe("Metadata to merge"),
    nickname: z.string().optional().describe("New nickname"),
  },
  async ({ priceId, active, metadata, nickname }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Stripe credentials available" }], isError: true };
    }

    try {
      const stripe = createStripeClient(auth);
      const options = getStripeOptions(auth);

      const price = await stripe.prices.update(
        priceId,
        {
          active,
          metadata,
          nickname,
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
                price: formatPrice(price),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update price", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

/**
 * Search prices.
 */
server.tool(
  "stripe_search_prices",
  {
    query: z.string().describe("Search query using Stripe's search query language (e.g., \"product:'prod_xxx'\" or \"active:'true'\")"),
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

      const results = await stripe.prices.search(
        {
          query,
          limit: limit || 10,
        },
        options
      );

      const result = {
        prices: results.data.map(formatPrice),
        hasMore: results.has_more,
        total: results.data.length,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      logger.error("Failed to search prices", error);
      return { content: [{ type: "text", text: `Error: ${formatStripeError(error)}` }], isError: true };
    }
  }
);

logger.info("Stripe product and price tools registered");

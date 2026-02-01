import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createZohoBooksClient, formatItem } from "../utils/zoho-books-client.js";
import { logger } from "../utils/logger.js";

/**
 * List items.
 */
server.tool(
  "zoho_books_list_items",
  {
    page: z.number().optional().describe("Page number (default 1)"),
    perPage: z.number().optional().describe("Number of items per page (max 200)"),
    status: z.enum(["active", "inactive"]).optional().describe("Filter by item status"),
    name: z.string().optional().describe("Search by item name"),
    description: z.string().optional().describe("Search by item description"),
    taxId: z.string().optional().describe("Filter by tax ID"),
    sortColumn: z.enum(["name", "rate", "created_time"]).optional().describe("Column to sort by"),
    sortOrder: z.enum(["ascending", "descending"]).optional().describe("Sort order"),
  },
  async ({ page, perPage, status, name, description, taxId, sortColumn, sortOrder }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);
      const result = await client.get<{
        items: Array<Record<string, unknown>>;
        page_context: { page: number; per_page: number; has_more_page: boolean; total: number };
      }>("/items", {
        page,
        per_page: perPage,
        status,
        name,
        description,
        tax_id: taxId,
        sort_column: sortColumn,
        sort_order: sortOrder,
      });

      const items = result.items.map(formatItem);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                items,
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
      logger.error("Failed to list items", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing items: ${message}` }] };
    }
  }
);

/**
 * Get an item by ID.
 */
server.tool(
  "zoho_books_get_item",
  {
    itemId: z.string().describe("Item ID"),
  },
  async ({ itemId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);
      const result = await client.get<{ item: Record<string, unknown> }>(`/items/${itemId}`);

      return { content: [{ type: "text", text: JSON.stringify(formatItem(result.item), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get item", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting item: ${message}` }] };
    }
  }
);

/**
 * Create a new item.
 */
server.tool(
  "zoho_books_create_item",
  {
    name: z.string().describe("Item name"),
    description: z.string().optional().describe("Item description"),
    rate: z.number().describe("Selling price"),
    purchaseRate: z.number().optional().describe("Purchase price"),
    unit: z.string().optional().describe("Unit of measurement"),
    sku: z.string().optional().describe("Stock keeping unit"),
    productType: z.enum(["goods", "service"]).optional().describe("Product type"),
    taxId: z.string().optional().describe("Tax ID"),
    isTaxable: z.boolean().optional().describe("Whether item is taxable"),
    taxExemptionId: z.string().optional().describe("Tax exemption ID (if not taxable)"),
    accountId: z.string().optional().describe("Income account ID"),
    purchaseAccountId: z.string().optional().describe("Purchase account ID"),
    inventoryAccountId: z.string().optional().describe("Inventory account ID"),
    vendorId: z.string().optional().describe("Preferred vendor ID"),
    initialStock: z.number().optional().describe("Initial stock quantity"),
    initialStockRate: z.number().optional().describe("Initial stock rate"),
    reorderLevel: z.number().optional().describe("Reorder level"),
  },
  async ({ name, description, rate, purchaseRate, unit, sku, productType, taxId, isTaxable, taxExemptionId, accountId, purchaseAccountId, inventoryAccountId, vendorId, initialStock, initialStockRate, reorderLevel }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);

      const itemData: Record<string, unknown> = {
        name,
        rate,
      };

      if (description) itemData.description = description;
      if (purchaseRate !== undefined) itemData.purchase_rate = purchaseRate;
      if (unit) itemData.unit = unit;
      if (sku) itemData.sku = sku;
      if (productType) itemData.product_type = productType;
      if (taxId) itemData.tax_id = taxId;
      if (isTaxable !== undefined) itemData.is_taxable = isTaxable;
      if (taxExemptionId) itemData.tax_exemption_id = taxExemptionId;
      if (accountId) itemData.account_id = accountId;
      if (purchaseAccountId) itemData.purchase_account_id = purchaseAccountId;
      if (inventoryAccountId) itemData.inventory_account_id = inventoryAccountId;
      if (vendorId) itemData.vendor_id = vendorId;
      if (initialStock !== undefined) itemData.initial_stock = initialStock;
      if (initialStockRate !== undefined) itemData.initial_stock_rate = initialStockRate;
      if (reorderLevel !== undefined) itemData.reorder_level = reorderLevel;

      const result = await client.post<{ item: Record<string, unknown> }>("/items", itemData);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, item: formatItem(result.item) }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create item", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating item: ${message}` }] };
    }
  }
);

/**
 * Update an item.
 */
server.tool(
  "zoho_books_update_item",
  {
    itemId: z.string().describe("Item ID to update"),
    name: z.string().optional().describe("Item name"),
    description: z.string().optional().describe("Item description"),
    rate: z.number().optional().describe("Selling price"),
    purchaseRate: z.number().optional().describe("Purchase price"),
    unit: z.string().optional().describe("Unit of measurement"),
    sku: z.string().optional().describe("Stock keeping unit"),
    taxId: z.string().optional().describe("Tax ID"),
    isTaxable: z.boolean().optional().describe("Whether item is taxable"),
    accountId: z.string().optional().describe("Income account ID"),
    purchaseAccountId: z.string().optional().describe("Purchase account ID"),
    vendorId: z.string().optional().describe("Preferred vendor ID"),
    reorderLevel: z.number().optional().describe("Reorder level"),
    status: z.enum(["active", "inactive"]).optional().describe("Item status"),
  },
  async ({ itemId, name, description, rate, purchaseRate, unit, sku, taxId, isTaxable, accountId, purchaseAccountId, vendorId, reorderLevel, status }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);

      const itemData: Record<string, unknown> = {};

      if (name) itemData.name = name;
      if (description) itemData.description = description;
      if (rate !== undefined) itemData.rate = rate;
      if (purchaseRate !== undefined) itemData.purchase_rate = purchaseRate;
      if (unit) itemData.unit = unit;
      if (sku) itemData.sku = sku;
      if (taxId) itemData.tax_id = taxId;
      if (isTaxable !== undefined) itemData.is_taxable = isTaxable;
      if (accountId) itemData.account_id = accountId;
      if (purchaseAccountId) itemData.purchase_account_id = purchaseAccountId;
      if (vendorId) itemData.vendor_id = vendorId;
      if (reorderLevel !== undefined) itemData.reorder_level = reorderLevel;
      if (status) itemData.status = status;

      const result = await client.put<{ item: Record<string, unknown> }>(`/items/${itemId}`, itemData);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, item: formatItem(result.item) }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update item", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating item: ${message}` }] };
    }
  }
);

logger.info("Zoho Books item tools registered");

import { logger } from "./logger.js";
import { getDatacenterConfig, ZohoDatacenter } from "./datacenters.js";

/**
 * Zoho Books authentication configuration.
 */
export interface ZohoBooksAuth {
  accessToken: string;
  organizationId: string;
  datacenter: ZohoDatacenter;
}

/**
 * Zoho Books API client for making REST API requests.
 */
export class ZohoBooksClient {
  private baseUrl: string;
  private accessToken: string;
  private organizationId: string;

  constructor(auth: ZohoBooksAuth) {
    const dcConfig = getDatacenterConfig(auth.datacenter);
    this.baseUrl = `https://${dcConfig.apiDomain}/books/v3`;
    this.accessToken = auth.accessToken;
    this.organizationId = auth.organizationId;
  }

  /**
   * Make a request to the Zoho Books API.
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const params = new URLSearchParams();
    params.append("organization_id", this.organizationId);

    // Add query parameters
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      }
    }

    const url = `${this.baseUrl}${path}?${params.toString()}`;

    const headers: Record<string, string> = {
      Authorization: `Zoho-oauthtoken ${this.accessToken}`,
      Accept: "application/json",
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    logger.debug(`Zoho Books API: ${method} ${url}`);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data: Record<string, unknown>;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Invalid JSON response: ${text}`);
    }

    // Zoho Books uses code 0 for success
    if (data.code !== 0) {
      const message = (data.message as string) || `Zoho Books API error: ${response.status}`;
      throw new Error(message);
    }

    return data as T;
  }

  // Convenience methods
  async get<T>(path: string, queryParams?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>("GET", path, undefined, queryParams);
  }

  async post<T>(path: string, body?: unknown, queryParams?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>("POST", path, body, queryParams);
  }

  async put<T>(path: string, body?: unknown, queryParams?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>("PUT", path, body, queryParams);
  }

  async delete<T>(path: string, queryParams?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>("DELETE", path, undefined, queryParams);
  }
}

/**
 * Extract Zoho Books credentials from request headers.
 * Expects:
 *   - Authorization: Zoho-oauthtoken <accessToken>
 *   - x-zoho-organization-id: <organizationId>
 *   - x-zoho-datacenter: <datacenter> (optional, defaults to 'com')
 */
export function extractZohoBooksAuth(
  headers: Record<string, string | string[] | undefined>
): ZohoBooksAuth | null {
  // Extract Zoho OAuth token
  const authHeader = headers["authorization"];
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  // Match Zoho-oauthtoken format
  const zohoMatch = authHeader.match(/^Zoho-oauthtoken\s+(.+)$/i);
  if (!zohoMatch) {
    return null;
  }
  const accessToken = zohoMatch[1];

  // Extract organization ID
  const organizationId = headers["x-zoho-organization-id"];
  if (!organizationId || typeof organizationId !== "string") {
    return null;
  }

  // Extract datacenter (optional, defaults to 'com')
  const datacenter = (headers["x-zoho-datacenter"] as ZohoDatacenter) || "com";

  return { accessToken, organizationId, datacenter };
}

/**
 * Create a Zoho Books client from authentication config.
 */
export function createZohoBooksClient(auth: ZohoBooksAuth): ZohoBooksClient {
  return new ZohoBooksClient(auth);
}

/**
 * Format invoice for response.
 */
export function formatInvoice(invoice: Record<string, unknown>): Record<string, unknown> {
  return {
    invoiceId: invoice.invoice_id,
    invoiceNumber: invoice.invoice_number,
    status: invoice.status,
    date: invoice.date,
    dueDate: invoice.due_date,
    customerId: invoice.customer_id,
    customerName: invoice.customer_name,
    total: invoice.total,
    balance: invoice.balance,
    currencyCode: invoice.currency_code,
    currencySymbol: invoice.currency_symbol,
    referenceNumber: invoice.reference_number,
    lineItems: invoice.line_items,
    createdTime: invoice.created_time,
    lastModifiedTime: invoice.last_modified_time,
  };
}

/**
 * Format contact for response.
 */
export function formatContact(contact: Record<string, unknown>): Record<string, unknown> {
  return {
    contactId: contact.contact_id,
    contactName: contact.contact_name,
    companyName: contact.company_name,
    contactType: contact.contact_type,
    status: contact.status,
    email: contact.email,
    phone: contact.phone,
    outstandingReceivableAmount: contact.outstanding_receivable_amount,
    outstandingPayableAmount: contact.outstanding_payable_amount,
    currencyCode: contact.currency_code,
    createdTime: contact.created_time,
    lastModifiedTime: contact.last_modified_time,
  };
}

/**
 * Format bill for response.
 */
export function formatBill(bill: Record<string, unknown>): Record<string, unknown> {
  return {
    billId: bill.bill_id,
    billNumber: bill.bill_number,
    status: bill.status,
    date: bill.date,
    dueDate: bill.due_date,
    vendorId: bill.vendor_id,
    vendorName: bill.vendor_name,
    total: bill.total,
    balance: bill.balance,
    currencyCode: bill.currency_code,
    currencySymbol: bill.currency_symbol,
    referenceNumber: bill.reference_number,
    lineItems: bill.line_items,
    createdTime: bill.created_time,
    lastModifiedTime: bill.last_modified_time,
  };
}

/**
 * Format expense for response.
 */
export function formatExpense(expense: Record<string, unknown>): Record<string, unknown> {
  return {
    expenseId: expense.expense_id,
    date: expense.date,
    accountName: expense.account_name,
    paidThroughAccountName: expense.paid_through_account_name,
    description: expense.description,
    currencyCode: expense.currency_code,
    currencySymbol: expense.currency_symbol,
    total: expense.total,
    status: expense.status,
    customerId: expense.customer_id,
    customerName: expense.customer_name,
    vendorId: expense.vendor_id,
    vendorName: expense.vendor_name,
    isBillable: expense.is_billable,
    createdTime: expense.created_time,
    lastModifiedTime: expense.last_modified_time,
  };
}

/**
 * Format item for response.
 */
export function formatItem(item: Record<string, unknown>): Record<string, unknown> {
  return {
    itemId: item.item_id,
    name: item.name,
    description: item.description,
    status: item.status,
    rate: item.rate,
    unit: item.unit,
    taxId: item.tax_id,
    taxName: item.tax_name,
    taxPercentage: item.tax_percentage,
    sku: item.sku,
    productType: item.product_type,
    isTaxable: item.is_taxable,
    stockOnHand: item.stock_on_hand,
    createdTime: item.created_time,
    lastModifiedTime: item.last_modified_time,
  };
}

/**
 * Format organization for response.
 */
export function formatOrganization(org: Record<string, unknown>): Record<string, unknown> {
  return {
    organizationId: org.organization_id,
    name: org.name,
    contactName: org.contact_name,
    email: org.email,
    isDefaultOrg: org.is_default_org,
    countryCode: org.country_code,
    currencyCode: org.currency_code,
    currencySymbol: org.currency_symbol,
    timeZone: org.time_zone,
    dateFormat: org.date_format,
    fiscalYearStartMonth: org.fiscal_year_start_month,
    address: org.address,
    phone: org.phone,
    fax: org.fax,
    website: org.website,
  };
}

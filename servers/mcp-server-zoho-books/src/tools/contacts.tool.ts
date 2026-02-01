import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createZohoBooksClient, formatContact } from "../utils/zoho-books-client.js";
import { logger } from "../utils/logger.js";

/**
 * List contacts (customers/vendors).
 */
server.tool(
  "zoho_books_list_contacts",
  {
    page: z.number().optional().describe("Page number (default 1)"),
    perPage: z.number().optional().describe("Number of contacts per page (max 200)"),
    contactType: z.enum(["customer", "vendor"]).optional().describe("Filter by contact type"),
    status: z.enum(["active", "inactive", "crm", "all"]).optional().describe("Filter by status"),
    contactName: z.string().optional().describe("Search by contact name"),
    companyName: z.string().optional().describe("Search by company name"),
    email: z.string().optional().describe("Search by email"),
    phone: z.string().optional().describe("Search by phone"),
    sortColumn: z.enum(["contact_name", "company_name", "first_name", "last_name", "email", "outstanding_receivable_amount", "outstanding_payable_amount", "created_time"]).optional().describe("Column to sort by"),
    sortOrder: z.enum(["ascending", "descending"]).optional().describe("Sort order"),
  },
  async ({ page, perPage, contactType, status, contactName, companyName, email, phone, sortColumn, sortOrder }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);
      const result = await client.get<{
        contacts: Array<Record<string, unknown>>;
        page_context: { page: number; per_page: number; has_more_page: boolean; total: number };
      }>("/contacts", {
        page,
        per_page: perPage,
        contact_type: contactType,
        status,
        contact_name: contactName,
        company_name: companyName,
        email,
        phone,
        sort_column: sortColumn,
        sort_order: sortOrder,
      });

      const contacts = result.contacts.map(formatContact);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                contacts,
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
      logger.error("Failed to list contacts", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing contacts: ${message}` }] };
    }
  }
);

/**
 * Get a contact by ID.
 */
server.tool(
  "zoho_books_get_contact",
  {
    contactId: z.string().describe("Contact ID"),
  },
  async ({ contactId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);
      const result = await client.get<{ contact: Record<string, unknown> }>(`/contacts/${contactId}`);

      return { content: [{ type: "text", text: JSON.stringify(formatContact(result.contact), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get contact", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting contact: ${message}` }] };
    }
  }
);

/**
 * Create a new contact.
 */
server.tool(
  "zoho_books_create_contact",
  {
    contactName: z.string().describe("Contact name (required)"),
    companyName: z.string().optional().describe("Company name"),
    contactType: z.enum(["customer", "vendor"]).optional().describe("Contact type (default: customer)"),
    email: z.string().optional().describe("Primary email"),
    phone: z.string().optional().describe("Phone number"),
    mobile: z.string().optional().describe("Mobile number"),
    website: z.string().optional().describe("Website URL"),
    notes: z.string().optional().describe("Notes"),
    billingAddress: z.object({
      attention: z.string().optional(),
      address: z.string().optional(),
      street2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
    }).optional().describe("Billing address"),
    shippingAddress: z.object({
      attention: z.string().optional(),
      address: z.string().optional(),
      street2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
    }).optional().describe("Shipping address"),
    contactPersons: z.array(z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      mobile: z.string().optional(),
      isPrimaryContact: z.boolean().optional(),
    })).optional().describe("Contact persons"),
    paymentTerms: z.number().optional().describe("Payment terms in days"),
    currencyId: z.string().optional().describe("Currency ID"),
    creditLimit: z.number().optional().describe("Credit limit"),
  },
  async ({ contactName, companyName, contactType, email, phone, mobile, website, notes, billingAddress, shippingAddress, contactPersons, paymentTerms, currencyId, creditLimit }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);

      const contactData: Record<string, unknown> = {
        contact_name: contactName,
      };

      if (companyName) contactData.company_name = companyName;
      if (contactType) contactData.contact_type = contactType;
      if (email) contactData.email = email;
      if (phone) contactData.phone = phone;
      if (mobile) contactData.mobile = mobile;
      if (website) contactData.website = website;
      if (notes) contactData.notes = notes;
      if (paymentTerms !== undefined) contactData.payment_terms = paymentTerms;
      if (currencyId) contactData.currency_id = currencyId;
      if (creditLimit !== undefined) contactData.credit_limit = creditLimit;

      if (billingAddress) {
        contactData.billing_address = {
          attention: billingAddress.attention,
          address: billingAddress.address,
          street2: billingAddress.street2,
          city: billingAddress.city,
          state: billingAddress.state,
          zip: billingAddress.zip,
          country: billingAddress.country,
        };
      }

      if (shippingAddress) {
        contactData.shipping_address = {
          attention: shippingAddress.attention,
          address: shippingAddress.address,
          street2: shippingAddress.street2,
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zip,
          country: shippingAddress.country,
        };
      }

      if (contactPersons) {
        contactData.contact_persons = contactPersons.map((cp) => ({
          first_name: cp.firstName,
          last_name: cp.lastName,
          email: cp.email,
          phone: cp.phone,
          mobile: cp.mobile,
          is_primary_contact: cp.isPrimaryContact,
        }));
      }

      const result = await client.post<{ contact: Record<string, unknown> }>("/contacts", contactData);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, contact: formatContact(result.contact) }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create contact", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating contact: ${message}` }] };
    }
  }
);

/**
 * Update a contact.
 */
server.tool(
  "zoho_books_update_contact",
  {
    contactId: z.string().describe("Contact ID to update"),
    contactName: z.string().optional().describe("Contact name"),
    companyName: z.string().optional().describe("Company name"),
    email: z.string().optional().describe("Primary email"),
    phone: z.string().optional().describe("Phone number"),
    mobile: z.string().optional().describe("Mobile number"),
    website: z.string().optional().describe("Website URL"),
    notes: z.string().optional().describe("Notes"),
    billingAddress: z.object({
      attention: z.string().optional(),
      address: z.string().optional(),
      street2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
    }).optional().describe("Billing address"),
    shippingAddress: z.object({
      attention: z.string().optional(),
      address: z.string().optional(),
      street2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
    }).optional().describe("Shipping address"),
    paymentTerms: z.number().optional().describe("Payment terms in days"),
    creditLimit: z.number().optional().describe("Credit limit"),
  },
  async ({ contactId, contactName, companyName, email, phone, mobile, website, notes, billingAddress, shippingAddress, paymentTerms, creditLimit }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);

      const contactData: Record<string, unknown> = {};

      if (contactName) contactData.contact_name = contactName;
      if (companyName) contactData.company_name = companyName;
      if (email) contactData.email = email;
      if (phone) contactData.phone = phone;
      if (mobile) contactData.mobile = mobile;
      if (website) contactData.website = website;
      if (notes) contactData.notes = notes;
      if (paymentTerms !== undefined) contactData.payment_terms = paymentTerms;
      if (creditLimit !== undefined) contactData.credit_limit = creditLimit;

      if (billingAddress) {
        contactData.billing_address = {
          attention: billingAddress.attention,
          address: billingAddress.address,
          street2: billingAddress.street2,
          city: billingAddress.city,
          state: billingAddress.state,
          zip: billingAddress.zip,
          country: billingAddress.country,
        };
      }

      if (shippingAddress) {
        contactData.shipping_address = {
          attention: shippingAddress.attention,
          address: shippingAddress.address,
          street2: shippingAddress.street2,
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zip,
          country: shippingAddress.country,
        };
      }

      const result = await client.put<{ contact: Record<string, unknown> }>(`/contacts/${contactId}`, contactData);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, contact: formatContact(result.contact) }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to update contact", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error updating contact: ${message}` }] };
    }
  }
);

/**
 * Delete a contact.
 */
server.tool(
  "zoho_books_delete_contact",
  {
    contactId: z.string().describe("Contact ID to delete"),
  },
  async ({ contactId }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);
      await client.delete(`/contacts/${contactId}`);

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, contactId, deleted: true }, null, 2) }],
      };
    } catch (error) {
      logger.error("Failed to delete contact", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error deleting contact: ${message}` }] };
    }
  }
);

logger.info("Zoho Books contact tools registered");

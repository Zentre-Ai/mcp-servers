import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { createZohoBooksClient, formatOrganization } from "../utils/zoho-books-client.js";
import { logger } from "../utils/logger.js";

/**
 * Get organization details.
 */
server.tool(
  "zoho_books_get_organization",
  {},
  async () => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      const client = createZohoBooksClient(auth);
      const result = await client.get<{ organization: Record<string, unknown> }>("/organization");

      return { content: [{ type: "text", text: JSON.stringify(formatOrganization(result.organization), null, 2) }] };
    } catch (error) {
      logger.error("Failed to get organization", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting organization: ${message}` }] };
    }
  }
);

/**
 * List all organizations for the authenticated user.
 * Note: This returns organizations without requiring organization_id.
 */
server.tool(
  "zoho_books_list_organizations",
  {},
  async () => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Zoho Books credentials available" }] };
    }

    try {
      // For listing organizations, we need to make a request without organization_id
      // This is a special case where we don't use the standard client
      const { getDatacenterConfig } = await import("../utils/datacenters.js");
      const dcConfig = getDatacenterConfig(auth.datacenter);
      const url = `https://${dcConfig.apiDomain}/books/v3/organizations`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Zoho-oauthtoken ${auth.accessToken}`,
          Accept: "application/json",
        },
      });

      const text = await response.text();
      let data: Record<string, unknown>;

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Invalid JSON response: ${text}`);
      }

      if (data.code !== 0) {
        const message = (data.message as string) || `Zoho Books API error: ${response.status}`;
        throw new Error(message);
      }

      const organizations = (data.organizations as Array<Record<string, unknown>>).map((org) => ({
        organizationId: org.organization_id,
        name: org.name,
        contactName: org.contact_name,
        email: org.email,
        isDefaultOrg: org.is_default_org,
        planType: org.plan_type,
        countryCode: org.country_code,
        currencyCode: org.currency_code,
        currencySymbol: org.currency_symbol,
        timeZone: org.time_zone,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ organizations }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list organizations", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing organizations: ${message}` }] };
    }
  }
);

logger.info("Zoho Books organization tools registered");

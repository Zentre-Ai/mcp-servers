import { z } from "zod";
import { server, getCurrentAuth, getCachedAccessibleResources, setSelectedSite } from "../server.js";
import { logger } from "../utils/logger.js";

/**
 * List all accessible Jira Cloud sites for the current user.
 */
server.tool(
  "jira_cloud_list_sites",
  {},
  async () => {
    const auth = getCurrentAuth();
    if (!auth) {
      return {
        content: [{ type: "text", text: "Error: No Jira Cloud credentials available" }],
        isError: true,
      };
    }

    try {
      const sites = await getCachedAccessibleResources(auth.accessToken);

      if (sites.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No accessible Jira Cloud sites found for this account. Ensure the OAuth app has the correct scopes.",
            },
          ],
          isError: true,
        };
      }

      const siteList = sites.map((s) => ({
        cloud_id: s.id,
        name: s.name,
        url: s.url,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(siteList, null, 2) }],
      };
    } catch (error) {
      logger.error("Failed to list sites", error);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error listing sites: ${message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Select a Jira Cloud site for subsequent requests.
 */
server.tool(
  "jira_cloud_select_site",
  {
    cloud_id: z.string().describe("Cloud ID of the Jira site to use (from jira_cloud_list_sites)"),
  },
  async ({ cloud_id }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return {
        content: [{ type: "text", text: "Error: No Jira Cloud credentials available" }],
        isError: true,
      };
    }

    try {
      // Validate the cloud ID exists in accessible resources
      const sites = await getCachedAccessibleResources(auth.accessToken);
      const site = sites.find((s) => s.id === cloud_id);

      if (!site) {
        const available = sites
          .map((s) => `  - ${s.name} (cloud_id: ${s.id})`)
          .join("\n");
        return {
          content: [
            {
              type: "text",
              text: `Error: Cloud ID "${cloud_id}" not found in accessible sites.\n\nAvailable sites:\n${available}`,
            },
          ],
          isError: true,
        };
      }

      // Store selection and update current auth
      setSelectedSite(auth.accessToken, cloud_id);
      auth.cloudId = cloud_id;

      return {
        content: [
          {
            type: "text",
            text: `Selected Jira Cloud site: ${site.name} (${site.url})`,
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to select site", error);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error selecting site: ${message}` }],
        isError: true,
      };
    }
  }
);

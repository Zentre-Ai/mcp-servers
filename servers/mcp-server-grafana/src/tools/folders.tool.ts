import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { grafanaRequest } from "../utils/grafana-client.js";
import { logger } from "../utils/logger.js";

/**
 * Create folder.
 */
server.tool(
  "grafana_create_folder",
  {
    title: z.string().describe("Folder title"),
    uid: z.string().optional().describe("Optional folder UID (auto-generated if not provided)"),
    parentUid: z.string().optional().describe("Parent folder UID for nested folders"),
  },
  async ({ title, uid, parentUid }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Grafana credentials available" }] };
    }

    try {
      const body: Record<string, unknown> = {
        title,
      };

      if (uid) body.uid = uid;
      if (parentUid) body.parentUid = parentUid;

      const result = await grafanaRequest<Record<string, unknown>>(auth, "/api/folders", {
        method: "POST",
        body: JSON.stringify(body),
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create folder", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error creating folder: ${message}` }] };
    }
  }
);

logger.info("Grafana folder tools registered");

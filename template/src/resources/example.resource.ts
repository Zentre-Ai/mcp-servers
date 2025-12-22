import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { server } from "../server.js";
import { logger } from "../utils/logger.js";

/**
 * Example greeting resource demonstrating resource patterns.
 *
 * Resources provide read-only access to data. They are similar to GET endpoints
 * in REST APIs - they retrieve data but don't modify state.
 */

// Resource with URI template parameter
server.resource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  async (uri, { name }) => {
    logger.debug(`Generating greeting for: ${name}`);

    const greeting = `Hello, ${name}! Welcome to the MCP server.`;

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: greeting,
        },
      ],
    };
  }
);

/**
 * Example server info resource without parameters.
 */
server.resource("server-info", "info://server", async (uri) => {
  logger.debug("Fetching server info");

  const info = {
    name: "mcp-server-{{SERVER_NAME}}",
    version: "1.0.0",
    description: "{{DESCRIPTION}}",
    capabilities: ["tools", "resources", "prompts"],
  };

  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(info, null, 2),
      },
    ],
  };
});

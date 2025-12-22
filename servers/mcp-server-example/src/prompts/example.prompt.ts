import { z } from "zod";
import { server } from "../server.js";
import { logger } from "../utils/logger.js";

/**
 * Example code review prompt demonstrating prompt patterns.
 *
 * Prompts are reusable templates for AI interactions. They help users
 * communicate with AI models in a consistent, structured way.
 */

server.prompt(
  "code_review",
  {
    code: z.string().describe("The code to review"),
    language: z.string().describe("Programming language of the code"),
    focus: z
      .enum(["security", "performance", "style", "bugs", "all"])
      .optional()
      .describe("Specific area to focus the review on"),
  },
  async ({ code, language, focus = "all" }) => {
    logger.debug(`Generating code review prompt for ${language} code, focus: ${focus}`);

    const focusInstructions: Record<string, string> = {
      security: "Focus on identifying security vulnerabilities and potential exploits.",
      performance: "Focus on performance bottlenecks and optimization opportunities.",
      style: "Focus on code style, readability, and best practices.",
      bugs: "Focus on potential bugs, edge cases, and error handling.",
      all: "Provide a comprehensive review covering security, performance, style, and bugs.",
    };

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please review the following ${language} code.

${focusInstructions[focus]}

\`\`\`${language}
${code}
\`\`\`

Provide your feedback in a structured format with:
1. Summary of findings
2. Specific issues (if any)
3. Recommendations for improvement`,
          },
        },
      ],
    };
  }
);

/**
 * Example simple prompt without parameters.
 */
server.prompt("explain_mcp", {}, async () => {
  logger.debug("Generating MCP explanation prompt");

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Please explain what the Model Context Protocol (MCP) is and how it enables AI assistants to interact with external systems. Include:

1. What MCP is and its purpose
2. The key components (tools, resources, prompts)
3. How it differs from traditional API integrations
4. Benefits for developers and users`,
        },
      },
    ],
  };
});

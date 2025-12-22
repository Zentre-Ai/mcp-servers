import { z } from "zod";
import { server } from "../server.js";
import { logger } from "../utils/logger.js";

/**
 * Example calculator tool demonstrating tool patterns.
 *
 * Tools are used for actions that may modify state or perform operations.
 * They receive typed input and return structured output.
 */

// Register the tool with the server using raw Zod shape
// Note: Pass an object of Zod schemas, not a z.object()
server.tool(
  "calculator",
  {
    operation: z
      .enum(["add", "subtract", "multiply", "divide"])
      .describe("Mathematical operation to perform"),
    a: z.number().describe("First operand"),
    b: z.number().describe("Second operand"),
  },
  async ({ operation, a, b }) => {
    logger.debug(`Calculator: ${a} ${operation} ${b}`);

  try {
    let result: number;

    switch (operation) {
      case "add":
        result = a + b;
        break;
      case "subtract":
        result = a - b;
        break;
      case "multiply":
        result = a * b;
        break;
      case "divide":
        if (b === 0) {
          return {
            content: [{ type: "text", text: "Error: Division by zero" }],
            isError: true,
          };
        }
        result = a / b;
        break;
      default:
        // This should never happen due to Zod validation
        throw new Error(`Unknown operation: ${operation as string}`);
    }

    logger.info(`Calculator result: ${result}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            operation,
            operands: { a, b },
            result,
          }),
        },
      ],
    };
  } catch (error) {
    logger.error("Calculator error", error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

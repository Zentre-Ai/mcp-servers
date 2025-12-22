#!/usr/bin/env node

import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { createServer } from "./commands/create.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root directory is two levels up from cli/build/index.js or cli/src/index.ts
const rootDir = path.resolve(__dirname, "..", "..");

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log(chalk.bold.blue("╔════════════════════════════════════╗"));
  console.log(chalk.bold.blue("║     MCP Servers CLI                ║"));
  console.log(chalk.bold.blue("╚════════════════════════════════════╝"));

  switch (command) {
    case "create":
    case undefined:
      await createServer(rootDir);
      break;

    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;

    default:
      console.log(chalk.red(`Unknown command: ${command}`));
      printHelp();
      process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
${chalk.bold("Usage:")}
  npm run create-server          Create a new MCP server
  npm run create-server -- help  Show this help message

${chalk.bold("Commands:")}
  create    Create a new MCP server from template (default)
  help      Show this help message

${chalk.bold("Examples:")}
  npm run create-server

  # Interactive prompts:
  # > Server name: github
  # > Description: GitHub API integration
  # > Author: Your Name

  # Creates: servers/mcp-server-github/
`);
}

main().catch((error) => {
  console.error(chalk.red("Error:"), error);
  process.exit(1);
});

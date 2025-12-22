import { input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import path from "path";
import fs from "fs-extra";
import { execSync } from "child_process";
import { copyTemplate, validateServerName, TemplateVariables } from "../utils/template.js";

export async function createServer(rootDir: string): Promise<void> {
  console.log(chalk.bold.cyan("\n🚀 Create New MCP Server\n"));

  // Get server name
  const serverName = await input({
    message: "Server name (e.g., github, slack, jira):",
    validate: validateServerName,
  });

  // Get description
  const description = await input({
    message: "Description:",
    default: `MCP server for ${serverName} integration`,
  });

  // Get author
  const author = await input({
    message: "Author:",
    default: "",
  });

  // Paths
  const templateDir = path.join(rootDir, "template");
  const serversDir = path.join(rootDir, "servers");
  const serverDir = path.join(serversDir, `mcp-server-${serverName}`);

  // Check if server already exists
  if (await fs.pathExists(serverDir)) {
    console.log(chalk.red(`\n❌ Server already exists: ${serverDir}`));
    const overwrite = await confirm({
      message: "Do you want to overwrite it?",
      default: false,
    });

    if (!overwrite) {
      console.log(chalk.yellow("Aborted."));
      return;
    }

    await fs.remove(serverDir);
  }

  // Variables for template
  const variables: TemplateVariables = {
    SERVER_NAME: serverName,
    DESCRIPTION: description,
    AUTHOR: author,
  };

  console.log(chalk.dim("\nCreating server..."));

  try {
    // Copy template with variable replacement
    await copyTemplate(templateDir, serverDir, variables);

    console.log(chalk.green(`\n✅ Created: ${serverDir}`));

    // Ask about installing dependencies
    const installDeps = await confirm({
      message: "Install dependencies now?",
      default: true,
    });

    if (installDeps) {
      console.log(chalk.dim("\nInstalling dependencies..."));
      execSync("npm install", {
        cwd: serverDir,
        stdio: "inherit",
      });
      console.log(chalk.green("✅ Dependencies installed"));
    }

    // Print next steps
    console.log(chalk.bold.cyan("\n📋 Next Steps:\n"));
    console.log(`  ${chalk.dim("1.")} cd servers/mcp-server-${serverName}`);
    if (!installDeps) {
      console.log(`  ${chalk.dim("2.")} npm install`);
      console.log(`  ${chalk.dim("3.")} npm run dev`);
    } else {
      console.log(`  ${chalk.dim("2.")} npm run dev`);
    }
    console.log("");
    console.log(chalk.dim("  Add tools in src/tools/"));
    console.log(chalk.dim("  Add resources in src/resources/"));
    console.log(chalk.dim("  Add prompts in src/prompts/"));
    console.log("");
  } catch (error) {
    console.error(chalk.red("\n❌ Failed to create server:"), error);
    process.exit(1);
  }
}

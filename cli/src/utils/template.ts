import fs from "fs-extra";
import path from "path";

export interface TemplateVariables {
  SERVER_NAME: string;
  DESCRIPTION: string;
  AUTHOR: string;
}

/**
 * Replace template placeholders in content.
 */
export function replacePlaceholders(content: string, variables: TemplateVariables): string {
  let result = content;
  result = result.replace(/\{\{SERVER_NAME\}\}/g, variables.SERVER_NAME);
  result = result.replace(/\{\{DESCRIPTION\}\}/g, variables.DESCRIPTION);
  result = result.replace(/\{\{AUTHOR\}\}/g, variables.AUTHOR);
  return result;
}

/**
 * Check if a file is binary (should not have placeholders replaced).
 */
function isBinaryFile(filePath: string): boolean {
  const binaryExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
  ];
  const ext = path.extname(filePath).toLowerCase();
  return binaryExtensions.includes(ext);
}

/**
 * Copy template directory to destination with placeholder replacement.
 */
export async function copyTemplate(
  templateDir: string,
  destDir: string,
  variables: TemplateVariables
): Promise<void> {
  // Ensure destination directory exists
  await fs.ensureDir(destDir);

  // Get all files and directories in template
  const entries = await fs.readdir(templateDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(templateDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      // Recursively copy directories
      await copyTemplate(srcPath, destPath, variables);
    } else if (entry.isFile()) {
      if (isBinaryFile(entry.name)) {
        // Copy binary files as-is
        await fs.copy(srcPath, destPath);
      } else {
        // Read, replace placeholders, and write text files
        const content = await fs.readFile(srcPath, "utf-8");
        const processedContent = replacePlaceholders(content, variables);
        await fs.writeFile(destPath, processedContent);
      }
    }
  }
}

/**
 * Validate server name.
 */
export function validateServerName(name: string): string | true {
  if (!name || name.trim().length === 0) {
    return "Server name is required";
  }

  // Only allow lowercase letters, numbers, and hyphens
  if (!/^[a-z0-9-]+$/.test(name)) {
    return "Server name can only contain lowercase letters, numbers, and hyphens";
  }

  // Don't start or end with hyphen
  if (name.startsWith("-") || name.endsWith("-")) {
    return "Server name cannot start or end with a hyphen";
  }

  return true;
}

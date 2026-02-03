import { z } from "zod";
import "dotenv/config";

/**
 * Configuration schema for GitLab MCP server.
 *
 * NOTE: OAuth credentials (client_id, client_secret) are NOT stored server-side.
 * They are provided by clients per-request to enable multi-tenant support.
 */
const ConfigSchema = z.object({
  // Server Configuration
  PORT: z.coerce.number().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // GitLab Configuration
  GITLAB_DEFAULT_HOST: z.string().default("gitlab.com"),

  // Default OAuth scopes (client can override)
  OAUTH_DEFAULT_SCOPES: z
    .string()
    .default("api read_user read_api read_repository write_repository"),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  return result.data;
}

export const config = loadConfig();

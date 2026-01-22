import { z } from "zod";
import "dotenv/config";

/**
 * Configuration schema with validation.
 *
 * Authentication Flow:
 * 1. External system authenticates user against Keycloak, passes access token via Authorization header
 * 2. Server extracts Keycloak URL and realm from the token's issuer (iss) claim
 * 3. Access token is passed directly to Keycloak Admin API (user's permissions apply)
 *
 * No Keycloak configuration needed - everything is extracted from the access token.
 */
const ConfigSchema = z.object({
  // Server configuration
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PORT: z.coerce.number().min(1).max(65535).default(3010),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Parse and validate configuration from environment variables.
 * Throws an error if validation fails.
 */
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

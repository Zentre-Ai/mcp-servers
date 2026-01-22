import { z } from "zod";
import "dotenv/config";

/**
 * Configuration schema with validation for Keycloak.
 *
 * Authentication Flow:
 * 1. Server is configured with Keycloak URL and realm
 * 2. External system authenticates user against Keycloak, passes access token via Authorization header
 * 3. Access token is passed directly to Keycloak Admin API (user's permissions apply)
 */
const ConfigSchema = z.object({
  // Server configuration
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PORT: z.coerce.number().min(1).max(65535).default(3010),

  // Keycloak Instance Configuration
  KEYCLOAK_URL: z.string().url({ message: "KEYCLOAK_URL must be a valid URL" }),
  KEYCLOAK_REALM: z.string().min(1, "KEYCLOAK_REALM is required"),
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

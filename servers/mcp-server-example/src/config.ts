import { z } from "zod";
import "dotenv/config";

/**
 * Configuration schema with validation.
 * Add your environment variables here.
 */
const ConfigSchema = z.object({
  // Server configuration
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PORT: z.coerce.number().min(1).max(65535).default(3000),

  // Add your API configuration here
  // Example:
  // API_KEY: z.string().min(1, "API_KEY is required"),
  // API_BASE_URL: z.string().url().default("https://api.example.com"),
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

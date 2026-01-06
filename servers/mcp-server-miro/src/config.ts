import { z } from "zod";

const configSchema = z.object({
  port: z.coerce.number().default(3000),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const config = configSchema.parse({
  port: process.env.PORT,
  logLevel: process.env.LOG_LEVEL,
});

export type Config = z.infer<typeof configSchema>;

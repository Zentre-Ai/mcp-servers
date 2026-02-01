/**
 * Stderr-safe logger for MCP servers.
 * All logs go to stderr to avoid corrupting STDIO transport.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = "info") {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` ${JSON.stringify(args)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      console.error(this.formatMessage("debug", message, ...args));
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.error(this.formatMessage("info", message, ...args));
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      console.error(this.formatMessage("warn", message, ...args));
    }
  }

  error(message: string, error?: unknown): void {
    if (this.shouldLog("error")) {
      const errorDetails =
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error;
      console.error(this.formatMessage("error", message, errorDetails));
    }
  }
}

const envLogLevel = (process.env.LOG_LEVEL || "info").toLowerCase() as LogLevel;
const validLevel = Object.keys(LOG_LEVELS).includes(envLogLevel) ? envLogLevel : "info";

export const logger = new Logger(validLevel);

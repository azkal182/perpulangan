import pino from "pino";

/**
 * Client-side logger
 *
 * NOTE: This logger is intended for Shared/Client use.
 * For Server-Side code (Actions, API Routes), please use `@/server/logger`
 * to ensure proper context and redaction.
 *
 * Features:
 * - Automatic debug mode detection via localStorage
 * - Environment-based log levels
 * - Structured logging format
 * - User context injection (when available)
 */

const isDev = process.env.NODE_ENV === "development";

// Check if debug mode is enabled via localStorage (client-side only)
const isDebugMode = () => {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("debug") === "true";
  } catch {
    return false;
  }
};

// Get effective log level
function getLogLevel() {
  if (isDebugMode()) return "debug";
  return process.env.NEXT_PUBLIC_LOG_LEVEL || (isDev ? "info" : "warn");
}

export const logger = pino({
  level: getLogLevel(),
  browser: {
    asObject: true,
  },
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname",
        },
      }
    : undefined,
  base: {
    env: process.env.NODE_ENV,
    scope: "client",
  },
});

/**
 * Create a child logger with additional context
 *
 * Usage:
 *   const log = createLogger({ component: "StudentForm" });
 *   log.info("form submitted");
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log client-side errors with proper structure
 *
 * Usage:
 *   try {
 *     // ... code
 *   } catch (err) {
 *     logError(err, { context: "user-action", action: "submit-form" });
 *   }
 */
export function logError(error: unknown, context?: Record<string, unknown>) {
  const errorData = {
    ...context,
    error:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: isDev ? error.stack : undefined,
          }
        : error,
  };

  logger.error(errorData, "Client error occurred");
}

/**
 * Enable debug mode (stores in localStorage)
 * Usage: window.enableDebugLogs()
 */
export function enableDebugLogs() {
  if (typeof window !== "undefined") {
    localStorage.setItem("debug", "true");
    console.log("✅ Debug logging enabled. Refresh the page to apply.");
  }
}

/**
 * Disable debug mode
 * Usage: window.disableDebugLogs()
 */
export function disableDebugLogs() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("debug");
    console.log("✅ Debug logging disabled. Refresh the page to apply.");
  }
}

// Expose debug controls to window in development
if (typeof window !== "undefined" && isDev) {
  (
    window as unknown as {
      enableDebugLogs: () => void;
      disableDebugLogs: () => void;
    }
  ).enableDebugLogs = enableDebugLogs;
  (
    window as unknown as {
      enableDebugLogs: () => void;
      disableDebugLogs: () => void;
    }
  ).disableDebugLogs = disableDebugLogs;
}

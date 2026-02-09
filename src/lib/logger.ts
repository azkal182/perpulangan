import pino from "pino";

// NOTE: This logger is intended for Shared/Client use.
// For Server-Side code (Actions, API Routes), please use `@/server/logger` to ensure proper context and redaction.

export const logger = pino({
  level: process.env.NEXT_PUBLIC_LOG_LEVEL || "info", // Use NEXT_PUBLIC for client visibility
  transport:
    process.env.NODE_ENV === "development"
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

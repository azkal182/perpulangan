import "server-only";
import pino from "pino";
import { env } from "@/server/env";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";

const isDev = env.NODE_ENV !== "production";

/**
 * Custom serializer for Prisma errors
 * Extracts useful information from PrismaClientKnownRequestError
 */
function serializePrismaError(err: unknown) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      type: "PrismaClientKnownRequestError",
      code: err.code,
      meta: err.meta,
      message: err.message,
      clientVersion: err.clientVersion,
    };
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return {
      type: "PrismaClientValidationError",
      message: err.message,
    };
  }
  return err;
}

/**
 * Custom serializer for Zod validation errors
 * Makes validation errors more readable in logs
 */
function serializeZodError(err: unknown) {
  if (err instanceof ZodError) {
    return {
      type: "ZodValidationError",
      issues: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      })),
      message: err.message,
    };
  }
  return err;
}

/**
 * Enhanced error serializer that handles common error types
 */
function serializeError(err: unknown) {
  // Try Prisma first
  const prismaResult = serializePrismaError(err);
  if (prismaResult !== err) return prismaResult;

  // Try Zod
  const zodResult = serializeZodError(err);
  if (zodResult !== err) return zodResult;

  // Standard Error
  if (err instanceof Error) {
    return {
      type: err.constructor.name,
      message: err.message,
      stack: isDev ? err.stack : undefined,
    };
  }

  return err;
}

export const logger = pino({
  level: env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  base: {
    env: env.NODE_ENV,
    service: env.APP_NAME ?? "perpulangan",
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "body.password",
      "body.token",
      "*.password",
      "*.token",
      "*.secret",
    ],
    censor: "[redacted]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    err: serializeError,
    error: serializeError,
  },
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
});

/**
 * Performance timing utility
 * Usage:
 *   const timer = startTimer();
 *   // ... do work
 *   logger.info({ duration: timer() }, "operation completed");
 */
export function startTimer() {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}

/**
 * Create a child logger with additional context
 * Usage:
 *   const log = createLogger({ module: "students", action: "fetch" });
 *   log.debug("fetching students");
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

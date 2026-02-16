/**
 * Error Handler Utilities
 *
 * Centralized error handling with structured logging and user-friendly messages
 */

import { logger } from "@/server/logger";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  VALIDATION = "validation",
  DATABASE = "database",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  NOT_FOUND = "not_found",
  NETWORK = "network",
  UNKNOWN = "unknown",
}

/**
 * Categorize error based on its type
 */
export function categorizeError(error: unknown): ErrorCategory {
  if (error instanceof ZodError) {
    return ErrorCategory.VALIDATION;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientValidationError
  ) {
    return ErrorCategory.DATABASE;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (
      message.includes("unauthorized") ||
      message.includes("unauthenticated")
    ) {
      return ErrorCategory.AUTHENTICATION;
    }

    if (message.includes("forbidden") || message.includes("permission")) {
      return ErrorCategory.AUTHORIZATION;
    }

    if (message.includes("not found")) {
      return ErrorCategory.NOT_FOUND;
    }

    if (message.includes("network") || message.includes("fetch")) {
      return ErrorCategory.NETWORK;
    }
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Get user-friendly error message
 */
export function getUserErrorMessage(error: unknown): string {
  const category = categorizeError(error);

  switch (category) {
    case ErrorCategory.VALIDATION:
      return "Data yang dimasukkan tidak valid. Silakan periksa kembali.";
    case ErrorCategory.DATABASE:
      return "Terjadi kesalahan pada database. Silakan coba lagi.";
    case ErrorCategory.AUTHENTICATION:
      return "Sesi Anda telah berakhir. Silakan login kembali.";
    case ErrorCategory.AUTHORIZATION:
      return "Anda tidak memiliki akses untuk melakukan tindakan ini.";
    case ErrorCategory.NOT_FOUND:
      return "Data yang dicari tidak ditemukan.";
    case ErrorCategory.NETWORK:
      return "Terjadi kesalahan jaringan. Periksa koneksi internet Anda.";
    default:
      return "Terjadi kesalahan. Silakan coba lagi atau hubungi administrator.";
  }
}

/**
 * Handle and log errors with proper categorization
 *
 * Usage:
 *   try {
 *     // ... code
 *   } catch (error) {
 *     return handleError(error, {
 *       module: "registration",
 *       action: "create",
 *       context: { studentId }
 *     });
 *   }
 */
export function handleError(
  error: unknown,
  meta: {
    module: string;
    action: string;
    context?: Record<string, unknown>;
  },
): {
  success: false;
  error: string;
  category: ErrorCategory;
} {
  const category = categorizeError(error);
  const userMessage = getUserErrorMessage(error);

  logger.error(
    {
      err: error,
      category,
      ...meta.context,
    },
    `${meta.module}.${meta.action} failed`,
  );

  return {
    success: false,
    error: userMessage,
    category,
  };
}

/**
 * Extract validation errors from ZodError
 */
export function getValidationErrors(error: ZodError): Record<string, string> {
  return error.issues.reduce(
    (acc, issue) => {
      const path = issue.path.join(".");
      acc[path] = issue.message;
      return acc;
    },
    {} as Record<string, string>,
  );
}

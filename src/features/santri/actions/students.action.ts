"use server";

import prisma from "@/lib/prisma";
import { logger } from "@/server/logger";
import {
  AccessDeniedError,
  andWhere,
  ensureKordaInScope,
  getRegionalAccessScope,
  studentScopeWhere,
} from "@/server/access-scope";

export type StudentBasic = {
  id: string;
  name: string;
  nis: string | null;
  regencyId: number | null;
  regency?: {
    kordaId: string | null;
  } | null;
};

/**
 * Fetch students by Korda ID
 * This is used for registration form autocomplete
 */
export async function getStudentsByKorda(kordaId: string): Promise<{
  success: boolean;
  students?: StudentBasic[];
  error?: string;
}> {
  try {
    const scope = await getRegionalAccessScope();
    await ensureKordaInScope(scope, kordaId);

    logger.debug({ kordaId }, "Fetching students by kordaId");

    const students = await prisma.student.findMany({
      where: andWhere(
        {
          regency: {
            kordaId: kordaId,
          },
        },
        studentScopeWhere(scope),
      ),
      select: {
        id: true,
        name: true,
        nis: true,
        regencyId: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    logger.debug(
      { kordaId, count: students.length },
      "Successfully fetched students by kordaId",
    );

    return {
      success: true,
      students,
    };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return {
        success: false,
        error: error.message,
      };
    }
    logger.error(
      { err: error, kordaId },
      "Failed to fetch students by kordaId",
    );
    return {
      success: false,
      error: "Gagal memuat data siswa",
    };
  }
}

/**
 * Search students by name or NIS (async autocomplete)
 * Used for registration form with optional Korda selection
 * @param query - Search query (name or NIS)
 * @param kordaId - Optional Korda ID to filter students
 */
export async function searchStudents(
  query: string,
  kordaId?: string,
): Promise<StudentBasic[]> {
  try {
    const scope = await getRegionalAccessScope();

    const trimmedQuery = query.trim();

    logger.debug({ query: trimmedQuery, kordaId }, "Searching students");

    // If query is empty, return empty array
    if (!trimmedQuery) {
      return [];
    }

    if (kordaId) {
      await ensureKordaInScope(scope, kordaId);
    }

    const students = await prisma.student.findMany({
      where: andWhere(
        {
          AND: [
            {
              OR: [
                {
                  name: {
                    contains: trimmedQuery,
                    mode: "insensitive",
                  },
                },
                {
                  nis: {
                    contains: trimmedQuery,
                    mode: "insensitive",
                  },
                },
              ],
            },
            {
              status: true, // Only active students
            },
            ...(kordaId
              ? [
                  {
                    regency: {
                      kordaId: kordaId,
                    },
                  },
                ]
              : []),
          ],
        },
        studentScopeWhere(scope),
      ),
      select: {
        id: true,
        name: true,
        nis: true,
        regencyId: true,
        regency: {
          select: {
            kordaId: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
      take: 50, // Limit for performance
    });

    logger.debug(
      { query: trimmedQuery, kordaId, count: students.length },
      "Successfully searched students",
    );

    return students;
  } catch (error) {
    logger.error({ err: error, query, kordaId }, "Failed to search students");
    return [];
  }
}

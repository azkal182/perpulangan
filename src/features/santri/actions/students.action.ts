"use server";

import prisma from "@/lib/prisma";
import { logger } from "@/server/logger";

export type StudentBasic = {
  id: string;
  name: string;
  nis: string;
  regencyId: number | null;
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
    logger.debug({ kordaId }, "Fetching students by kordaId");

    const students = await prisma.student.findMany({
      where: {
        regency: {
          kordaId: kordaId,
        },
      },
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
      "Successfully fetched students by kordaId"
    );

    return {
      success: true,
      students,
    };
  } catch (error) {
    logger.error({ err: error, kordaId }, "Failed to fetch students by kordaId");
    return {
      success: false,
      error: "Gagal memuat data siswa",
    };
  }
}

"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logger } from "@/server/logger";
import {
  AccessDeniedError,
  andWhere,
  ensureKordaInScope,
  getRegionalAccessScope,
  studentScopeWhere,
} from "@/server/access-scope";

export type UpdateRegionalInput = {
  studentId: string;
  provinceId: number | null;
  regencyId: number | null;
  districtId: number | null;
};

export type UpdateRegionalResult = {
  success: boolean;
  error?: string;
};

/**
 * Update student's province, regency, and district data
 */
export async function updateStudentRegional(
  input: UpdateRegionalInput,
): Promise<UpdateRegionalResult> {
  try {
    const scope = await getRegionalAccessScope();
    const { studentId, provinceId, regencyId, districtId } = input;

    // Validate input
    if (!studentId) {
      return { success: false, error: "Student ID is required" };
    }

    // Verify student exists
    const student = await prisma.student.findFirst({
      where: andWhere({ id: studentId }, studentScopeWhere(scope)),
      select: { id: true, name: true, nis: true },
    });

    if (!student) {
      return { success: false, error: "Student not found" };
    }

    if (regencyId) {
      const regency = await prisma.regency.findUnique({
        where: { id: regencyId },
        select: { kordaId: true },
      });

      if (!regency) {
        return { success: false, error: "Regency not found" };
      }

      if (regency.kordaId) {
        await ensureKordaInScope(scope, regency.kordaId);
      } else if (scope.role !== "admin") {
        return {
          success: false,
          error: "Regency belum terhubung ke korda yang dapat diakses",
        };
      }
    }

    // Update student
    await prisma.student.update({
      where: { id: studentId },
      data: {
        provinceId,
        regencyId,
        districtId, // Updated optional district
        // Reset village when updating province/regency/district
        villageId: null,
      },
    });

    logger.info(
      { studentId, nis: student.nis, provinceId, regencyId },
      "student.updateRegional success",
    );

    revalidatePath("/santri");

    return { success: true };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return {
        success: false,
        error: error.message,
      };
    }
    logger.error({ err: error, input }, "student.updateRegional failed");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update regional data",
    };
  }
}

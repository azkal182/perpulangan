"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logger } from "@/server/logger";
import {
  AccessDeniedError,
  andWhere,
  ensureKordaInScope,
  getRegionalAccessScope,
  requireAdmin,
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
    requireAdmin(scope);
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
        select: { kordaId: true, provinceId: true },
      });

      if (!regency) {
        return { success: false, error: "Regency not found" };
      }

      if (!provinceId || regency.provinceId !== provinceId) {
        return { success: false, error: "Kabupaten/kota tidak sesuai dengan provinsi yang dipilih" };
      }

      if (!regency.kordaId) {
        return {
          success: false,
          error: "Kabupaten/kota ini belum dipetakan ke Korda. Minta admin memperbaiki pemetaan di Master sebelum menyimpan data santri.",
        };
      }
      await ensureKordaInScope(scope, regency.kordaId);
    }

    if (!regencyId || !provinceId) {
      return { success: false, error: "Provinsi dan kabupaten/kota wajib dipilih agar data dapat digunakan untuk registrasi" };
    }

    if (districtId) {
      const district = await prisma.district.findUnique({ where: { id: districtId }, select: { regencyId: true } });
      if (!district || district.regencyId !== regencyId) {
        return { success: false, error: "Kecamatan tidak sesuai dengan kabupaten/kota yang dipilih" };
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
        regionalStatus: "VERIFIED",
        regionalReviewNote: null,
        regionalReviewedAt: new Date(),
        regionalReviewedByUserId: scope.userId,
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

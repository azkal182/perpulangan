"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logger } from "@/server/logger";

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
    const { studentId, provinceId, regencyId, districtId } = input;

    // Validate input
    if (!studentId) {
      return { success: false, error: "Student ID is required" };
    }

    // Verify student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, nis: true },
    });

    if (!student) {
      return { success: false, error: "Student not found" };
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

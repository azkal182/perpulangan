"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logger } from "@/server/logger";

export type UpdateStudentInput = {
  id: string;
  name: string;
  gender: "L" | "P";
  ttl?: string;
  dormitory?: string;
  fullAddress?: string;
  source: "DAFU" | "MUSA";
  parrentPhone?: string;
  status: boolean;
  provinceId?: number;
  regencyId?: number;
  districtId?: number;
  villageId?: number;
};

export async function getStudentById(id: string) {
  try {
    const student = await prisma.student.findUnique({
      where: { id },
    });

    if (!student) {
      return { success: false, error: "Santri tidak ditemukan" };
    }

    return { success: true, student };
  } catch (error) {
    logger.error({ err: error, id }, "Failed to fetch student by id");
    return { success: false, error: "Gagal memuat data santri" };
  }
}

export async function updateStudent(input: UpdateStudentInput) {
  try {
    const { id, ...data } = input;

    await prisma.student.update({
      where: { id },
      data: {
        ...data,
      },
    });

    revalidatePath("/santri");
    revalidatePath("/santri/tambah");

    return { success: true };
  } catch (error) {
    logger.error({ err: error, input }, "Failed to update student");
    return { success: false, error: "Gagal memperbarui data santri" };
  }
}

export async function deleteStudent(id: string) {
  try {
    await prisma.student.delete({
      where: { id },
    });

    revalidatePath("/santri");
    revalidatePath("/santri/tambah");

    return { success: true };
  } catch (error) {
    logger.error({ err: error, id }, "Failed to delete student");

    // Check if it's a foreign key constraint error
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaError = error as any;
    if (prismaError.code === "P2003") {
      return {
        success: false,
        error:
          "Siswa ini tidak dapat dihapus karena sudah memiliki data terkait (seperti pendaftaran, track, dll).",
      };
    }

    return { success: false, error: "Gagal menghapus data santri" };
  }
}

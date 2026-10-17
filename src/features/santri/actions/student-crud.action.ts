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

export type UpdateStudentInput = {
  id: string;
  name: string;
  gender: "L" | "P";
  ttl?: string;
  dormitory?: string;
  fullAddress?: string;
  source: "DAFU" | "MUSA" | "SPBP";
  parrentPhone?: string;
  status: boolean;
  provinceId?: number;
  regencyId?: number;
  districtId?: number;
  villageId?: number;
};

export async function getStudentById(id: string) {
  try {
    const scope = await getRegionalAccessScope();
    const student = await prisma.student.findFirst({
      where: andWhere({ id }, studentScopeWhere(scope)),
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
    const scope = await getRegionalAccessScope();
    const { id, ...data } = input;
    const regionalFieldsProvided = ["provinceId", "regencyId", "districtId", "villageId"].some((key) => Object.hasOwn(input, key));
    if (regionalFieldsProvided) requireAdmin(scope);

    const existing = await prisma.student.findFirst({
      where: andWhere({ id }, studentScopeWhere(scope)),
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: "Santri tidak ditemukan" };
    }

    if (data.regencyId) {
      const regency = await prisma.regency.findUnique({
        where: { id: data.regencyId },
        select: { kordaId: true, provinceId: true },
      });
      if (!regency) {
        return { success: false, error: "Regency tidak ditemukan" };
      }
      if (!data.provinceId || data.provinceId !== regency.provinceId) {
        return { success: false, error: "Kabupaten/kota tidak sesuai dengan provinsi yang dipilih" };
      }
      if (regency.kordaId) {
        await ensureKordaInScope(scope, regency.kordaId);
      } else {
        return {
          success: false,
          error: "Kabupaten/kota belum dipetakan ke Korda di Master",
        };
      }
    }

    if (regionalFieldsProvided && (!data.provinceId || !data.regencyId)) {
      return { success: false, error: "Provinsi dan kabupaten/kota wajib dipilih" };
    }
    if (data.districtId) {
      const district = await prisma.district.findUnique({ where: { id: data.districtId }, select: { regencyId: true } });
      if (!district || district.regencyId !== data.regencyId) return { success: false, error: "Kecamatan tidak sesuai dengan kabupaten/kota yang dipilih" };
    }
    if (data.villageId) {
      const village = await prisma.village.findUnique({ where: { id: data.villageId }, select: { districtId: true } });
      if (!village || village.districtId !== data.districtId) return { success: false, error: "Desa/kelurahan tidak sesuai dengan kecamatan yang dipilih" };
    }

    await prisma.student.update({
      where: { id },
      data: {
        ...data,
        ...(regionalFieldsProvided ? { districtId: data.districtId ?? null, villageId: data.villageId ?? null, regionalStatus: "VERIFIED", regionalReviewNote: null, regionalReviewedAt: new Date(), regionalReviewedByUserId: scope.userId } : {}),
      },
    });

    revalidatePath("/santri");
    revalidatePath("/santri/tambah");

    return { success: true };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    logger.error({ err: error, input }, "Failed to update student");
    return { success: false, error: "Gagal memperbarui data santri" };
  }
}

export async function deleteStudent(id: string) {
  try {
    const scope = await getRegionalAccessScope();
    const existing = await prisma.student.findFirst({
      where: andWhere({ id }, studentScopeWhere(scope)),
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: "Santri tidak ditemukan" };
    }

    await prisma.student.delete({
      where: { id },
    });

    revalidatePath("/santri");
    revalidatePath("/santri/tambah");

    return { success: true };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
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

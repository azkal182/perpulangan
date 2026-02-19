"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logger } from "@/server/logger";

export interface CreateManualStudentInput {
  name: string;
  gender: "L" | "P";
  ttl?: string;
  dormitory?: string;
  fullAddress?: string;
  source: "DAFU" | "MUSA";
  parrentPhone?: string;
  status?: boolean;
  provinceId?: number;
  regencyId?: number;
}

export async function createManualStudent(
  input: CreateManualStudentInput,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const {
      name,
      gender,
      ttl,
      dormitory,
      fullAddress,
      source,
      parrentPhone,
      status,
      provinceId,
      regencyId,
    } = input;

    if (!name.trim()) return { success: false, error: "Nama wajib diisi" };
    if (!gender)
      return { success: false, error: "Jenis kelamin wajib dipilih" };
    if (!source) return { success: false, error: "Sumber data wajib dipilih" };

    const student = await prisma.student.create({
      data: {
        name: name.trim(),
        gender,
        ttl: ttl?.trim() || null,
        dormitory: dormitory?.trim() || null,
        fullAddress: fullAddress?.trim() || null,
        source,
        fromApi: false,
        status: status ?? true,
        parrentPhone: parrentPhone?.trim() || null,
        provinceId: provinceId ?? null,
        regencyId: regencyId ?? null,
      },
    });

    logger.info({ studentId: student.id, source }, "student.manual.created");
    revalidatePath("/santri");

    return { success: true, id: student.id };
  } catch (error) {
    logger.error({ error, input }, "student.manual.create.failed");
    return { success: false, error: "Gagal menyimpan data santri" };
  }
}

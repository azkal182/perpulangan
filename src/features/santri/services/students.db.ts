import { StudentWhereInput } from "@/generated/prisma/models";
import prisma from "@/lib/prisma";
import { logger } from "@/server/logger";

/**
 * Get count of students without provinceId or regencyId
 */
export async function getIncompleteRegionalCount() {
  try {
    const count = await prisma.student.count({
      where: {
        OR: [{ provinceId: null }, { regencyId: null }],
      },
    });
    return count;
  } catch (error) {
    logger.error(
      { err: error },
      "students.db.getIncompleteRegionalCount failed",
    );
    return 0;
  }
}

export async function getStudentsPage(
  page: number,
  pageSize: number,
  q?: string,
  status?: string,
  korwilId?: string,
  kordaId?: string,
  incompleteRegional?: boolean,
) {
  const query = (q ?? "").trim();
  const korwilRaw = (korwilId ?? "").trim();
  const kordaRaw = (kordaId ?? "").trim();
  const korwil = korwilRaw && korwilRaw !== "all" ? korwilRaw : "";
  const korda = kordaRaw && kordaRaw !== "all" ? kordaRaw : "";

  const safePage = Math.max(1, page);
  const safeSize = Math.min(Math.max(1, pageSize), 50);
  const skip = (safePage - 1) * safeSize;

  const where: StudentWhereInput = {};

  if (q) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { nis: { contains: query, mode: "insensitive" } },
    ];
  }

  if (status && status !== "all") {
    where.status = status === "active" ? true : false;
  }

  if (korwil || korda) {
    const regencyWhere: Record<string, unknown> = {};
    if (korda) regencyWhere.kordaId = korda;
    if (korwil) regencyWhere.korda = { korwilId: korwil };
    where.regency = regencyWhere as StudentWhereInput["regency"];
  }

  // Filter for incomplete regional data
  if (incompleteRegional) {
    where.OR = [...(where.OR || []), { provinceId: null }, { regencyId: null }];
  }

  //   where.provinceId = 11;

  try {
    const [total, students] = await prisma.$transaction([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        skip,
        take: safeSize,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          nis: true,
          dormitory: true,
          status: true,
          gender: true,
          provinceId: true,
          regencyId: true,
          districtId: true,
          regency: {
            select: {
              name: true,
              korda: {
                select: {
                  id: true,
                  name: true,
                  korwil: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },

          // kalau belum punya field pembayaran/rombongan/titikTurun, kita akan fallback
        },
      }),
    ]);

    logger.debug(
      { count: students.length, total, page, pageSize },
      "students.db.getStudentsPage success",
    );
    return { total, students, page: safePage, pageSize: safeSize };
  } catch (error) {
    logger.error(
      { err: error, page, pageSize, q, status, korwilId },
      "students.db.getStudentsPage failed",
    );
    throw error;
  }
}

import { StudentWhereInput } from "@/generated/prisma/models";
import prisma from "@/lib/prisma";
import { logger } from "@/server/logger";
import {
  andWhere,
  getRegionalAccessScope,
  studentScopeWhere,
} from "@/server/access-scope";

/** Count students whose city/regency has not been mapped. */
export async function getMissingCityCount() {
  try {
    const scope = await getRegionalAccessScope();
    const count = await prisma.student.count({
      where: andWhere(
        { regencyId: null } as StudentWhereInput,
        studentScopeWhere(scope) as StudentWhereInput | undefined,
      ),
    });
    return count;
  } catch (error) {
    logger.error(
      { err: error },
      "students.db.getMissingCityCount failed",
    );
    return 0;
  }
}

/** Count students whose regency exists but is not linked to a Korda. */
export async function getUnlinkedKordaCount() {
  try {
    const scope = await getRegionalAccessScope();
    return await prisma.student.count({
      where: andWhere(
        { regencyId: { not: null }, regency: { kordaId: null } } as StudentWhereInput,
        studentScopeWhere(scope) as StudentWhereInput | undefined,
      ),
    });
  } catch (error) {
    logger.error({ err: error }, "students.db.getUnlinkedKordaCount failed");
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
  missingCity?: boolean,
  unlinkedKorda?: boolean,
) {
  const scope = await getRegionalAccessScope();

  const query = (q ?? "").trim();
  const korwilRaw = (korwilId ?? "").trim();
  const kordaRaw = (kordaId ?? "").trim();
  const korwil = korwilRaw && korwilRaw !== "all" ? korwilRaw : "";
  const korda = kordaRaw && kordaRaw !== "all" ? kordaRaw : "";

  const safePage = Math.max(1, page);
  const safeSize = Math.min(Math.max(1, pageSize), 50);
  const skip = (safePage - 1) * safeSize;

  const filters: StudentWhereInput[] = [];

  if (query) {
    filters.push({ OR: [
      { name: { contains: query, mode: "insensitive" } },
      { nis: { contains: query, mode: "insensitive" } },
    ] });
  }

  if (status && status !== "all") {
    filters.push({ status: status === "active" });
  }

  if (korwil || korda) {
    const regencyWhere: Record<string, unknown> = {};
    if (korda) regencyWhere.kordaId = korda;
    if (korwil) regencyWhere.korda = { korwilId: korwil };
    filters.push({ regency: regencyWhere as StudentWhereInput["regency"] });
  }

  if (missingCity) {
    filters.push({ regencyId: null });
  }

  if (unlinkedKorda) {
    filters.push({ regencyId: { not: null }, regency: { kordaId: null } });
  }

  const where: StudentWhereInput = filters.length ? { AND: filters } : {};

  //   where.provinceId = 11;

  const finalWhere =
    andWhere(
      Object.keys(where).length > 0 ? where : undefined,
      studentScopeWhere(scope) as StudentWhereInput | undefined,
    ) ?? {};

  try {
    const [total, students] = await prisma.$transaction([
      prisma.student.count({ where: finalWhere }),
      prisma.student.findMany({
        where: finalWhere,
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
          sourceAddress: true,
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

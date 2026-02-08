import { StudentWhereInput } from "@/generated/prisma/models";
import prisma from "@/lib/prisma";

export async function getStudentsPage(
  page: number,
  pageSize: number,
  q?: string,
  status?: string,
) {
  const query = (q ?? "").trim();

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

  const [total, students] = await prisma.$transaction([
    prisma.student.count(),
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
        // kalau belum punya field pembayaran/rombongan/titikTurun, kita akan fallback
      },
    }),
  ]);

  return { total, students, page: safePage, pageSize: safeSize };
}

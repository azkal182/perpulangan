import prisma from "@/lib/prisma";

export async function getStudentsPage(page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(Math.max(1, pageSize), 50);
  const skip = (safePage - 1) * safeSize;

  const [total, students] = await prisma.$transaction([
    prisma.student.count(),
    prisma.student.findMany({
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

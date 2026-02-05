import prisma from "@/lib/prisma";

export async function getStudentsLastSync() {
  const row = await prisma.syncLog.findUnique({
    where: { key: "students" },
    select: { lastSyncAt: true, lastStatus: true, lastSummary: true },
  });

  return {
    lastSyncAt: row?.lastSyncAt ?? null,
    lastStatus: row?.lastStatus ?? null,
    lastSummary: row?.lastSummary ?? null,
  };
}

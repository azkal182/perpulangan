import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PurgeHistory, type PurgeHistoryRow } from "@/features/registrations-management/components/PurgeHistory";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getRegionalAccessScope } from "@/server/access-scope";

export default async function RegistrationPurgeHistoryPage() {
  const scope = await getRegionalAccessScope();
  if (scope.role !== "admin") redirect("/dashboard");
  const records = await prisma.registrationPurge.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { evidenceCleanup: { orderBy: { createdAt: "asc" } } },
  });
  return <Card className="mx-auto w-full max-w-6xl"><CardHeader><CardTitle>Riwayat Hapus Permanen</CardTitle><CardDescription>Audit purge registrasi dan transaksi keluarga. Penghapusan file bukti yang gagal dapat diulang dari halaman ini.</CardDescription></CardHeader><CardContent>{records.length ? <PurgeHistory rows={records as unknown as PurgeHistoryRow[]} /> : <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada riwayat hapus permanen.</p>}</CardContent></Card>;
}

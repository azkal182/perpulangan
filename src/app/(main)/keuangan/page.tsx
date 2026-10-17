import Link from "next/link";
import prisma from "@/lib/prisma";
import { getRegionalAccessScope } from "@/server/access-scope";
import { TreasuryDisbursementForm } from "@/features/payment/components/TreasuryDisbursementForm";
import { getTreasuryPosition } from "@/features/payment/services/treasury-position";

const money = (amount: number) => `Rp${amount.toLocaleString("id-ID")}`;
const dateLabel = (date: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(date);
const asDate = (value?: string, end = false) => {
  if (!value) return undefined;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}+07:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export default async function KeuanganPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const scope = await getRegionalAccessScope();
  if (scope.role !== "admin") {
    return <main className="mx-auto w-full max-w-3xl p-4 sm:p-8"><section className="rounded-xl border border-destructive/20 bg-destructive/10 p-6"><h1 className="font-semibold text-destructive">Akses ditolak</h1><p className="mt-1 text-sm text-destructive/80">Keuangan pusat hanya dapat diakses oleh admin.</p></section></main>;
  }
  const params = await searchParams;
  const destinationId = typeof params.korda === "string" ? params.korda : "";
  const fromValue = typeof params.dari === "string" ? params.dari : "";
  const toValue = typeof params.sampai === "string" ? params.sampai : "";
  const from = asDate(fromValue);
  const to = asDate(toValue, true);
  const position = await getTreasuryPosition(scope);
  const chosenKordaId = position.kordas.some((korda) => korda.id === destinationId) ? destinationId : "";
  const history = await prisma.treasuryDisbursement.findMany({
    where: {
      korda: scope.role === "admin" ? {} : scope.role === "korwil" ? { korwilId: scope.korwilId ?? "__NO_ACCESS__" } : { id: scope.kordaId ?? "__NO_ACCESS__" },
      ...(chosenKordaId ? { kordaId: chosenKordaId } : {}),
      ...(from || to ? { disbursedAt: { gte: from, lte: to } } : {}),
    },
    include: { korda: { select: { name: true } } },
    orderBy: { disbursedAt: "desc" },
    take: 200,
  });
  const actorIds = [...new Set(history.map((row) => row.createdByUserId))];
  const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, username: true } }) : [];
  const actorNames = new Map(actors.map((actor) => [actor.id, actor.name || actor.username || actor.id]));
  const payoutOptions = position.positions.map((row) => ({
    id: row.id,
    name: row.name,
    available: Math.max(0, Math.min(position.centralBalance ?? 0, row.heldAtCenter)),
  }));
  const unallocated = position.unallocatedCentralCash ?? 0;

  return <main className="mx-auto w-full min-w-0 max-w-7xl space-y-6 p-3 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold tracking-tight">Keuangan pusat</h1><p className="mt-1 text-sm text-muted-foreground">Pantau kas rekening bendahara, dana yang masih di pusat untuk tiap Korda, dan pencairan yang sudah dilakukan.</p></div>
      <Link href="/laporan" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">Buka laporan</Link>
    </header>

    {scope.role === "admin" && <section className="grid gap-3 sm:grid-cols-2">
      <article className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Saldo kas pusat tercatat</p><strong className="mt-1 block text-2xl">{money(position.centralBalance ?? 0)}</strong><p className="mt-1 text-xs text-muted-foreground">Pembayaran masuk − refund aktual − pencairan tercatat.</p></article>
      <article className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Kas belum teralokasi / selisih</p><strong className={`mt-1 block text-2xl ${unallocated < 0 ? "text-destructive" : ""}`}>{money(unallocated)}</strong><p className="mt-1 text-xs text-muted-foreground">Selisih kas pusat terhadap sisa dana yang tercatat untuk seluruh Korda.</p></article>
    </section>}

    {scope.role === "admin" && <section className="space-y-3"><div><h2 className="text-lg font-semibold">Catat pencairan aktual</h2><p className="text-sm text-muted-foreground">Gunakan setelah uang benar-benar diserahkan. Ini bukan formulir permintaan penarikan atau instruksi transfer.</p></div><TreasuryDisbursementForm kordas={payoutOptions}/></section>}

    <section className="space-y-3"><div><h2 className="text-lg font-semibold">Posisi dana per Korda</h2><p className="text-sm text-muted-foreground">Dana bersih yang tercatat untuk Korda dibandingkan dengan pencairan aktual dari pusat.</p></div>
      <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[620px] text-sm"><thead className="bg-muted/50 text-left"><tr>{["Korda tujuan", "Dana tercatat untuk Korda", "Sudah dicairkan", "Masih di pusat"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead>
        <tbody>{position.positions.map((row) => <tr key={row.id} className="border-t"><td className="p-3">{row.name}</td><td className="p-3">{money(row.assigned)}</td><td className="p-3">{money(row.disbursed)}</td><td className={`p-3 font-semibold ${row.heldAtCenter < 0 ? "text-destructive" : ""}`}>{money(row.heldAtCenter)}</td></tr>)}</tbody>
        <tfoot className="border-t bg-muted/30 font-semibold"><tr><td className="p-3">Total cakupan</td><td className="p-3">{money(position.totalAssigned)}</td><td className="p-3">{money(position.totalDisbursed)}</td><td className="p-3">{money(position.totalHeldAtCenter)}</td></tr></tfoot>
      </table></div>
    </section>

    <section className="space-y-3"><div><h2 className="text-lg font-semibold">Riwayat pencairan</h2><p className="text-sm text-muted-foreground">Pencatatan pencairan aktual yang sudah dibuat dalam cakupan Anda.</p></div>
      <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-end">
        <label className="grid gap-1 text-sm">Korda<select name="korda" defaultValue={chosenKordaId} className="rounded-md border bg-background px-3 py-2"><option value="">Semua Korda</option>{position.kordas.map((korda) => <option key={korda.id} value={korda.id}>{korda.name}</option>)}</select></label>
        <label className="grid gap-1 text-sm">Dari<input name="dari" type="date" defaultValue={fromValue} className="rounded-md border bg-background px-3 py-2"/></label>
        <label className="grid gap-1 text-sm">Sampai<input name="sampai" type="date" defaultValue={toValue} className="rounded-md border bg-background px-3 py-2"/></label>
        <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">Tampilkan</button>
      </form>
      {history.length ? <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[620px] text-sm"><thead className="bg-muted/50 text-left"><tr>{["Tanggal", "Korda penerima", "Nominal", "Catatan", "Pencatat"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{history.map((row) => <tr key={row.id} className="border-t"><td className="p-3">{dateLabel(row.disbursedAt)}</td><td className="p-3">{row.korda.name}</td><td className="p-3 font-semibold">{money(row.amount)}</td><td className="p-3">{row.note ?? "—"}</td><td className="p-3">{actorNames.get(row.createdByUserId) ?? "Akun tidak ditemukan"}</td></tr>)}</tbody></table></div> : <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Belum ada pencairan dalam cakupan ini.</p>}
    </section>
  </main>;
}

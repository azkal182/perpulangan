import Link from "next/link";
import prisma from "@/lib/prisma";
import { getRegionalAccessScope } from "@/server/access-scope";
import { TreasuryDisbursementForm } from "@/features/payment/components/TreasuryDisbursementForm";
import { getTreasuryPosition } from "@/features/payment/services/treasury-position";
import { FinanceContextNote, FinanceHowToRead } from "@/features/payment/components/FinanceContextNote";
import { TreasuryExportButton } from "@/features/payment/components/TreasuryExportButton.client";
import { TreasuryPdfExportButton } from "@/features/payment/components/TreasuryPdfExportButton.client";
import type { FinanceJourneyFilter } from "@/features/payment/services/treasury-position";

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
  const requestedDirection = typeof params.perjalanan === "string" ? params.perjalanan : "both";
  const direction: FinanceJourneyFilter = requestedDirection === "outbound" || requestedDirection === "return" ? requestedDirection : "both";
  const directionLabel = direction === "outbound" ? "Pulang saja" : direction === "return" ? "Pergi saja" : "Pulang & Pergi";
  const from = asDate(fromValue);
  const to = asDate(toValue, true);
  const position = await getTreasuryPosition(scope, direction);
  const globalPosition = direction === "both" ? position : await getTreasuryPosition(scope, "both");
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

    <FinanceContextNote mode="global" />

    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div><h2 className="font-semibold">Filter perjalanan</h2><p className="mt-1 text-sm text-muted-foreground">Pilih perjalanan yang dihitung pada tagihan, fee, peserta, dan penerimaan teralokasi.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <form className="flex flex-col gap-1 text-sm sm:flex-row sm:items-end">
            <label className="grid gap-1">Perjalanan<select name="perjalanan" defaultValue={direction} className="rounded-md border bg-background px-3 py-2"><option value="both">Pulang dan pergi</option><option value="outbound">Pulang saja</option><option value="return">Pergi saja</option></select></label>
            <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">Terapkan</button>
          </form>
          <TreasuryExportButton direction={direction} />
          <TreasuryPdfExportButton />
        </div>
      </div>
      {direction !== "both" && <p className="mt-3 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">Kas pusat, pencairan, dan Saldo Lain tetap bersifat global karena belum memiliki atribusi arah perjalanan pada data sumber.</p>}
    </section>

    {scope.role === "admin" && <>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Tagihan & hak pendaftaran</h2>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{directionLabel}</span>
        </div>
        <p className="text-sm text-muted-foreground">Mengikuti filter perjalanan di atas. Menampilkan posisi estimasi tagihan pendaftaran serta realisasi uang masuk yang sudah teralokasi.</p>

        {/* Baris 1: Sisi Tagihan (Pendaftar) */}
        <div className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border bg-card p-4 ring-1 ring-primary/20"><p className="text-sm text-muted-foreground">Tagihan bruto</p><strong className="mt-1 block text-2xl">{money(position.totalGrossBilled)}</strong><p className="mt-1 text-xs text-muted-foreground">Tarif perjalanan REGISTERED sesuai filter.</p></article>
          <article className="rounded-xl border bg-card p-4 ring-1 ring-primary/20"><p className="text-sm text-muted-foreground">Fee tagihan</p><strong className="mt-1 block text-2xl">{money(position.totalFee)}</strong><p className="mt-1 text-xs text-muted-foreground">Rp10.000 × seluruh perjalanan REGISTERED.</p></article>
          <article className="rounded-xl border bg-card p-4 ring-1 ring-primary/20"><p className="text-sm text-muted-foreground">Hak setelah fee</p><strong className="mt-1 block text-2xl">{money(position.totalRegistrationEntitlement)}</strong><p className="mt-1 text-xs text-muted-foreground">Tagihan dikurangi fee; potensi hak jika lunas.</p></article>
        </div>

        {/* Baris 2: Sisi Realisasi (Uang Masuk & Lunas) */}
        <div className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border bg-card p-4 ring-1 ring-emerald-500/30 bg-emerald-500/[0.02]"><p className="text-sm text-muted-foreground">Uang masuk teralokasi</p><strong className="mt-1 block text-2xl text-emerald-600 dark:text-emerald-400">{money(position.totalRegistrationReceived)}</strong><p className="mt-1 text-xs text-muted-foreground">Pembayaran yang masuk untuk tiket perjalanan sesuai filter.</p></article>
          <article className="rounded-xl border bg-card p-4 ring-1 ring-emerald-500/30 bg-emerald-500/[0.02]"><p className="text-sm text-muted-foreground">Fee (tiket lunas)</p><strong className="mt-1 block text-2xl">{money(position.totalFeePaid)}</strong><p className="mt-1 text-xs text-muted-foreground">Rp10.000 × {position.totalPaidJourneyCount} tiket yang sudah lunas.</p></article>
          <article className="rounded-xl border bg-card p-4 ring-1 ring-emerald-500/30 bg-emerald-500/[0.02]"><p className="text-sm text-muted-foreground">Hak dari uang masuk</p><strong className="mt-1 block text-2xl font-bold">{money(Math.max(0, position.totalRegistrationReceived - position.totalFeePaid))}</strong><p className="mt-1 text-xs text-muted-foreground">Uang masuk teralokasi dikurangi fee tiket lunas.</p></article>
        </div>
      </section>
      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-border" />
        <p className="shrink-0 text-xs text-muted-foreground">Data di bawah selalu global — tidak berubah saat filter perjalanan diubah</p>
        <div className="h-px flex-1 bg-border" />
      </div>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Kas rekening & pengeluaran</h2>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Semua event · Semua arah</span>
        </div>
        <p className="text-sm text-muted-foreground">Satu pembayaran atau refund dapat mencakup Pulang dan Pergi sekaligus, sehingga tidak dapat difilter per arah perjalanan.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Uang masuk (sesuai rek)</p><strong className="mt-1 block text-2xl">{money(globalPosition.totalPaymentReceipts ?? 0)}</strong><p className="mt-1 text-xs text-muted-foreground">Total pembayaran tercatat, sebelum refund dan pencairan.</p></article>
          <article className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Kelebihan pembayaran</p><strong className="mt-1 block text-2xl">{money(globalPosition.totalBalanceCash)}</strong><p className="mt-1 text-xs text-muted-foreground">Saldo Lain bersih semua Korda tujuan.</p></article>
          <article className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Total pengeluaran</p><strong className="mt-1 block text-2xl">{money(globalPosition.totalExpenses)}</strong><p className="mt-1 text-xs text-muted-foreground">Refund aktual ditambah pencairan ke Korda.</p></article>
          <article className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Kas</p><strong className="mt-1 block text-2xl">{money(globalPosition.centralBalance ?? 0)}</strong><p className="mt-1 text-xs text-muted-foreground">Uang masuk dikurangi total pengeluaran.</p></article>
        </div>
      </section>
    </>}

    <FinanceHowToRead />

    {position.cancelledJourneyCount > 0 && <p className="text-sm text-muted-foreground">{position.cancelledJourneyCount} perjalanan berstatus CANCELLED tidak masuk perhitungan fee Rp10.000.</p>}

    {scope.role === "admin" && direction === "both" && <section className="space-y-3"><div><h2 className="text-lg font-semibold">Catat pencairan aktual</h2><p className="text-sm text-muted-foreground">Gunakan setelah uang benar-benar diserahkan. Ini bukan formulir permintaan penarikan atau instruksi transfer.</p></div><TreasuryDisbursementForm kordas={payoutOptions}/></section>}

    <section className="space-y-3"><div><h2 className="text-lg font-semibold">Posisi dana per Korda</h2><p className="text-sm text-muted-foreground">Tagihan bruto, fee pusat, hak pembukuan, kelebihan pembayaran, dan pencairan ditampilkan terpisah. Nilai “maksimal dapat dicairkan” dibatasi oleh hak Korda dan kas pusat yang benar-benar tersedia.</p></div>
      <div className="grid gap-3 md:hidden">{position.positions.map((row) => <article key={row.id} className="min-w-0 rounded-xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><h3 className="break-words font-semibold">{row.name}</h3><Link href={`/keuangan/${row.id}?perjalanan=${direction}`} className="shrink-0 text-sm font-medium text-primary underline">Detail</Link></div><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Tagihan bruto</dt><dd className="font-medium">{money(row.grossBilled)}</dd></div><div><dt className="text-muted-foreground">Fee pusat</dt><dd className="font-medium">{money(row.fee)}</dd></div><div><dt className="text-muted-foreground">Hak bersih pendaftaran</dt><dd className="font-medium">{money(row.registrationEntitlement)}</dd></div><div><dt className="text-muted-foreground">Kelebihan pembayaran</dt><dd className="font-medium">{money(row.balanceCash)}</dd></div><div><dt className="text-muted-foreground">Sudah dicairkan</dt><dd className="font-medium">{money(row.disbursed)}</dd></div><div className="col-span-2 border-t pt-3"><dt className="text-muted-foreground">Maksimal dapat dicairkan</dt><dd className={`font-semibold ${row.heldAtCenter < 0 ? "text-destructive" : ""}`}>{money(Math.max(0, Math.min(position.centralBalance ?? 0, row.heldAtCenter)))}</dd></div></dl></article>)}<article className="rounded-xl border bg-muted/30 p-4"><h3 className="font-semibold">Total cakupan</h3><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Tagihan bruto</dt><dd className="font-medium">{money(position.totalGrossBilled)}</dd></div><div><dt className="text-muted-foreground">Fee pusat</dt><dd className="font-medium">{money(position.totalFee)}</dd></div><div><dt className="text-muted-foreground">Hak bersih pendaftaran</dt><dd className="font-medium">{money(position.totalRegistrationEntitlement)}</dd></div><div><dt className="text-muted-foreground">Hak bersih + kelebihan pembayaran</dt><dd className="font-medium">{money(position.totalAssigned)}</dd></div><div><dt className="text-muted-foreground">Kelebihan pembayaran</dt><dd className="font-medium">{money(position.totalBalanceCash)}</dd></div><div><dt className="text-muted-foreground">Sudah dicairkan</dt><dd className="font-medium">{money(position.totalDisbursed)}</dd></div><div className="col-span-2 border-t pt-3"><dt className="text-muted-foreground">Sisa hak sebelum batas kas pusat</dt><dd className="font-semibold">{money(position.totalHeldAtCenter)}</dd></div></dl></article></div>
      <div className="hidden overflow-x-auto rounded-xl border md:block"><table className="w-full min-w-[1100px] text-sm"><thead className="bg-muted/50 text-left"><tr>{["Korda tujuan", "Tagihan bruto", "Fee pusat", "Hak bersih pendaftaran", "Kelebihan pembayaran", "Sudah dicairkan", "Maksimal dapat dicairkan", ""].map((label, index) => <th key={`${label}-${index}`} className="p-3">{label}</th>)}</tr></thead>
        <tbody>{position.positions.map((row) => <tr key={row.id} className="border-t"><td className="p-3">{row.name}</td><td className="p-3">{money(row.grossBilled)}</td><td className="p-3">{money(row.fee)}</td><td className="p-3">{money(row.registrationEntitlement)}</td><td className="p-3">{money(row.balanceCash)}</td><td className="p-3">{money(row.disbursed)}</td><td className="p-3 font-semibold">{money(Math.max(0, Math.min(position.centralBalance ?? 0, row.heldAtCenter)))}</td><td className="p-3"><Link href={`/keuangan/${row.id}?perjalanan=${direction}`} className="font-medium text-primary underline">Detail</Link></td></tr>)}</tbody>
        <tfoot className="border-t bg-muted/30 font-semibold"><tr><td className="p-3">Total cakupan</td><td className="p-3">{money(position.totalGrossBilled)}</td><td className="p-3">{money(position.totalFee)}</td><td className="p-3">{money(position.totalRegistrationEntitlement)}</td><td className="p-3">{money(position.totalBalanceCash)}</td><td className="p-3">{money(position.totalDisbursed)}</td><td className="p-3 text-muted-foreground">Lihat per Korda</td><td></td></tr></tfoot>
      </table></div>
    </section>

    <section className="space-y-3"><div><h2 className="text-lg font-semibold">Riwayat pencairan</h2><p className="text-sm text-muted-foreground">Pencatatan pencairan aktual yang sudah dibuat dalam cakupan Anda.</p></div>
      <form className="grid min-w-0 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-end">
        <input type="hidden" name="perjalanan" value={direction} />
        <label className="grid min-w-0 gap-1 text-sm">Korda<select name="korda" defaultValue={chosenKordaId} className="w-full min-w-0 max-w-full rounded-md border bg-background px-3 py-2"><option value="">Semua Korda</option>{position.kordas.map((korda) => <option key={korda.id} value={korda.id}>{korda.name}</option>)}</select></label>
        <label className="grid min-w-0 gap-1 text-sm">Dari<input name="dari" type="date" defaultValue={fromValue} className="w-full min-w-0 max-w-full rounded-md border bg-background px-3 py-2"/></label>
        <label className="grid min-w-0 gap-1 text-sm">Sampai<input name="sampai" type="date" defaultValue={toValue} className="w-full min-w-0 max-w-full rounded-md border bg-background px-3 py-2"/></label>
        <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">Tampilkan</button>
      </form>
      {history.length ? <><div className="grid gap-3 md:hidden">{history.map((row) => <article key={row.id} className="min-w-0 rounded-xl border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words font-semibold">{row.korda.name}</h3><p className="text-sm text-muted-foreground">{dateLabel(row.disbursedAt)}</p></div><strong className="shrink-0">{money(row.amount)}</strong></div><dl className="mt-3 grid gap-3 border-t pt-3 text-sm"><div><dt className="text-muted-foreground">Catatan</dt><dd className="break-words">{row.note ?? "—"}</dd></div><div><dt className="text-muted-foreground">Pencatat</dt><dd className="break-words">{actorNames.get(row.createdByUserId) ?? "Akun tidak ditemukan"}</dd></div></dl></article>)}</div><div className="hidden overflow-x-auto rounded-xl border md:block"><table className="w-full min-w-[620px] text-sm"><thead className="bg-muted/50 text-left"><tr>{["Tanggal", "Korda penerima", "Nominal", "Catatan", "Pencatat"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{history.map((row) => <tr key={row.id} className="border-t"><td className="p-3">{dateLabel(row.disbursedAt)}</td><td className="p-3">{row.korda.name}</td><td className="p-3 font-semibold">{money(row.amount)}</td><td className="p-3">{row.note ?? "—"}</td><td className="p-3">{actorNames.get(row.createdByUserId) ?? "Akun tidak ditemukan"}</td></tr>)}</tbody></table></div></> : <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Belum ada pencairan dalam cakupan ini.</p>}
    </section>
  </main>;
}

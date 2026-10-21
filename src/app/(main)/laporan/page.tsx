import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { getRegionalAccessScope } from "@/server/access-scope";
import { eventBalanceEntryWhere, getEventContext } from "@/server/event-context";
import { CENTRAL_FEE_PER_JOURNEY } from "@/features/payment/services/korda-finance-detail";

const money = (amount: number) => `Rp${amount.toLocaleString("id-ID")}`;
const BALANCE_PAGE_SIZE = 50;
const dateFilter = (value: string, end = false) => {
  if (!value) return undefined;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}+07:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export default async function LaporanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const scope = await getRegionalAccessScope();
  const params = await searchParams;
  const eventContext = await getEventContext(scope);
  const kordaId = typeof params.korda === "string" ? params.korda : "";
  const direction = typeof params.arah === "string" && ["OUTBOUND", "RETURN"].includes(params.arah) ? params.arah : "";
  const fromValue = typeof params.dari === "string" ? params.dari : "";
  const toValue = typeof params.sampai === "string" ? params.sampai : "";
  const balancePage = Math.max(1, Number(params.saldoPage) || 1);
  const from = dateFilter(fromValue);
  const to = dateFilter(toValue, true);
  const regionalKorda: Prisma.KordaWhereInput = scope.role === "admin" ? {} : scope.role === "korwil" ? { korwilId: scope.korwilId ?? "__NO_ACCESS__" } : { id: scope.kordaId ?? "__NO_ACCESS__" };
  const kordas = await prisma.korda.findMany({ where: regionalKorda, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const selectedEventId = eventContext.selectedEvent?.id ?? "__NO_EVENT_SELECTED__";
  const selectedKordaId = kordas.some((korda) => korda.id === kordaId) ? kordaId : "";
  const journeyScope: Prisma.JourneyWhereInput = {
    destinationKorda: { is: regionalKorda },
    registration: { eventId: selectedEventId },
    ...(selectedKordaId ? { destinationKordaId: selectedKordaId } : {}),
    ...(direction ? { direction: direction as "OUTBOUND" | "RETURN" } : {}),
  };
  const billableJourneyScope: Prisma.JourneyWhereInput = { ...journeyScope, status: "REGISTERED" };
  const activityDate = from || to ? { gte: from, lte: to } : undefined;
  const balanceScope: Prisma.KordaBalanceEntryWhereInput = { AND: [eventBalanceEntryWhere(selectedEventId), { ownerKorda: { is: regionalKorda }, ...(selectedKordaId ? { ownerKordaId: selectedKordaId } : {}), ...(activityDate ? { createdAt: activityDate } : {}) }] };
  const [journeys, allocations, refunds, corrections, balances, balanceTotals, balanceCount] = await Promise.all([
    prisma.journey.findMany({ where: billableJourneyScope, select: { id: true, direction: true, tariffSnapshot: true, destinationKordaId: true, destinationKordaNameSnapshot: true, registration: { select: { event: { select: { name: true } } } }, paymentAllocations: { where: { type: "JOURNEY" }, select: { amount: true, refunds: { select: { amount: true } }, corrections: { select: { amount: true } } } } } }),
    prisma.paymentAllocation.findMany({ where: { type: "JOURNEY", journey: journeyScope, ...(activityDate ? { payment: { paidAt: activityDate } } : {}) }, select: { amount: true, journey: { select: { direction: true, destinationKordaNameSnapshot: true } }, payment: { select: { paidAt: true } } } }),
    prisma.refund.findMany({ where: { paymentAllocation: { type: "JOURNEY", journey: journeyScope }, ...(activityDate ? { refundedAt: activityDate } : {}) }, select: { amount: true, refundedAt: true, paymentAllocation: { select: { journey: { select: { direction: true, destinationKordaNameSnapshot: true } } } } } }),
    prisma.financialCorrection.findMany({ where: { paymentAllocation: { type: "JOURNEY", journey: journeyScope }, ...(activityDate ? { correctedAt: activityDate } : {}) }, select: { amount: true, correctedAt: true, paymentAllocation: { select: { journey: { select: { direction: true, destinationKordaNameSnapshot: true } } } } } }),
    prisma.kordaBalanceEntry.findMany({ where: balanceScope, select: { id: true, entryType: true, amount: true, originKordaNameSnapshot: true, destinationKordaNameSnapshot: true, participantNameSnapshot: true, createdAt: true, ownerKorda: { select: { name: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (balancePage - 1) * BALANCE_PAGE_SIZE, take: BALANCE_PAGE_SIZE }),
    prisma.kordaBalanceEntry.groupBy({ by: ["entryType"], where: balanceScope, _sum: { amount: true } }),
    prisma.kordaBalanceEntry.count({ where: balanceScope }),
  ]);

  const groups = new Map<string, { korda: string; direction: string; billed: number; fee: number; received: number; refunded: number; corrected: number; outstanding: number }>();
  const groupFor = (korda: string, dir: string) => {
    const key = `${korda}:${dir}`;
    if (!groups.has(key)) groups.set(key, { korda, direction: dir, billed: 0, fee: 0, received: 0, refunded: 0, corrected: 0, outstanding: 0 });
    return groups.get(key)!;
  };
  for (const journey of journeys) {
    const row = groupFor(journey.destinationKordaNameSnapshot, journey.direction);
    const net = journey.paymentAllocations.reduce((sum, item) => sum + item.amount - item.refunds.reduce((n, refund) => n + refund.amount, 0) - item.corrections.reduce((n, correction) => n + correction.amount, 0), 0);
    row.billed += journey.tariffSnapshot ?? 0;
    if (journey.tariffSnapshot !== null && journey.tariffSnapshot > 0) row.fee += CENTRAL_FEE_PER_JOURNEY;
    row.outstanding += journey.tariffSnapshot === null ? 0 : Math.max(0, journey.tariffSnapshot - net);
  }
  for (const allocation of allocations) if (allocation.journey) groupFor(allocation.journey.destinationKordaNameSnapshot, allocation.journey.direction).received += allocation.amount;
  for (const refund of refunds) { const journey = refund.paymentAllocation?.journey; if (journey) groupFor(journey.destinationKordaNameSnapshot, journey.direction).refunded += refund.amount; }
  for (const correction of corrections) { const journey = correction.paymentAllocation?.journey; if (journey) groupFor(journey.destinationKordaNameSnapshot, journey.direction).corrected += correction.amount; }
  const reportRows = [...groups.values()].sort((a, b) => a.korda.localeCompare(b.korda, "id") || a.direction.localeCompare(b.direction));
  const total = reportRows.reduce((sum, row) => ({ billed: sum.billed + row.billed, fee: sum.fee + row.fee, received: sum.received + row.received, refunded: sum.refunded + row.refunded, corrected: sum.corrected + row.corrected, outstanding: sum.outstanding + row.outstanding }), { billed: 0, fee: 0, received: 0, refunded: 0, corrected: 0, outstanding: 0 });
  const totalNetEntitlement = Math.max(0, total.billed - total.fee);
  const balanceCredits = balanceTotals.reduce((sum, row) => sum + (row.entryType === "CREDIT" ? Math.abs(row._sum.amount ?? 0) : -Math.abs(row._sum.amount ?? 0)), 0);
  const balancePageCount = Math.max(1, Math.ceil(balanceCount / BALANCE_PAGE_SIZE));
  const balancePageHref = (page: number) => `/laporan?korda=${encodeURIComponent(selectedKordaId)}&arah=${encodeURIComponent(direction)}&dari=${encodeURIComponent(fromValue)}&sampai=${encodeURIComponent(toValue)}&saldoPage=${page}`;

  return <main className="mx-auto w-full min-w-0 max-w-7xl space-y-6 p-3 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight">Laporan keuangan</h1><p className="mt-1 text-sm text-muted-foreground">Ringkasan baca-saja tagihan, penerimaan, refund, koreksi, dan Saldo Lain sesuai cakupan akses Anda.</p></div><div className="flex flex-wrap gap-2"><Link href="/pembayaran" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">Pembayaran</Link><Link href="/refund" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">Refund</Link>{scope.role === "admin" && <Link href="/keuangan" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">Keuangan pusat</Link>}</div></header>
    {!eventContext.selectedEvent && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{eventContext.events.length ? "Pilih event historis dari header untuk melihat laporan." : "Belum ada event yang tersedia pada cakupan Anda."}</p>}
    <form className="grid min-w-0 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <label className="grid min-w-0 gap-1 text-sm">Korda tujuan<select name="korda" defaultValue={selectedKordaId} className="w-full min-w-0 max-w-full rounded-md border bg-background px-3 py-2"><option value="">Semua Korda</option>{kordas.map((korda) => <option key={korda.id} value={korda.id}>{korda.name}</option>)}</select></label>
      <label className="grid min-w-0 gap-1 text-sm">Perjalanan<select name="arah" defaultValue={direction} className="w-full min-w-0 max-w-full rounded-md border bg-background px-3 py-2"><option value="">Pulang & Kembali</option><option value="OUTBOUND">Pulang</option><option value="RETURN">Kembali</option></select></label>
      <label className="grid min-w-0 gap-1 text-sm">Aktivitas dari<input type="date" name="dari" defaultValue={fromValue} className="w-full min-w-0 max-w-full rounded-md border bg-background px-3 py-2"/></label>
      <label className="grid min-w-0 gap-1 text-sm">Aktivitas sampai<input type="date" name="sampai" defaultValue={toValue} className="w-full min-w-0 max-w-full rounded-md border bg-background px-3 py-2"/></label>
      <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground lg:col-span-5">Tampilkan laporan</button>
    </form>
    {activityDate && <p className="text-sm text-muted-foreground">Rentang tanggal berlaku untuk penerimaan, refund, koreksi, dan perubahan Saldo Lain. Tagihan, fee, dan hak bersih menunjukkan posisi seluruh waktu untuk event/Korda/arah terpilih.</p>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Tagihan bruto terdaftar", total.billed], ["Fee pusat", total.fee], ["Hak Korda setelah fee", totalNetEntitlement], ["Penerimaan tercatat", total.received], ["Refund aktual", total.refunded], ["Koreksi alokasi", total.corrected], ["Sisa tagihan", total.outstanding]].map(([label, amount]) => <article key={label} className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><strong className="mt-1 block text-xl">{money(Number(amount))}</strong></article>)}</section>
    <section className="space-y-3"><div><h2 className="text-lg font-semibold">Rincian per Korda tujuan dan perjalanan</h2><p className="text-sm text-muted-foreground">Penerimaan, refund, dan koreksi ditampilkan terpisah agar perubahan alokasi tidak disamakan dengan uang yang benar-benar masuk atau keluar.</p></div>
      {reportRows.length ? <>
        <div className="grid gap-3 lg:hidden">{reportRows.map((row) => <article key={`${row.korda}:${row.direction}`} className="min-w-0 rounded-xl border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words font-semibold">{row.korda}</h3><p className="text-sm text-muted-foreground">{row.direction === "OUTBOUND" ? "Pulang" : "Kembali"}</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs">Rincian</span></div><dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-sm"><div><dt className="text-muted-foreground">Tagihan</dt><dd className="break-words font-medium">{money(row.billed)}</dd></div><div><dt className="text-muted-foreground">Penerimaan</dt><dd className="break-words font-medium">{money(row.received)}</dd></div><div><dt className="text-muted-foreground">Refund</dt><dd className="break-words">{money(row.refunded)}</dd></div><div><dt className="text-muted-foreground">Koreksi</dt><dd className="break-words">{money(row.corrected)}</dd></div><div><dt className="text-muted-foreground">Penerimaan bersih</dt><dd className="break-words font-semibold">{money(row.received - row.refunded - row.corrected)}</dd></div><div><dt className="text-muted-foreground">Sisa tagihan</dt><dd className="break-words font-medium">{money(row.outstanding)}</dd></div></dl></article>)}</div>
        <div className="hidden overflow-x-auto rounded-xl border lg:block"><table className="w-full min-w-[900px] text-sm"><thead className="bg-muted/50 text-left"><tr>{["Korda tujuan", "Perjalanan", "Tagihan", "Penerimaan", "Refund", "Koreksi", "Penerimaan bersih", "Sisa tagihan"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{reportRows.map((row) => <tr key={`${row.korda}:${row.direction}`} className="border-t"><td className="p-3">{row.korda}</td><td className="p-3">{row.direction === "OUTBOUND" ? "Pulang" : "Kembali"}</td><td className="p-3">{money(row.billed)}</td><td className="p-3">{money(row.received)}</td><td className="p-3">{money(row.refunded)}</td><td className="p-3">{money(row.corrected)}</td><td className="p-3 font-semibold">{money(row.received - row.refunded - row.corrected)}</td><td className="p-3">{money(row.outstanding)}</td></tr>)}</tbody></table></div>
      </> : <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Belum ada data keuangan pada filter ini.</p>}
    </section>
    <section className="space-y-3"><div><h2 className="text-lg font-semibold">Saldo Lain</h2><p className="text-sm text-muted-foreground">Kredit/kelebihan pembayaran dicatat untuk Korda tujuan. Daftar menampilkan peserta serta Korda asal dan tujuan bila tersedia. Bagian ini mengikuti event terpilih, cakupan Korda, dan tanggal; arah perjalanan tidak diterapkan.</p></div>
      <div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Perubahan bersih Saldo Lain pada cakupan Korda dan tanggal</p><strong className="text-xl">{money(balanceCredits)}</strong></div>
      {balances.length ? <><div className="grid gap-3 md:hidden">{balances.map((row) => <article key={row.id} className="min-w-0 rounded-xl border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words font-semibold">{row.participantNameSnapshot}</h3><p className="text-sm text-muted-foreground">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(row.createdAt)}</p></div><span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs">{row.entryType === "CREDIT" ? "Kredit" : row.entryType === "REFUND" ? "Refund" : "Koreksi"}</span></div><dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-sm"><div><dt className="text-muted-foreground">Korda asal</dt><dd className="break-words">{row.originKordaNameSnapshot ?? "—"}</dd></div><div><dt className="text-muted-foreground">Korda tujuan/pemilik</dt><dd className="break-words">{row.destinationKordaNameSnapshot || row.ownerKorda.name}</dd></div><div className="col-span-2 border-t pt-3"><dt className="text-muted-foreground">Nominal</dt><dd className="font-semibold">{row.entryType === "CREDIT" ? "+" : "−"}{money(Math.abs(row.amount))}</dd></div></dl></article>)}</div><div className="hidden overflow-x-auto rounded-xl border md:block"><table className="w-full min-w-[720px] text-sm"><thead className="bg-muted/50 text-left"><tr>{["Tanggal", "Peserta", "Korda asal", "Korda tujuan/pemilik", "Jenis", "Nominal"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{balances.map((row) => <tr key={row.id} className="border-t"><td className="p-3">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(row.createdAt)}</td><td className="p-3">{row.participantNameSnapshot}</td><td className="p-3">{row.originKordaNameSnapshot ?? "—"}</td><td className="p-3">{row.destinationKordaNameSnapshot || row.ownerKorda.name}</td><td className="p-3">{row.entryType === "CREDIT" ? "Kredit" : row.entryType === "REFUND" ? "Refund" : "Koreksi"}</td><td className="p-3 font-semibold">{row.entryType === "CREDIT" ? "+" : "−"}{money(Math.abs(row.amount))}</td></tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">Menampilkan {Math.min((balancePage - 1) * BALANCE_PAGE_SIZE + 1, balanceCount)}–{Math.min(balancePage * BALANCE_PAGE_SIZE, balanceCount)} dari {balanceCount} entri</span><div className="flex gap-2"><Link aria-disabled={balancePage <= 1} className={`rounded border px-3 py-2 ${balancePage <= 1 ? "pointer-events-none opacity-40" : ""}`} href={balancePageHref(Math.max(1, balancePage - 1))}>Sebelumnya</Link><Link aria-disabled={balancePage >= balancePageCount} className={`rounded border px-3 py-2 ${balancePage >= balancePageCount ? "pointer-events-none opacity-40" : ""}`} href={balancePageHref(Math.min(balancePageCount, balancePage + 1))}>Berikutnya</Link></div></div></> : <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Belum ada perubahan Saldo Lain pada filter ini.</p>}
    </section>
    <p className="text-xs text-muted-foreground">{scope.role === "admin" ? <>Laporan ini bukan catatan kas rekening pusat. Untuk saldo pusat dan pencairan aktual ke Korda, buka Keuangan pusat.</> : "Laporan ini bersifat baca-saja dan menampilkan data sesuai cakupan akses Anda."}</p>
  </main>;
}

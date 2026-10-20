import Link from "next/link";
import { notFound } from "next/navigation";
import { getRegionalAccessScope } from "@/server/access-scope";
import { getKordaFinanceDetail } from "@/features/payment/services/korda-finance-detail";
import { getTreasuryPosition } from "@/features/payment/services/treasury-position";

const money = (amount: number) => `Rp${amount.toLocaleString("id-ID")}`;
const dateLabel = (date: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(date);

export default async function KordaFinanceDetailPage({ params }: { params: Promise<{ kordaId: string }> }) {
  const scope = await getRegionalAccessScope();
  if (scope.role !== "admin") {
    return <main className="mx-auto w-full max-w-3xl p-4 sm:p-8"><section className="rounded-xl border border-destructive/20 bg-destructive/10 p-6"><h1 className="font-semibold text-destructive">Akses ditolak</h1><p className="mt-1 text-sm text-destructive/80">Detail keuangan Korda hanya dapat diakses oleh admin.</p></section></main>;
  }

  const { kordaId } = await params;
  const [detail, treasury] = await Promise.all([getKordaFinanceDetail(kordaId), getTreasuryPosition(scope)]);
  if (!detail) notFound();
  const { summary } = detail;
  const currentPosition = treasury.positions.find((row) => row.id === kordaId);
  const availableToDisburse = Math.max(0, Math.min(treasury.centralBalance ?? 0, currentPosition?.heldAtCenter ?? 0));

  return <main className="mx-auto w-full min-w-0 max-w-7xl space-y-6 p-3 sm:p-6 lg:p-8">
    <header className="space-y-3">
      <Link href="/keuangan" className="text-sm font-medium text-primary hover:underline">← Kembali ke keuangan pusat</Link>
      <div><h1 className="text-2xl font-bold tracking-tight">Detail keuangan · {detail.korda.name}</h1><p className="mt-1 text-sm text-muted-foreground">Rincian uang pendaftaran, fee pusat, kelebihan pembayaran, dan pencairan yang tercatat untuk Korda ini.</p></div>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Total tagihan perjalanan</p><strong className="mt-1 block text-xl">{money(summary.grossBilled)}</strong><p className="mt-1 text-xs text-muted-foreground">{summary.billableJourneyCount} perjalanan bertarif</p></article>
      <article className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Fee pusat</p><strong className="mt-1 block text-xl">{money(summary.feeAmount)}</strong><p className="mt-1 text-xs text-muted-foreground">Rp10.000 untuk tiap tagihan perjalanan</p></article>
      <article className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Hak bersih pendaftaran</p><strong className="mt-1 block text-xl">{money(summary.netRegistrationEntitlement)}</strong><p className="mt-1 text-xs text-muted-foreground">Total tagihan dikurangi fee pusat</p></article>
      <article className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Penerimaan pendaftaran aktual</p><strong className="mt-1 block text-xl">{money(summary.registrationReceipts)}</strong><p className="mt-1 text-xs text-muted-foreground">Pembayaran tagihan setelah refund dan koreksi</p></article>
      <article className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Saldo Lain / kelebihan</p><strong className="mt-1 block text-xl">{money(summary.balanceNet)}</strong><p className="mt-1 text-xs text-muted-foreground">Terpisah dari pendaftaran dan tidak dikenai fee</p></article>
      <article className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Sudah dicairkan</p><strong className="mt-1 block text-xl">{money(summary.disbursed)}</strong><p className="mt-1 text-xs text-muted-foreground">Jumlah pencairan aktual yang tercatat</p></article>
      <article className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Maksimal dapat dicairkan saat ini</p><strong className="mt-1 block text-xl">{money(availableToDisburse)}</strong><p className="mt-1 text-xs text-muted-foreground">Dibatasi penerimaan aktual, hak bersih, dan kas pusat</p></article>
    </section>

    <aside className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
      Fee dihitung dari semua tagihan perjalanan, termasuk yang belum dibayar atau baru dibayar sebagian. Penerimaan aktual ditampilkan terpisah karena tagihan bukan uang tunai yang sudah diterima pusat.
      {summary.cancelledJourneyCount > 0 && <p className="mt-2">{summary.cancelledJourneyCount} perjalanan berstatus CANCELLED tidak dihitung dalam fee.</p>}
    </aside>

    <section className="space-y-3">
      <div><h2 className="text-lg font-semibold">Riwayat pembayaran per anak</h2><p className="text-sm text-muted-foreground">Setiap anak ditampilkan satu kali. Tagihan dan penerimaan diringkas, sedangkan tiap transaksi dan bukti transfernya tetap tercatat. Pembayaran keluarga ditampilkan sebesar alokasi untuk anak ini.</p></div>
      {detail.participantPayments.length ? <div className="grid gap-3">{detail.participantPayments.map((child) => <article key={child.id} className="min-w-0 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{child.participant}</h3>{child.nis && <p className="text-xs text-muted-foreground">NIS {child.nis}</p>}<p className="mt-1 text-sm text-muted-foreground">Asal {child.origins.length ? child.origins.join(", ") : "tidak tersedia"} · {child.events.join(", ")}</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{child.billableJourneyCount} tagihan perjalanan</span></div>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-sm sm:grid-cols-3"><div><dt className="text-muted-foreground">Total tagihan</dt><dd className="font-medium">{money(child.billed)}</dd></div><div><dt className="text-muted-foreground">Penerimaan bersih</dt><dd className="font-medium">{money(child.received)}</dd></div><div><dt className="text-muted-foreground">Sisa tagihan</dt><dd className="font-medium">{money(child.outstanding)}</dd></div></dl>
        {child.payments.length > 0 ? <div className="mt-4 space-y-2 border-t pt-3"><h4 className="text-sm font-medium">Transaksi dan bukti transfer</h4>{child.payments.map((payment) => <div key={payment.id} className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{dateLabel(payment.paidAt)} · alokasi {money(payment.netAmount)}</p><p className="mt-0.5 text-xs text-muted-foreground">{payment.events.join(", ")} · {[...payment.directions].join(" + ")}{payment.netAmount !== payment.amount ? ` · awal ${money(payment.amount)}` : ""}</p></div>{payment.evidence ? <a href={`/api/payment-evidence/${payment.evidence.id}`} target="_blank" rel="noreferrer" className="break-all text-primary underline">Buka bukti transfer: {payment.evidence.name}</a> : <span className="text-muted-foreground">Bukti tidak tersedia</span>}</div>)}</div> : <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">Belum ada pembayaran tercatat untuk anak ini.</p>}
      </article>)}</div> : <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Belum ada tagihan perjalanan untuk Korda ini.</p>}
    </section>

    <section className="space-y-3">
      <div><h2 className="text-lg font-semibold">Riwayat Saldo Lain / kelebihan</h2><p className="text-sm text-muted-foreground">Kelebihan pembayaran menjadi Saldo Lain Korda tujuan. Entri refund atau koreksi mengurangi saldo dan tetap ditampilkan sebagai riwayat.</p></div>
      {detail.balanceEntries.length ? <div className="grid gap-3">{detail.balanceEntries.map((entry) => <article key={entry.id} className="min-w-0 rounded-xl border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words font-semibold">{entry.participant}</h3><p className="text-sm text-muted-foreground">{dateLabel(entry.createdAt)} · {entry.originKorda ? `Asal ${entry.originKorda}` : "Asal tidak tersedia"}</p><p className="mt-1 text-xs text-muted-foreground">{entry.type === "CREDIT" ? "Kelebihan pembayaran masuk" : entry.type === "REFUND" ? "Refund Saldo Lain" : "Koreksi Saldo Lain"}{entry.reason ? ` · ${entry.reason}` : ""}</p></div><strong className={entry.amount >= 0 ? "text-emerald-700" : "text-destructive"}>{entry.amount >= 0 ? "+" : "−"}{money(Math.abs(entry.amount))}</strong></div>
        {(entry.evidence || entry.refundEvidence) && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-sm">{entry.evidence && <a href={`/api/payment-evidence/${entry.evidence.id}`} target="_blank" rel="noreferrer" className="break-all text-primary underline">Bukti pembayaran: {entry.evidence.name}</a>}{entry.refundEvidence && <a href={`/api/payment-evidence/${entry.refundEvidence.id}`} target="_blank" rel="noreferrer" className="break-all text-primary underline">Bukti refund: {entry.refundEvidence.name}</a>}</div>}
      </article>)}</div> : <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Belum ada Saldo Lain untuk Korda ini.</p>}
    </section>

    <section className="space-y-3"><div><h2 className="text-lg font-semibold">Riwayat pencairan</h2><p className="text-sm text-muted-foreground">Nominal yang sudah benar-benar diserahkan dari pusat ke Korda.</p></div>
      {detail.disbursements.length ? <div className="grid gap-3 md:grid-cols-2">{detail.disbursements.map((row) => <article key={row.id} className="rounded-xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{dateLabel(row.disbursedAt)}</h3><p className="mt-1 text-sm text-muted-foreground">{row.note ?? "Tanpa catatan"}</p></div><strong>{money(row.amount)}</strong></div></article>)}</div> : <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Belum ada pencairan tercatat.</p>}
    </section>
  </main>;
}

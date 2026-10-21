"use client";

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { retryPurgeEvidenceCleanupAction } from "../actions/registration-purge.actions";

type Details = { participants?: Array<{ name: string; nis: string | null; originKorda: string | null; journeys: Array<{ direction: string; destination: string; dropPoint: string | null; tariff: number | null; status: string; bus: string | null; assignmentHistory: Array<{ action: string; fromBus: string | null; toBus: string | null; actorUserId: string | null; createdAt: string }> }>; legacyPaymentReconciliations: Array<{ direction: string; legacyMarkedPaid: boolean; status: string; note: string | null; createdAt: string; reconciledAt: string | null }> }>; payments?: Array<{ amount: number; paidAt: string; note: string; allocations: Array<{ participant: string; type: string; amount: number; destinationKorda: string }> }> };
type Finance = { centralCashBefore: number; centralCashAfter: number; affectedKordas: Array<{ id: string; name: string; registrationEntitlementBefore: number; registrationEntitlementAfter: number; registrationReceivedBefore: number; registrationReceivedAfter: number; balanceBefore: number; balanceAfter: number; disbursed: number; remainingSupportBefore: number; remainingSupportAfter: number }> };
type EvidenceCleanup = { id: string; storageKey: string; originalName: string; status: "PENDING" | "DELETED" | "FAILED"; errorMessage: string | null; attemptedAt: Date | null; deletedAt: Date | null };
export type PurgeHistoryRow = { id: string; eventNameSnapshot: string; actorNameSnapshot: string; actorUsernameSnapshot: string | null; reason: string; participantCount: number; registrationCount: number; journeyCount: number; paymentCount: number; paymentAmount: number; details: unknown; financialSnapshot: unknown; createdAt: Date; evidenceCleanup: EvidenceCleanup[] };

const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
const dateTime = (value: Date | string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

function EvidenceCleanupAction({ item }: { item: EvidenceCleanup }) {
  const [pending, setPending] = useState(false);
  async function retry() {
    setPending(true);
    const result = await retryPurgeEvidenceCleanupAction(item.id);
    if (result.success) toast.success(`Bukti ${item.originalName} berhasil dihapus.`);
    else toast.error(result.error);
    setPending(false);
  }
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"><span className="min-w-0 break-words">{item.originalName}</span><div className="flex items-center gap-2"><Badge variant={item.status === "DELETED" ? "secondary" : "destructive"}>{item.status === "DELETED" ? "File terhapus" : item.status === "FAILED" ? "Gagal" : "Menunggu"}</Badge>{item.status !== "DELETED" && <Button type="button" size="sm" variant="outline" onClick={retry} disabled={pending}>{pending ? <Loader2 className="mr-1 size-3.5 animate-spin"/> : <RotateCcw className="mr-1 size-3.5"/>}Coba lagi</Button>}</div>{item.errorMessage && <p className="w-full text-xs text-destructive">{item.errorMessage}</p>}</div>;
}

export function PurgeHistory({ rows }: { rows: PurgeHistoryRow[] }) {
  return <div className="space-y-3">{rows.map((row) => {
    const details = row.details as Details;
    const finance = row.financialSnapshot as Finance;
    return <article key={row.id} className="min-w-0 rounded-xl border bg-card p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold">{row.participantCount} peserta · {row.eventNameSnapshot}</h2><p className="text-sm text-muted-foreground">{dateTime(row.createdAt)} · {row.actorNameSnapshot}{row.actorUsernameSnapshot ? ` (@${row.actorUsernameSnapshot})` : ""}</p></div><Badge variant="destructive">Purge permanen</Badge></header>
      <p className="mt-3 break-words text-sm"><strong>Alasan:</strong> {row.reason}</p>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-md bg-muted/50 p-2">Registrasi / perjalanan<strong className="block">{row.registrationCount} / {row.journeyCount}</strong></div><div className="rounded-md bg-muted/50 p-2">Transaksi dihapus<strong className="block">{row.paymentCount} · {money(row.paymentAmount)}</strong></div><div className="rounded-md bg-muted/50 p-2">Kas pusat<strong className="block">{money(finance.centralCashBefore)} → {money(finance.centralCashAfter)}</strong></div><div className="rounded-md bg-muted/50 p-2">ID riwayat<strong className="block font-mono">{row.id}</strong></div></div>
      <details className="mt-4 rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Detail peserta, perjalanan, pembayaran, dan proyeksi</summary><div className="mt-3 space-y-4 text-sm"><section><h3 className="mb-2 font-semibold">Peserta</h3><ul className="space-y-2">{details.participants?.map((participant, index) => <li key={`${participant.name}-${index}`} className="rounded-md bg-muted/40 p-2"><p className="font-medium">{participant.name}{participant.nis ? ` · NIS ${participant.nis}` : ""}</p><p className="text-xs text-muted-foreground">Asal {participant.originKorda ?? "tidak tercatat"} · {participant.journeys.map((journey) => `${journey.direction === "OUTBOUND" ? "Pulang" : "Kembali"}: ${journey.destination} · ${journey.dropPoint ?? "tanpa titik turun"} · ${journey.tariff === null ? "tarif tidak diketahui" : money(journey.tariff)} · Bus ${journey.bus ?? "belum dialokasikan"}`).join("; ")}</p>{participant.journeys.some((journey) => journey.assignmentHistory.length) && <p className="mt-1 text-xs text-muted-foreground">Riwayat armada: {participant.journeys.flatMap((journey) => journey.assignmentHistory).map((item) => `${item.action} ${item.fromBus ?? "—"} → ${item.toBus ?? "—"} · ${dateTime(item.createdAt)}`).join("; ")}</p>}{participant.legacyPaymentReconciliations.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Rekonsiliasi legacy: {participant.legacyPaymentReconciliations.map((item) => `${item.direction} · ${item.status} · ${item.note ?? "tanpa catatan"}`).join("; ")}</p>}</li>)}</ul></section><section><h3 className="mb-2 font-semibold">Transaksi yang dihapus</h3>{details.payments?.length ? <ul className="space-y-2">{details.payments.map((payment, index) => <li key={`${payment.paidAt}-${index}`} className="rounded-md bg-muted/40 p-2"><p className="font-medium">{money(payment.amount)} · {dateTime(payment.paidAt)}</p><p className="text-xs text-muted-foreground">{payment.allocations.map((allocation) => `${allocation.participant} · ${allocation.type === "BALANCE" ? "Saldo Lain" : "Tagihan"} ${money(allocation.amount)} · ${allocation.destinationKorda}`).join("; ")}</p></li>)}</ul> : <p className="text-muted-foreground">Tidak ada pembayaran tertaut.</p>}</section><section><h3 className="mb-2 font-semibold">Proyeksi per Korda</h3><ul className="space-y-2">{finance.affectedKordas.map((korda) => <li key={korda.id} className="rounded-md bg-muted/40 p-2"><p className="font-medium">{korda.name} · hak bersih {money(korda.registrationEntitlementBefore)} → {money(korda.registrationEntitlementAfter)}</p><p className="text-xs text-muted-foreground">Penerimaan {money(korda.registrationReceivedBefore)} → {money(korda.registrationReceivedAfter)} · Saldo Lain {money(korda.balanceBefore)} → {money(korda.balanceAfter)} · dicairkan {money(korda.disbursed)} · sisa didukung {money(korda.remainingSupportBefore)} → {money(korda.remainingSupportAfter)}</p></li>)}</ul></section></div></details>
      {!!row.evidenceCleanup.length && <section className="mt-4 space-y-2"><h3 className="text-sm font-semibold">Pembersihan bukti Supabase</h3>{row.evidenceCleanup.map((item) => <EvidenceCleanupAction key={item.id} item={item}/>)}</section>}
    </article>;
  })}</div>;
}

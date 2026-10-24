import Link from "next/link";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getRegionalAccessScope } from "@/server/access-scope";
import { FinancialCorrectionForm } from "@/features/payment/components/FinancialCorrectionForm";
import { eventBalanceEntryWhere, getEventContext } from "@/server/event-context";

const money = (amount: number) => `Rp${amount.toLocaleString("id-ID")}`;

export default async function FinancialCorrectionPage() {
  const scope = await getRegionalAccessScope();
  const eventContext = await getEventContext(scope);
  const eventId = eventContext.selectedEvent?.id ?? "__NO_EVENT_SELECTED__";
  const journeyScope: Prisma.JourneyWhereInput = scope.role === "admin" ? {} : scope.role === "korwil" ? { destinationKorda: { korwilId: scope.korwilId ?? "__NO_ACCESS__" } } : { destinationKordaId: scope.kordaId ?? "__NO_ACCESS__" };
  const ownerScope: Prisma.KordaWhereInput = scope.role === "admin" ? {} : scope.role === "korwil" ? { korwilId: scope.korwilId ?? "__NO_ACCESS__" } : { id: scope.kordaId ?? "__NO_ACCESS__" };
  const [allocations, balances, corrections] = await Promise.all([
    prisma.paymentAllocation.findMany({ where: { type: "JOURNEY", journey: { ...journeyScope, registration: { eventId } } }, include: { journey: { include: { registration: { include: { student: { select: { name: true } }, externalParticipant: { select: { name: true } }, event: { select: { name: true } } } }, destinationKorda: { select: { name: true } } } }, refunds: { select: { amount: true } }, corrections: { select: { amount: true } } }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.kordaBalanceEntry.findMany({ where: { AND: [eventBalanceEntryWhere(eventId), { entryType: "CREDIT", ownerKorda: ownerScope }] }, include: { ownerKorda: { select: { name: true } }, refundsFromSource: { select: { amount: true } }, correctionsFromSource: { select: { amount: true } } }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.financialCorrection.findMany({
      where: { eventId, OR: [{ paymentAllocation: { journey: journeyScope } }, { balanceSourceEntry: { ownerKorda: ownerScope } }] },
      include: {
        paymentAllocation: { select: { participantNameSnapshot: true, journey: { select: { direction: true, destinationKorda: { select: { name: true } }, registration: { select: { event: { select: { name: true } } } } } } } },
        balanceSourceEntry: { select: { participantNameSnapshot: true, destinationKordaNameSnapshot: true } },
        auditEntries: { select: { actorUserId: true, actorRoleSnapshot: true } },
      },
      orderBy: { correctedAt: "desc" }, take: 100,
    }),
  ]);
  const options = [
    ...allocations.map((row) => ({ id: row.id, sourceType: "journey" as const, label: `${row.participantNameSnapshot} · ${row.journey?.registration.event.name ?? "Event"} · ${row.journey?.direction === "OUTBOUND" ? "Pulang" : "Kembali"} · ${row.journey?.destinationKorda.name ?? ""}`, remaining: row.amount - row.refunds.reduce((sum, refund) => sum + refund.amount, 0) - row.corrections.reduce((sum, correction) => sum + correction.amount, 0) })).filter((row) => row.remaining > 0),
    ...balances.map((row) => ({ id: row.id, sourceType: "balance" as const, label: `${row.participantNameSnapshot} · Saldo Lain · ${row.ownerKorda.name}`, remaining: row.amount - row.refundsFromSource.reduce((sum, refund) => sum + refund.amount, 0) - row.correctionsFromSource.reduce((sum, correction) => sum + correction.amount, 0) })).filter((row) => row.remaining > 0),
  ];
  const rows = corrections.map((row) => ({ id: row.id, participant: row.paymentAllocation?.participantNameSnapshot ?? row.balanceSourceEntry?.participantNameSnapshot ?? "Saldo Lain", journey: row.paymentAllocation?.journey ? `${row.paymentAllocation.journey.registration.event.name} · ${row.paymentAllocation.journey.direction === "OUTBOUND" ? "Pulang" : "Kembali"}` : "Saldo Lain", destination: row.paymentAllocation?.journey?.destinationKorda.name ?? row.balanceSourceEntry?.destinationKordaNameSnapshot ?? "—", reason: row.reason, date: row.correctedAt, amount: row.amount, actor: row.auditEntries[0] ? `${row.auditEntries[0].actorRoleSnapshot} · ${row.auditEntries[0].actorUserId}` : "Pelaksana tidak tercatat" }));
  return <main className="mx-auto w-full min-w-0 max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Koreksi transaksi</h1><p className="mt-1 text-sm text-muted-foreground">Balik catatan keuangan yang salah tanpa menghapus transaksi sumber. Jika uang benar-benar dikembalikan, gunakan Refund.</p></div><Link href="/pembayaran" className="inline-flex w-full justify-center rounded-md border px-4 py-2.5 text-sm font-medium hover:bg-muted sm:w-auto">← Kembali ke pembayaran</Link></header>
    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6"><div><h2 className="text-lg font-semibold">Koreksi pencatatan</h2><p className="text-sm text-muted-foreground">Gunakan saat nominal atau alokasi pembayaran salah dicatat, tetapi uang tidak dikembalikan. Transaksi sumber tetap tersimpan untuk jejak audit.</p><p className="mt-2 text-sm text-muted-foreground">Jika uang benar-benar dikembalikan kepada peserta, gunakan menu Refund.</p></div>{eventContext.selectedEvent?.status === "ACTIVE" ? <FinancialCorrectionForm options={options}/> : <p className="text-sm text-muted-foreground">Koreksi hanya dapat dicatat pada event aktif.</p>}</section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Riwayat koreksi</h2>{rows.length ? <div className="space-y-3">{rows.map((row) => <article key={row.id} className="flex min-w-0 flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><strong className="break-words">{row.participant}</strong><p className="break-words text-sm text-muted-foreground">{row.journey} · {row.destination}</p><p className="break-words text-sm">{row.reason}</p><p className="break-words text-xs text-muted-foreground">Oleh {row.actor}</p></div><div className="shrink-0 sm:text-right"><strong>{money(row.amount)}</strong><span className="block text-xs text-muted-foreground">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(row.date)}</span></div></article>)}</div> : <p className="rounded-lg border p-4 text-sm text-muted-foreground">Belum ada koreksi pada cakupan Anda.</p>}</section>
  </main>;
}

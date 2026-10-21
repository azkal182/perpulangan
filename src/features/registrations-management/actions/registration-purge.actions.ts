"use server";

import { createHash, randomUUID } from "node:crypto";
import { verifyPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { getRegionalAccessScope, requireAdmin } from "@/server/access-scope";
import { assertEventWritable } from "@/server/event-write-guard";
import { deleteEvidenceObject } from "@/features/payment/services/supabase-storage";
import { CENTRAL_FEE_PER_JOURNEY } from "@/features/payment/services/korda-finance-detail";

type Db = Prisma.TransactionClient;

type PurgePlan = {
  eventId: string;
  eventName: string;
  registrationIds: string[];
  journeyIds: string[];
  paymentIds: string[];
  allocationIds: string[];
  rootParticipantName: string;
  participants: Array<{ registrationId: string; name: string; nis: string | null; originKorda: string | null; journeys: Array<{ direction: string; destination: string; dropPoint: string | null; tariff: number | null; status: string }> }>;
  payments: Array<{ id: string; amount: number; paidAt: Date; note: string; allocationCount: number; evidenceName: string | null; allocations: Array<{ participant: string; type: string; amount: number; destination: string }> }>;
  paymentAmount: number;
  evidence: Array<{ storageKey: string; originalName: string }>;
  financial: { safe: boolean; reason: string | null; centralCashBefore: number; centralCashAfter: number; affectedKordas: Array<{ id: string; name: string; disbursed: number; registrationEntitlementBefore: number; registrationEntitlementAfter: number; registrationReceivedBefore: number; registrationReceivedAfter: number; balanceBefore: number; balanceAfter: number; remainingSupportBefore: number; remainingSupportAfter: number }> };
  refundsOrCorrections: number;
  fingerprint: string;
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function buildPurgePlan(db: Db, registrationId: string): Promise<PurgePlan> {
  const root = await db.registration.findUnique({
    where: { id: registrationId },
    select: { id: true, eventId: true, event: { select: { id: true, name: true, status: true } } },
  });
  if (!root) throw new Error("Registrasi tidak ditemukan.");
  if (root.event.status !== "ACTIVE") throw new Error("Event tidak aktif. Data event lama hanya dapat dibaca atau diekspor.");
  await assertEventWritable(db, root.eventId);

  const registrationIds = new Set([registrationId]);
  const paymentIds = new Set<string>();
  let allocations: Array<{ id: string; paymentId: string; registrationId: string | null; journeyId: string | null; type: string; amount: number; participantNameSnapshot: string; destinationKordaNameSnapshot: string }> = [];
  let changed = true;
  while (changed) {
    changed = false;
    const currentRegistrationIds = [...registrationIds];
    const journeys = await db.journey.findMany({
      where: { registrationId: { in: currentRegistrationIds } },
      select: { id: true, registrationId: true, destinationKordaNameSnapshot: true },
    });
    const journeyIds = journeys.map((row) => row.id);
    const linked = await db.paymentAllocation.findMany({
      where: { OR: [{ registrationId: { in: currentRegistrationIds } }, ...(journeyIds.length ? [{ journeyId: { in: journeyIds } }] : [])] },
      select: { id: true, paymentId: true },
    });
    for (const row of linked) paymentIds.add(row.paymentId);

    // Legacy Saldo Lain allocations were not linked to a registration. Include exact name+destination matches;
    // if a matching legacy allocation cannot be attributed uniquely, the purge is blocked below.
    const people = await db.registration.findMany({
      where: { id: { in: currentRegistrationIds } },
      select: { student: { select: { name: true } }, externalParticipant: { select: { name: true } }, journeys: { select: { destinationKordaNameSnapshot: true } } },
    });
    const legacyCandidates = people.flatMap((person) => {
      const name = person.student?.name ?? person.externalParticipant?.name;
      return name ? person.journeys.map((journey) => ({ name, destination: journey.destinationKordaNameSnapshot })) : [];
    });
    if (legacyCandidates.length) {
      const unlinkedBalances = await db.paymentAllocation.findMany({
        where: { registrationId: null, journeyId: null, type: "BALANCE", payment: { eventId: root.eventId }, participantNameSnapshot: { in: [...new Set(legacyCandidates.map((row) => row.name))] } },
        select: { id: true, paymentId: true, participantNameSnapshot: true, destinationKordaNameSnapshot: true },
      });
      for (const candidate of legacyCandidates) {
        for (const row of unlinkedBalances) {
          if (row.participantNameSnapshot === candidate.name) paymentIds.add(row.paymentId);
        }
      }
    }

    if (!paymentIds.size) continue;
    const paymentAllocations = await db.paymentAllocation.findMany({
      where: { paymentId: { in: [...paymentIds] } },
      select: { id: true, paymentId: true, registrationId: true, journeyId: true, type: true, amount: true, participantNameSnapshot: true, destinationKordaNameSnapshot: true, journey: { select: { registrationId: true } } },
    });
    for (const allocation of paymentAllocations) {
      const linkedRegistrationId = allocation.registrationId ?? allocation.journey?.registrationId;
      if (linkedRegistrationId && !registrationIds.has(linkedRegistrationId)) {
        registrationIds.add(linkedRegistrationId);
        changed = true;
      }
    }
    allocations = paymentAllocations;
  }

  const registrations = await db.registration.findMany({
    where: { id: { in: [...registrationIds] } },
    include: {
      event: { select: { id: true, name: true, status: true } },
      student: { select: { id: true, name: true, nis: true } },
      externalParticipant: { select: { id: true, name: true } },
      journeys: {
        include: {
          destinationKorda: { select: { name: true } },
          dropPoint: { select: { name: true } },
          busAssignment: {
            include: {
              bus: { select: { label: true } },
              history: { orderBy: { createdAt: "desc" }, select: { action: true, fromBusLabelSnapshot: true, toBusLabelSnapshot: true, createdAt: true, actorUserId: true } },
            },
          },
        },
      },
      legacyPaymentReconciliations: { select: { direction: true, legacyMarkedPaid: true, status: true, note: true, createdAt: true, reconciledAt: true } },
    },
  });
  const journeyIds = registrations.flatMap((registration) => registration.journeys.map((journey) => journey.id));
  const paymentRows = await db.payment.findMany({
    where: { id: { in: [...paymentIds] } },
    include: { evidence: { select: { storageKey: true, originalName: true } }, allocations: { select: { id: true, participantNameSnapshot: true, type: true, amount: true, destinationKordaNameSnapshot: true } } },
  });
  allocations = await db.paymentAllocation.findMany({
    where: { paymentId: { in: [...paymentIds] } },
    select: { id: true, paymentId: true, registrationId: true, journeyId: true, type: true, amount: true, participantNameSnapshot: true, destinationKordaNameSnapshot: true },
  });
  const allocationIds = allocations.map((row) => row.id);
  const balanceEntries = allocationIds.length ? await db.kordaBalanceEntry.findMany({ where: { sourcePaymentAllocationId: { in: allocationIds } }, select: { id: true } }) : [];
  const [refunds, corrections, unresolved, position] = await Promise.all([
    db.refund.count({ where: { OR: [{ paymentAllocationId: { in: allocationIds } }, { balanceSourceEntryId: { in: balanceEntries.map((row) => row.id) } }] } }),
    db.financialCorrection.count({ where: { OR: [{ paymentAllocationId: { in: allocationIds } }, { balanceSourceEntryId: { in: balanceEntries.map((row) => row.id) } }] } }),
    db.paymentAllocation.count({ where: { paymentId: { in: [...paymentIds] }, registrationId: null, journeyId: null } }),
    calculateFinancialProjection(db, registrations.map((row) => row.id), journeyIds, paymentIds, allocationIds, paymentRows.reduce((sum, row) => sum + row.amount, 0)),
  ]);
  const refundsOrCorrections = refunds + corrections;
  const blockers = [
    refundsOrCorrections > 0 ? `Terdapat ${refunds} refund dan ${corrections} koreksi pada transaksi terkait.` : null,
    unresolved > 0 ? `Ada ${unresolved} alokasi Saldo Lain lama yang tidak dapat dipastikan pemilik pesertanya.` : null,
    !position.safe ? position.reason : null,
  ].filter(Boolean);
  const participants = registrations.map((registration) => ({
    registrationId: registration.id,
    name: registration.student?.name ?? registration.externalParticipant?.name ?? "Peserta tidak diketahui",
    nis: registration.student?.nis ?? null,
    originKorda: registration.originKordaNameSnapshot,
    journeys: registration.journeys.map((journey) => ({ direction: journey.direction, destination: journey.destinationKordaNameSnapshot, dropPoint: journey.locationNameSnapshot || journey.dropPoint?.name || null, tariff: journey.tariffSnapshot, status: journey.status, bus: journey.busAssignment?.bus?.label ?? null, assignmentHistory: journey.busAssignment?.history.map((item) => ({ action: item.action, fromBus: item.fromBusLabelSnapshot, toBus: item.toBusLabelSnapshot, actorUserId: item.actorUserId, createdAt: item.createdAt })) ?? [] })),
    legacyPaymentReconciliations: registration.legacyPaymentReconciliations.map((item) => ({ direction: item.direction, legacyMarkedPaid: item.legacyMarkedPaid, status: item.status, note: item.note, createdAt: item.createdAt, reconciledAt: item.reconciledAt })),
  }));
  const payments = paymentRows.map((payment) => ({ id: payment.id, amount: payment.amount, paidAt: payment.paidAt, note: payment.noteSnapshot, allocationCount: payment.allocations.length, evidenceName: payment.evidence?.originalName ?? null, allocations: payment.allocations.map((allocation) => ({ participant: allocation.participantNameSnapshot, type: allocation.type, amount: allocation.amount, destination: allocation.destinationKordaNameSnapshot })) }));
  const evidence = paymentRows.flatMap((payment) => payment.evidence ? [{ storageKey: payment.evidence.storageKey, originalName: payment.evidence.originalName }] : []);
  const core = {
    rootRegistrationId: registrationId,
    eventId: root.eventId,
    registrationIds: [...registrationIds].sort(),
    journeyIds: [...journeyIds].sort(),
    paymentIds: [...paymentIds].sort(),
    allocationIds: [...allocationIds].sort(),
    participants,
    payments,
    allocations: allocations.map((row) => ({ id: row.id, paymentId: row.paymentId, registrationId: row.registrationId, journeyId: row.journeyId, type: row.type, amount: row.amount, participantNameSnapshot: row.participantNameSnapshot, destinationKordaNameSnapshot: row.destinationKordaNameSnapshot })).sort((a, b) => a.id.localeCompare(b.id)),
    evidence,
    financial: position,
    total: paymentRows.reduce((sum, row) => sum + row.amount, 0),
  };

  return {
    eventId: root.eventId,
    eventName: root.event.name,
    registrationIds: [...registrationIds],
    journeyIds,
    paymentIds: [...paymentIds],
    allocationIds,
    rootParticipantName: participants.find((row) => row.registrationId === registrationId)?.name ?? "Peserta",
    participants,
    payments,
    paymentAmount: paymentRows.reduce((sum, row) => sum + row.amount, 0),
    evidence,
    financial: { ...position, safe: !blockers.some(Boolean), reason: blockers.join(" ") || null },
    refundsOrCorrections,
    fingerprint: digest(core),
  };
}

async function calculateFinancialProjection(db: Db, registrationIds: string[], journeyIds: string[], paymentIds: Set<string>, allocationIds: string[], removedPaymentAmount: number) {
  const [kordas, journeys, ledger, disbursements, payments, refunds, allDisbursements] = await Promise.all([
    db.korda.findMany({ select: { id: true, name: true } }),
    db.journey.findMany({ select: { id: true, registrationId: true, destinationKordaId: true, status: true, tariffSnapshot: true, paymentAllocations: { select: { paymentId: true, type: true, amount: true, refunds: { select: { amount: true } }, corrections: { select: { amount: true } } } } } }),
    db.kordaBalanceEntry.findMany({ select: { ownerKordaId: true, entryType: true, amount: true, sourcePaymentAllocationId: true } }),
    db.treasuryDisbursement.groupBy({ by: ["kordaId"], _sum: { amount: true } }),
    db.payment.aggregate({ _sum: { amount: true } }),
    db.refund.aggregate({ _sum: { amount: true } }),
    db.treasuryDisbursement.aggregate({ _sum: { amount: true } }),
  ]);
  const removedJourneys = new Set(journeyIds);
  const removedAllocations = new Set(allocationIds);
  const disbursedByKorda = new Map(disbursements.map((row) => [row.kordaId, row._sum.amount ?? 0]));
  const rows = kordas.map((korda) => {
    const allKordaJourneys = journeys.filter((journey) => journey.destinationKordaId === korda.id);
    const remainingJourneys = allKordaJourneys.filter((journey) => !removedJourneys.has(journey.id));
    const entitlement = (items: typeof journeys) => {
      const billable = items.filter((journey) => journey.status === "REGISTERED" && (journey.tariffSnapshot ?? 0) > 0);
      const gross = billable.reduce((sum, journey) => sum + (journey.tariffSnapshot ?? 0), 0);
      return Math.max(0, gross - billable.length * CENTRAL_FEE_PER_JOURNEY);
    };
    const received = (items: typeof journeys, excludePurgedPayments = false) => items.reduce((sum, journey) => sum + journey.paymentAllocations
      .filter((allocation) => allocation.type === "JOURNEY" && (!excludePurgedPayments || !paymentIds.has(allocation.paymentId)))
      .reduce((total, allocation) => total + allocation.amount - allocation.refunds.reduce((r, row) => r + row.amount, 0) - allocation.corrections.reduce((c, row) => c + row.amount, 0), 0), 0);
    const balance = ledger.filter((entry) => entry.ownerKordaId === korda.id && (!entry.sourcePaymentAllocationId || !removedAllocations.has(entry.sourcePaymentAllocationId)))
      .reduce((sum, entry) => sum + (entry.entryType === "CREDIT" ? Math.abs(entry.amount) : -Math.abs(entry.amount)), 0);
    const disbursed = disbursedByKorda.get(korda.id) ?? 0;
    const entitlementBefore = entitlement(allKordaJourneys);
    const entitlementAfter = entitlement(remainingJourneys);
    const receivedBefore = received(allKordaJourneys);
    const receivedAfter = received(remainingJourneys, true);
    const balanceAfter = balance;
    const balanceBefore = ledger.filter((entry) => entry.ownerKordaId === korda.id).reduce((sum, entry) => sum + (entry.entryType === "CREDIT" ? Math.abs(entry.amount) : -Math.abs(entry.amount)), 0);
    const supportBefore = Math.min(receivedBefore + balanceBefore - disbursed, entitlementBefore + balanceBefore - disbursed);
    const supportAfter = Math.min(receivedAfter + balanceAfter - disbursed, entitlementAfter + balanceAfter - disbursed);
    return { id: korda.id, name: korda.name, disbursed, registrationEntitlementBefore: entitlementBefore, registrationEntitlementAfter: entitlementAfter, registrationReceivedBefore: receivedBefore, registrationReceivedAfter: receivedAfter, balanceBefore, balanceAfter, remainingSupportBefore: supportBefore, remainingSupportAfter: supportAfter };
  });
  const centralCashBefore = (payments._sum.amount ?? 0) - (refunds._sum.amount ?? 0) - (allDisbursements._sum.amount ?? 0);
  const centralCashAfter = centralCashBefore - removedPaymentAmount;
  const affectedKordaIds = new Set([
    ...journeys.filter((journey) => registrationIds.includes(journey.registrationId)).map((journey) => journey.destinationKordaId),
    ...ledger.filter((entry) => !!entry.sourcePaymentAllocationId && removedAllocations.has(entry.sourcePaymentAllocationId)).map((entry) => entry.ownerKordaId),
  ]);
  const affectedKordas = rows.filter((row) => affectedKordaIds.has(row.id));
  const insufficient = affectedKordas.find((row) => row.remainingSupportAfter < 0);
  const totalHeldAfter = rows.reduce((sum, row) => sum + Math.max(0, row.remainingSupportAfter), 0);
  const reason = insufficient
    ? `Dana Korda ${insufficient.name} tidak cukup setelah purge; posisi bersih setelah pencairan menjadi Rp${insufficient.remainingSupportAfter.toLocaleString("id-ID")}.`
    : centralCashAfter < totalHeldAfter
      ? `Kas pusat setelah purge Rp${centralCashAfter.toLocaleString("id-ID")} tidak cukup untuk menutup posisi Korda Rp${totalHeldAfter.toLocaleString("id-ID")}.`
      : null;
  return { safe: !reason, reason, centralCashBefore, centralCashAfter, affectedKordas };
}

export async function previewRegistrationPurgeAction(registrationId: string) {
  try {
    const scope = await getRegionalAccessScope();
    requireAdmin(scope);
    const plan = await prisma.$transaction((tx) => buildPurgePlan(tx, registrationId), { isolationLevel: "Serializable" });
    return { success: true as const, plan: { eventId: plan.eventId, eventName: plan.eventName, rootParticipantName: plan.rootParticipantName, participants: plan.participants, payments: plan.payments, paymentAmount: plan.paymentAmount, evidence: plan.evidence.map((row) => row.originalName), financial: plan.financial, refundsOrCorrections: plan.refundsOrCorrections, fingerprint: plan.fingerprint } };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Gagal menyiapkan pratinjau penghapusan." };
  }
}

export async function purgeRegistrationGroupAction(input: { registrationId: string; reason: string; password: string; confirmation: string; fingerprint: string }) {
  try {
    const scope = await getRegionalAccessScope();
    requireAdmin(scope);
    const reason = input.reason.trim();
    if (reason.length < 8 || reason.length > 500) return { success: false as const, error: "Alasan wajib diisi (8–500 karakter)." };
    if (!input.password || input.password.length > 256) return { success: false as const, error: "Masukkan password akun admin." };
    const purgeId = randomUUID();
    const storageKeys: Array<{ storageKey: string; originalName: string }> = [];
    await prisma.$transaction(async (tx) => {
      const plan = await buildPurgePlan(tx, input.registrationId);
      if (plan.fingerprint !== input.fingerprint) throw new Error("Data atau cakupan penghapusan berubah setelah pratinjau. Tutup dialog lalu buka kembali untuk meninjau ulang.");
      if (input.confirmation !== `HAPUS PERMANEN ${plan.participants.length}`) throw new Error(`Konfirmasi harus diketik: HAPUS PERMANEN ${plan.participants.length}`);
      if (!plan.financial.safe) throw new Error(plan.financial.reason || "Posisi keuangan tidak cukup untuk menghapus data ini.");
      if (plan.refundsOrCorrections > 0) throw new Error("Transaksi memiliki refund/koreksi. Selesaikan rekonsiliasi terlebih dahulu; riwayat uang nyata tidak dapat dipurge.");
      const account = await tx.account.findFirst({ where: { userId: scope.userId, providerId: "credential" }, select: { password: true } });
      if (!account?.password || !(await verifyPassword({ hash: account.password, password: input.password }))) throw new Error("Password admin tidak cocok.");
      const registrations = await tx.registration.findMany({
        where: { id: { in: plan.registrationIds } },
        include: {
          student: { select: { name: true, nis: true } },
          externalParticipant: { select: { name: true } },
          journeys: {
            include: {
              destinationKorda: { select: { name: true } },
              dropPoint: { select: { name: true } },
              busAssignment: {
                include: {
                  bus: { select: { label: true } },
                  history: { orderBy: { createdAt: "desc" }, select: { action: true, fromBusLabelSnapshot: true, toBusLabelSnapshot: true, createdAt: true, actorUserId: true } },
                },
              },
            },
          },
          legacyPaymentReconciliations: { select: { direction: true, legacyMarkedPaid: true, status: true, note: true, createdAt: true, reconciledAt: true } },
        },
      });
      const payments = await tx.payment.findMany({ where: { id: { in: plan.paymentIds } }, include: { allocations: true, evidence: true } });
      storageKeys.push(...payments.flatMap((payment) => payment.evidence ? [{ storageKey: payment.evidence.storageKey, originalName: payment.evidence.originalName }] : []));
      const actor = await tx.user.findUnique({ where: { id: scope.userId }, select: { name: true, username: true } });
      const details = {
        participants: registrations.map((registration) => ({ name: registration.student?.name ?? registration.externalParticipant?.name ?? "Peserta", nis: registration.student?.nis ?? null, originKorda: registration.originKordaNameSnapshot, journeys: registration.journeys.map((journey) => ({ direction: journey.direction, destination: journey.destinationKordaNameSnapshot, dropPoint: journey.locationNameSnapshot || journey.dropPoint?.name || null, tariff: journey.tariffSnapshot, status: journey.status, bus: journey.busAssignment?.bus?.label ?? null, assignmentHistory: journey.busAssignment?.history.map((item) => ({ action: item.action, fromBus: item.fromBusLabelSnapshot, toBus: item.toBusLabelSnapshot, actorUserId: item.actorUserId, createdAt: item.createdAt.toISOString() })) ?? [] })), legacyPaymentReconciliations: registration.legacyPaymentReconciliations.map((item) => ({ direction: item.direction, legacyMarkedPaid: item.legacyMarkedPaid, status: item.status, note: item.note, createdAt: item.createdAt.toISOString(), reconciledAt: item.reconciledAt?.toISOString() ?? null })) })),
        payments: payments.map((payment) => ({ amount: payment.amount, paidAt: payment.paidAt.toISOString(), note: payment.noteSnapshot, allocations: payment.allocations.map((allocation) => ({ participant: allocation.participantNameSnapshot, type: allocation.type, amount: allocation.amount, destinationKorda: allocation.destinationKordaNameSnapshot })) })),
      };
      await tx.registrationPurge.create({ data: { id: purgeId, eventId: plan.eventId, eventNameSnapshot: plan.eventName, actorUserId: scope.userId, actorNameSnapshot: actor?.name ?? "Admin", actorUsernameSnapshot: actor?.username ?? null, reason, participantCount: registrations.length, registrationCount: registrations.length, journeyCount: plan.journeyIds.length, paymentCount: payments.length, paymentAmount: payments.reduce((sum, payment) => sum + payment.amount, 0), details, financialSnapshot: { centralCashBefore: plan.financial.centralCashBefore, centralCashAfter: plan.financial.centralCashAfter, affectedKordas: plan.financial.affectedKordas } } });
      if (storageKeys.length) await tx.registrationPurgeEvidence.createMany({ data: storageKeys.map((row) => ({ purgeId, storageKey: row.storageKey, originalName: row.originalName })) });
      await tx.financialAuditEntry.deleteMany({ where: { paymentId: { in: plan.paymentIds } } });
      await tx.kordaBalanceEntry.deleteMany({ where: { sourcePaymentAllocationId: { in: plan.allocationIds } } });
      await tx.paymentAllocation.deleteMany({ where: { id: { in: plan.allocationIds } } });
      await tx.legacyPaymentReconciliation.deleteMany({ where: { registrationId: { in: plan.registrationIds } } });
      await tx.evidenceFile.deleteMany({ where: { paymentId: { in: plan.paymentIds } } });
      await tx.payment.deleteMany({ where: { id: { in: plan.paymentIds } } });
      await tx.registration.deleteMany({ where: { id: { in: plan.registrationIds } } });
    }, { isolationLevel: "Serializable", timeout: 30_000 });

    let cleanupFailed = 0;
    await Promise.all(storageKeys.map(async ({ storageKey }) => {
      try {
        await deleteEvidenceObject(storageKey);
        await prisma.registrationPurgeEvidence.update({ where: { storageKey }, data: { status: "DELETED", attemptedAt: new Date(), deletedAt: new Date(), errorMessage: null } });
      } catch (error) {
        cleanupFailed += 1;
        await prisma.registrationPurgeEvidence.update({ where: { storageKey }, data: { status: "FAILED", attemptedAt: new Date(), errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Gagal menghapus objek Supabase." } });
      }
    }));
    revalidatePath("/daftar-peserta"); revalidatePath("/registrasi"); revalidatePath("/pembayaran"); revalidatePath("/refund"); revalidatePath("/koreksi-keuangan"); revalidatePath("/laporan"); revalidatePath("/keuangan"); revalidatePath("/keuangan/[kordaId]", "page"); revalidatePath("/riwayat-penghapusan"); revalidatePath("/dashboard"); revalidatePath("/rombongan"); revalidatePath("/data-pulang"); revalidatePath("/cetak-dokumen");
    return { success: true as const, purgeId, cleanupFailed };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Gagal menghapus grup registrasi." };
  }
}

export async function retryPurgeEvidenceCleanupAction(purgeEvidenceId: string) {
  try {
    const scope = await getRegionalAccessScope();
    requireAdmin(scope);
    const row = await prisma.registrationPurgeEvidence.findUnique({ where: { id: purgeEvidenceId }, select: { id: true, storageKey: true, status: true } });
    if (!row || row.status === "DELETED") return { success: false as const, error: "Bukti tidak ditemukan atau sudah dihapus." };
    try {
      await deleteEvidenceObject(row.storageKey);
      await prisma.registrationPurgeEvidence.update({ where: { id: row.id }, data: { status: "DELETED", attemptedAt: new Date(), deletedAt: new Date(), errorMessage: null } });
    } catch (error) {
      await prisma.registrationPurgeEvidence.update({ where: { id: row.id }, data: { status: "FAILED", attemptedAt: new Date(), errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Gagal menghapus objek Supabase." } });
      throw error;
    }
    revalidatePath("/riwayat-penghapusan");
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Gagal mengulang penghapusan bukti." };
  }
}

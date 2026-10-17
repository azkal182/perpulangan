"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { ensureKordaInScope, getRegionalAccessScope } from "@/server/access-scope";

export async function reconcileLegacyPaymentAction(formData: FormData) {
  try {
    const scope = await getRegionalAccessScope();
    const legacyId = String(formData.get("legacyId") ?? "");
    const amount = Math.trunc(Number(formData.get("amount")));
    const paidAt = new Date(String(formData.get("paidAt") ?? ""));
    const note = String(formData.get("note") ?? "").trim();
    if (!legacyId || !Number.isSafeInteger(amount) || amount <= 0 || Number.isNaN(paidAt.getTime()) || !note) return { success: false, error: "Nominal aktual, tanggal pembayaran, dan catatan verifikasi wajib diisi." };

    await prisma.$transaction(async (tx) => {
      const legacy = await tx.legacyPaymentReconciliation.findUnique({
        where: { id: legacyId },
        include: { registration: { include: { student: { select: { name: true } }, externalParticipant: { select: { name: true } } } } },
      });
      if (!legacy || legacy.status !== "OPEN") throw new Error("Item rekonsiliasi tidak ditemukan atau sudah diselesaikan.");
      const journey = await tx.journey.findUnique({ where: { registrationId_direction: { registrationId: legacy.registrationId, direction: legacy.direction } }, include: { destinationKorda: { select: { id: true, name: true } } } });
      if (!journey) throw new Error("Perjalanan untuk tanda lunas lama tidak ditemukan.");
      await ensureKordaInScope(scope, journey.destinationKordaId, "Rekonsiliasi berada di luar cakupan Korda Anda.");
      if (journey.tariffSnapshot === null) throw new Error("Tarif perjalanan belum tersedia. Lengkapi informasi tarif sebelum merekonsiliasi nominal historis.");
      const paid = await tx.paymentAllocation.aggregate({ where: { journeyId: journey.id, type: "JOURNEY" }, _sum: { amount: true } });
      const [refunded, corrected] = await Promise.all([
        tx.refund.aggregate({ where: { paymentAllocation: { journeyId: journey.id } }, _sum: { amount: true } }),
        tx.financialCorrection.aggregate({ where: { paymentAllocation: { journeyId: journey.id } }, _sum: { amount: true } }),
      ]);
      const remaining = Math.max(0, journey.tariffSnapshot - (paid._sum.amount ?? 0) + (refunded._sum.amount ?? 0) + (corrected._sum.amount ?? 0));
      const journeyAmount = Math.min(amount, remaining);
      const balanceAmount = amount - journeyAmount;
      const participantName = legacy.registration.student?.name ?? legacy.registration.externalParticipant?.name ?? "Peserta";
      const paymentId = randomUUID();
      const noteSnapshot = `Rekonsiliasi tanda lunas lama ${legacy.id}: ${note}`;
      await tx.payment.create({ data: { id: paymentId, eventId: legacy.registration.eventId, payerName: `Pembayaran historis · ${participantName}`, amount, method: "LEGACY_RECONCILIATION", paidAt, noteSnapshot, createdByUserId: scope.userId } });
      if (journeyAmount > 0) await tx.paymentAllocation.create({ data: { paymentId, type: "JOURNEY", journeyId: journey.id, participantNameSnapshot: participantName, originKordaNameSnapshot: legacy.registration.originKordaNameSnapshot, destinationKordaNameSnapshot: journey.destinationKorda.name, payerNameSnapshot: `Pembayaran historis · ${participantName}`, amount: journeyAmount, createdByUserId: scope.userId } });
      if (balanceAmount > 0) {
        const allocation = await tx.paymentAllocation.create({ data: { paymentId, type: "BALANCE", balanceOwnerKordaId: journey.destinationKordaId, participantNameSnapshot: participantName, originKordaNameSnapshot: legacy.registration.originKordaNameSnapshot, destinationKordaNameSnapshot: journey.destinationKorda.name, payerNameSnapshot: `Pembayaran historis · ${participantName}`, amount: balanceAmount, createdByUserId: scope.userId } });
        await tx.kordaBalanceEntry.create({ data: { ownerKordaId: journey.destinationKordaId, originKordaNameSnapshot: legacy.registration.originKordaNameSnapshot, destinationKordaNameSnapshot: journey.destinationKorda.name, participantNameSnapshot: participantName, payerNameSnapshot: `Pembayaran historis · ${participantName}`, sourcePaymentAllocationId: allocation.id, entryType: "CREDIT", amount: balanceAmount, reason: `Kelebihan nominal rekonsiliasi ${legacy.id}`, createdByUserId: scope.userId } });
      }
      await tx.legacyPaymentReconciliation.update({ where: { id: legacy.id }, data: { status: "RECONCILED", reconciledByUserId: scope.userId, reconciledAt: new Date(), note: noteSnapshot } });
      await tx.financialAuditEntry.create({ data: { action: "LEGACY_PAYMENT_RECONCILED", entityType: "LegacyPaymentReconciliation", entityId: legacy.id, eventId: legacy.registration.eventId, kordaScopeId: journey.destinationKordaId, actorUserId: scope.userId, actorRoleSnapshot: scope.role, amount, reason: noteSnapshot, paymentId } });
    }, { isolationLevel: "Serializable" });
    revalidatePath("/pembayaran"); revalidatePath("/daftar-peserta");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Gagal merekonsiliasi pembayaran lama." };
  }
}

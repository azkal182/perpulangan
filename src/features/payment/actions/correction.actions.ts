"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { ensureKordaInScope, getRegionalAccessScope } from "@/server/access-scope";

export async function recordFinancialCorrectionAction(formData: FormData) {
  try {
    const scope = await getRegionalAccessScope();
    const paymentAllocationId = String(formData.get("paymentAllocationId") ?? "") || null;
    const balanceSourceEntryId = String(formData.get("balanceSourceEntryId") ?? "") || null;
    const amount = Number(formData.get("amount"));
    const reason = String(formData.get("reason") ?? "").trim();
    const correctedAt = new Date(String(formData.get("correctedAt") ?? ""));
    if (!!paymentAllocationId === !!balanceSourceEntryId) return { success: false, error: "Pilih satu transaksi sumber koreksi." };
    if (!Number.isSafeInteger(amount) || amount <= 0 || !reason || Number.isNaN(correctedAt.getTime())) return { success: false, error: "Nominal, alasan, dan tanggal koreksi wajib valid." };

    const id = randomUUID();
    let eventId: string | null = null;
    let kordaScopeId: string;
    let participantName = "Saldo Lain";
    await prisma.$transaction(async (tx) => {
      if (paymentAllocationId) {
        const source = await tx.paymentAllocation.findUnique({ where: { id: paymentAllocationId }, include: { journey: { include: { registration: { select: { eventId: true } } } }, refunds: { select: { amount: true } }, corrections: { select: { amount: true } } } });
        if (!source || source.type !== "JOURNEY" || !source.journey) throw new Error("Alokasi perjalanan tidak ditemukan.");
        kordaScopeId = source.journey.destinationKordaId;
        await ensureKordaInScope(scope, kordaScopeId, "Koreksi berada di luar cakupan Korda Anda.");
        const remaining = source.amount - source.refunds.reduce((sum, row) => sum + row.amount, 0) - source.corrections.reduce((sum, row) => sum + row.amount, 0);
        if (amount > remaining) throw new Error(`Nominal koreksi melebihi dana yang masih dapat dikoreksi (${remaining}).`);
        eventId = source.journey.registration.eventId;
        participantName = source.participantNameSnapshot;
        await tx.financialCorrection.create({ data: { id, paymentAllocationId, amount, reason, correctedAt, createdByUserId: scope.userId, eventId, kordaScopeId } });
      } else {
        const source = await tx.kordaBalanceEntry.findUnique({ where: { id: balanceSourceEntryId! }, include: { sourcePaymentAllocation: { include: { payment: { select: { eventId: true } } } }, refundsFromSource: { select: { amount: true } }, correctionsFromSource: { select: { amount: true } } } });
        if (!source || source.entryType !== "CREDIT") throw new Error("Sumber Saldo Lain tidak ditemukan atau tidak dapat dikoreksi.");
        kordaScopeId = source.ownerKordaId;
        await ensureKordaInScope(scope, kordaScopeId, "Koreksi Saldo Lain berada di luar cakupan Korda Anda.");
        const remaining = source.amount - source.refundsFromSource.reduce((sum, row) => sum + row.amount, 0) - source.correctionsFromSource.reduce((sum, row) => sum + row.amount, 0);
        if (amount > remaining) throw new Error(`Nominal koreksi melebihi saldo yang masih dapat dikoreksi (${remaining}).`);
        eventId = source.sourcePaymentAllocation?.payment.eventId ?? null;
        participantName = source.participantNameSnapshot;
        await tx.financialCorrection.create({ data: { id, balanceSourceEntryId, amount, reason, correctedAt, createdByUserId: scope.userId, eventId, kordaScopeId } });
        await tx.kordaBalanceEntry.create({ data: { ownerKordaId: source.ownerKordaId, originKordaNameSnapshot: source.originKordaNameSnapshot, destinationKordaNameSnapshot: source.destinationKordaNameSnapshot, participantNameSnapshot: source.participantNameSnapshot, payerNameSnapshot: source.payerNameSnapshot, sourceCorrectionId: id, entryType: "CORRECTION", amount: -amount, reason, createdByUserId: scope.userId } });
      }
      await tx.financialAuditEntry.create({ data: { action: "FINANCIAL_CORRECTION_RECORDED", entityType: "FinancialCorrection", entityId: id, eventId, kordaScopeId, actorUserId: scope.userId, actorRoleSnapshot: scope.role, amount, reason, correctionId: id } });
    }, { isolationLevel: "Serializable" });
    revalidatePath("/pembayaran"); revalidatePath("/refund");
    return { success: true, participantName };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Gagal mencatat koreksi keuangan." };
  }
}

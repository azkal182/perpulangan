"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { getRegionalAccessScope, requireAdmin } from "@/server/access-scope";

export async function recordTreasuryDisbursementAction(formData: FormData) {
  try {
    const scope = await getRegionalAccessScope();
    requireAdmin(scope);
    const kordaId = String(formData.get("kordaId") ?? "");
    const amount = Number(formData.get("amount"));
    const dateValue = String(formData.get("disbursedAt") ?? "");
    const disbursedAt = new Date(`${dateValue}T00:00:00+07:00`);
    const note = String(formData.get("note") ?? "").trim() || null;
    if (!kordaId || !Number.isSafeInteger(amount) || amount <= 0 || !dateValue || Number.isNaN(disbursedAt.getTime())) {
      return { success: false, error: "Korda, nominal, dan tanggal pencairan wajib diisi dengan benar." };
    }

    const disbursementId = randomUUID();
    await prisma.$transaction(async (tx) => {
      const korda = await tx.korda.findUnique({ where: { id: kordaId }, select: { id: true } });
      if (!korda) throw new Error("Korda tujuan pencairan tidak ditemukan.");
      const [payments, refunds, previousDisbursements, kordaDisbursements, journeyAllocations, journeyRefunds, journeyCorrections, balanceEntries] = await Promise.all([
        tx.payment.aggregate({ _sum: { amount: true } }),
        tx.refund.aggregate({ _sum: { amount: true } }),
        tx.treasuryDisbursement.aggregate({ _sum: { amount: true } }),
        tx.treasuryDisbursement.aggregate({ where: { kordaId }, _sum: { amount: true } }),
        tx.paymentAllocation.aggregate({ where: { type: "JOURNEY", journey: { destinationKordaId: kordaId } }, _sum: { amount: true } }),
        tx.refund.aggregate({ where: { paymentAllocation: { type: "JOURNEY", journey: { destinationKordaId: kordaId } } }, _sum: { amount: true } }),
        tx.financialCorrection.aggregate({ where: { paymentAllocation: { type: "JOURNEY", journey: { destinationKordaId: kordaId } } }, _sum: { amount: true } }),
        tx.kordaBalanceEntry.groupBy({ by: ["entryType"], where: { ownerKordaId: kordaId }, _sum: { amount: true } }),
      ]);
      const centerCash = (payments._sum.amount ?? 0) - (refunds._sum.amount ?? 0) - (previousDisbursements._sum.amount ?? 0);
      const balanceFunds = balanceEntries.reduce((sum, row) => sum + (row.entryType === "CREDIT" ? Math.abs(row._sum.amount ?? 0) : -Math.abs(row._sum.amount ?? 0)), 0);
      const kordaFunds = (journeyAllocations._sum.amount ?? 0) - (journeyRefunds._sum.amount ?? 0) - (journeyCorrections._sum.amount ?? 0) + balanceFunds - (kordaDisbursements._sum.amount ?? 0);
      const maxDisbursement = Math.max(0, Math.min(centerCash, kordaFunds));
      if (amount > maxDisbursement) {
        throw new Error(`Nominal melebihi dana yang dapat dicairkan. Maksimal saat ini Rp${maxDisbursement.toLocaleString("id-ID")}.`);
      }
      await tx.treasuryDisbursement.create({ data: { id: disbursementId, kordaId, amount, disbursedAt, note, createdByUserId: scope.userId } });
      await tx.financialAuditEntry.create({ data: { action: "TREASURY_DISBURSEMENT_RECORDED", entityType: "TreasuryDisbursement", entityId: disbursementId, kordaScopeId: kordaId, actorUserId: scope.userId, actorRoleSnapshot: scope.role, amount, reason: note, disbursementId } });
    }, { isolationLevel: "Serializable" });
    revalidatePath("/keuangan");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Gagal mencatat pencairan ke Korda." };
  }
}

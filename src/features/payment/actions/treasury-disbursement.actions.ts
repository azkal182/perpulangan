"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { getRegionalAccessScope, requireAdmin } from "@/server/access-scope";
import { CENTRAL_FEE_PER_JOURNEY } from "../services/korda-finance-detail";

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
      const [payments, refunds, previousDisbursements, kordaDisbursements, journeys, balanceEntries] = await Promise.all([
        tx.payment.aggregate({ _sum: { amount: true } }),
        tx.refund.aggregate({ _sum: { amount: true } }),
        tx.treasuryDisbursement.aggregate({ _sum: { amount: true } }),
        tx.treasuryDisbursement.aggregate({ where: { kordaId }, _sum: { amount: true } }),
        tx.journey.findMany({
          where: { destinationKordaId: kordaId },
          select: {
            status: true,
            tariffSnapshot: true,
            paymentAllocations: {
              select: {
                amount: true,
                refunds: { select: { amount: true } },
                corrections: { select: { amount: true } },
              },
            },
          },
        }),
        tx.kordaBalanceEntry.groupBy({ by: ["entryType"], where: { ownerKordaId: kordaId }, _sum: { amount: true } }),
      ]);
      const centerCash = (payments._sum.amount ?? 0) - (refunds._sum.amount ?? 0) - (previousDisbursements._sum.amount ?? 0);
      const balanceFunds = balanceEntries.reduce((sum, row) => sum + (row.entryType === "CREDIT" ? Math.abs(row._sum.amount ?? 0) : -Math.abs(row._sum.amount ?? 0)), 0);
      const registrationReceived = journeys.reduce((sum, journey) => sum + journey.paymentAllocations.reduce((journeySum, allocation) => journeySum
        + allocation.amount
        - allocation.refunds.reduce((refundSum, refund) => refundSum + refund.amount, 0)
        - allocation.corrections.reduce((correctionSum, correction) => correctionSum + correction.amount, 0), 0), 0);
      const billableJourneys = journeys.filter((journey) => journey.status === "REGISTERED" && (journey.tariffSnapshot ?? 0) > 0);
      const grossBilled = billableJourneys.reduce((sum, journey) => sum + (journey.tariffSnapshot ?? 0), 0);
      const fee = billableJourneys.length * CENTRAL_FEE_PER_JOURNEY;
      const netRegistrationEntitlement = Math.max(0, grossBilled - fee);
      const disbursed = kordaDisbursements._sum.amount ?? 0;
      const remainingAttributedCash = registrationReceived + balanceFunds - disbursed;
      const remainingKordaRight = netRegistrationEntitlement + balanceFunds - disbursed;
      const maxDisbursement = Math.max(0, Math.min(centerCash, remainingAttributedCash, remainingKordaRight));
      if (amount > maxDisbursement) {
        throw new Error(`Nominal melebihi dana yang dapat dicairkan. Maksimal saat ini Rp${maxDisbursement.toLocaleString("id-ID")}.`);
      }
      await tx.treasuryDisbursement.create({ data: { id: disbursementId, kordaId, amount, disbursedAt, note, createdByUserId: scope.userId } });
      await tx.financialAuditEntry.create({ data: { action: "TREASURY_DISBURSEMENT_RECORDED", entityType: "TreasuryDisbursement", entityId: disbursementId, kordaScopeId: kordaId, actorUserId: scope.userId, actorRoleSnapshot: scope.role, amount, reason: note, disbursementId } });
    }, { isolationLevel: "Serializable" });
    revalidatePath("/keuangan");
    revalidatePath(`/keuangan/${kordaId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Gagal mencatat pencairan ke Korda." };
  }
}

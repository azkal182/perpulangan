import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import type { RegionalAccessScope } from "@/server/access-scope";

export async function getTreasuryPosition(scope: RegionalAccessScope) {
  const kordaScope: Prisma.KordaWhereInput = scope.role === "admin"
    ? {}
    : scope.role === "korwil"
      ? { korwilId: scope.korwilId ?? "__NO_ACCESS__" }
      : { id: scope.kordaId ?? "__NO_ACCESS__" };

  const [kordas, journeyAllocations, balanceEntries, disbursedByKorda, payments, refunds, allDisbursements] = await Promise.all([
    prisma.korda.findMany({ where: kordaScope, select: { id: true, name: true } }),
    prisma.paymentAllocation.findMany({
      where: { type: "JOURNEY", journey: { destinationKorda: { is: kordaScope } } },
      select: {
        amount: true,
        journey: { select: { destinationKordaId: true } },
        refunds: { select: { amount: true } },
        corrections: { select: { amount: true } },
      },
    }),
    prisma.kordaBalanceEntry.findMany({
      where: { ownerKorda: { is: kordaScope } },
      select: { ownerKordaId: true, entryType: true, amount: true },
    }),
    prisma.treasuryDisbursement.groupBy({
      by: ["kordaId"],
      where: { korda: { is: kordaScope } },
      _sum: { amount: true },
    }),
    scope.role === "admin" ? prisma.payment.aggregate({ _sum: { amount: true } }) : Promise.resolve(null),
    scope.role === "admin" ? prisma.refund.aggregate({ _sum: { amount: true } }) : Promise.resolve(null),
    scope.role === "admin" ? prisma.treasuryDisbursement.aggregate({ _sum: { amount: true } }) : Promise.resolve(null),
  ]);

  const positions = new Map(kordas.map((korda) => [korda.id, {
    id: korda.id,
    name: korda.name,
    assigned: 0,
    disbursed: 0,
    heldAtCenter: 0,
  }]));

  for (const allocation of journeyAllocations) {
    if (!allocation.journey) continue;
    const position = positions.get(allocation.journey.destinationKordaId);
    if (!position) continue;
    position.assigned += allocation.amount
      - allocation.refunds.reduce((sum, row) => sum + row.amount, 0)
      - allocation.corrections.reduce((sum, row) => sum + row.amount, 0);
  }

  for (const entry of balanceEntries) {
    const position = positions.get(entry.ownerKordaId);
    if (!position) continue;
    position.assigned += entry.entryType === "CREDIT" ? Math.abs(entry.amount) : -Math.abs(entry.amount);
  }

  for (const disbursement of disbursedByKorda) {
    const position = positions.get(disbursement.kordaId);
    if (!position) continue;
    position.disbursed = disbursement._sum.amount ?? 0;
  }

  for (const position of positions.values()) {
    position.heldAtCenter = position.assigned - position.disbursed;
  }

  const totalAssigned = [...positions.values()].reduce((sum, row) => sum + row.assigned, 0);
  const totalDisbursed = [...positions.values()].reduce((sum, row) => sum + row.disbursed, 0);
  const centralBalance = scope.role === "admin"
    ? (payments?._sum.amount ?? 0) - (refunds?._sum.amount ?? 0) - (allDisbursements?._sum.amount ?? 0)
    : null;

  return {
    kordas,
    positions: [...positions.values()].sort((a, b) => a.name.localeCompare(b.name, "id")),
    totalAssigned,
    totalDisbursed,
    totalHeldAtCenter: totalAssigned - totalDisbursed,
    centralBalance,
    unallocatedCentralCash: centralBalance === null ? null : centralBalance - (totalAssigned - totalDisbursed),
  };
}

import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import type { RegionalAccessScope } from "@/server/access-scope";
import { CENTRAL_FEE_PER_JOURNEY } from "./korda-finance-detail";

export async function getTreasuryPosition(scope: RegionalAccessScope) {
  const kordaScope: Prisma.KordaWhereInput = scope.role === "admin"
    ? {}
    : scope.role === "korwil"
      ? { korwilId: scope.korwilId ?? "__NO_ACCESS__" }
      : { id: scope.kordaId ?? "__NO_ACCESS__" };

  const [kordas, journeys, balanceEntries, disbursedByKorda, payments, refunds, allDisbursements] = await Promise.all([
    prisma.korda.findMany({ where: kordaScope, select: { id: true, name: true } }),
    prisma.journey.findMany({
      where: { destinationKorda: { is: kordaScope } },
      select: {
        destinationKordaId: true,
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
    grossBilled: 0,
    billedJourneyCount: 0,
    cancelledJourneyCount: 0,
    fee: 0,
    registrationEntitlement: 0,
    registrationReceived: 0,
    balanceCash: 0,
    assigned: 0,
    disbursed: 0,
    heldAtCenter: 0,
  }]));

  for (const journey of journeys) {
    const position = positions.get(journey.destinationKordaId);
    if (!position) continue;
    const received = journey.paymentAllocations.reduce((total, allocation) => total
      + allocation.amount
      - allocation.refunds.reduce((sum, row) => sum + row.amount, 0)
      - allocation.corrections.reduce((sum, row) => sum + row.amount, 0), 0);
    position.registrationReceived += Math.max(0, received);
    if (journey.status === "CANCELLED") {
      position.cancelledJourneyCount += 1;
      continue;
    }
    if (journey.status !== "REGISTERED" || journey.tariffSnapshot === null || journey.tariffSnapshot <= 0) continue;
    position.grossBilled += journey.tariffSnapshot;
    position.billedJourneyCount += 1;
  }

  for (const position of positions.values()) {
    position.fee = position.billedJourneyCount * CENTRAL_FEE_PER_JOURNEY;
    position.registrationEntitlement = Math.max(0, position.grossBilled - position.fee);
  }

  for (const entry of balanceEntries) {
    const position = positions.get(entry.ownerKordaId);
    if (!position) continue;
    position.balanceCash += entry.entryType === "CREDIT" ? Math.abs(entry.amount) : -Math.abs(entry.amount);
  }

  for (const disbursement of disbursedByKorda) {
    const position = positions.get(disbursement.kordaId);
    if (!position) continue;
    position.disbursed = disbursement._sum.amount ?? 0;
  }

  for (const position of positions.values()) {
    position.assigned = position.registrationEntitlement + position.balanceCash;
    const attributedCash = position.registrationReceived + position.balanceCash;
    position.heldAtCenter = Math.min(attributedCash - position.disbursed, position.assigned - position.disbursed);
  }

  const totalAssigned = [...positions.values()].reduce((sum, row) => sum + row.assigned, 0);
  const totalGrossBilled = [...positions.values()].reduce((sum, row) => sum + row.grossBilled, 0);
  const totalRegistrationEntitlement = [...positions.values()].reduce((sum, row) => sum + row.registrationEntitlement, 0);
  const totalDisbursed = [...positions.values()].reduce((sum, row) => sum + row.disbursed, 0);
  const totalHeldAtCenter = [...positions.values()].reduce((sum, row) => sum + row.heldAtCenter, 0);
  const totalFee = [...positions.values()].reduce((sum, row) => sum + row.fee, 0);
  const totalBalanceCash = [...positions.values()].reduce((sum, row) => sum + row.balanceCash, 0);
  const centralBalance = scope.role === "admin"
    ? (payments?._sum.amount ?? 0) - (refunds?._sum.amount ?? 0) - (allDisbursements?._sum.amount ?? 0)
    : null;

  return {
    kordas,
    positions: [...positions.values()].sort((a, b) => a.name.localeCompare(b.name, "id")),
    totalAssigned,
    totalGrossBilled,
    totalRegistrationEntitlement,
    totalPaymentReceipts: payments?._sum.amount ?? null,
    totalDisbursed,
    totalHeldAtCenter,
    totalFee,
    totalBalanceCash,
    cancelledJourneyCount: [...positions.values()].reduce((sum, row) => sum + row.cancelledJourneyCount, 0),
    centralBalance,
    unallocatedCentralCash: centralBalance === null ? null : centralBalance - totalHeldAtCenter,
  };
}

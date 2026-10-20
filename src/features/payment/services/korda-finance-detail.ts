import prisma from "@/lib/prisma";

export const CENTRAL_FEE_PER_JOURNEY = 10_000;

export async function getKordaFinanceDetail(kordaId: string) {
  const [korda, journeys, balanceEntries, disbursements] = await Promise.all([
    prisma.korda.findUnique({ where: { id: kordaId }, select: { id: true, name: true } }),
    prisma.journey.findMany({
      where: { destinationKordaId: kordaId },
      include: {
        registration: {
          include: {
            event: { select: { id: true, name: true } },
            student: { select: { id: true, name: true, nis: true } },
            externalParticipant: { select: { id: true, name: true } },
          },
        },
        paymentAllocations: {
          include: {
            payment: { include: { evidence: true } },
            refunds: { select: { amount: true } },
            corrections: { select: { amount: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.kordaBalanceEntry.findMany({
      where: { ownerKordaId: kordaId },
      include: {
        sourcePaymentAllocation: { include: { payment: { include: { evidence: true } } } },
        sourceRefund: { include: { evidence: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.treasuryDisbursement.findMany({
      where: { kordaId },
      orderBy: [{ disbursedAt: "desc" }],
    }),
  ]);

  if (!korda) return null;

  const journeyRows = journeys.map((journey) => {
    const participant = journey.registration.student?.name
      ?? journey.registration.externalParticipant?.name
      ?? "Peserta tidak diketahui";
    const received = journey.paymentAllocations.reduce((total, allocation) => total
      + allocation.amount
      - allocation.refunds.reduce((sum, refund) => sum + refund.amount, 0)
      - allocation.corrections.reduce((sum, correction) => sum + correction.amount, 0), 0);
    return {
      id: journey.id,
      registrationId: journey.registrationId,
      studentId: journey.registration.student?.id ?? null,
      externalParticipantId: journey.registration.externalParticipant?.id ?? null,
      eventId: journey.registration.event.id,
      eventName: journey.registration.event.name,
      participant,
      nis: journey.registration.student?.nis ?? null,
      originKorda: journey.registration.originKordaNameSnapshot,
      direction: journey.direction,
      destination: journey.destinationKordaNameSnapshot,
      status: journey.status,
      tariff: journey.tariffSnapshot ?? 0,
      received: Math.max(0, received),
      outstanding: journey.status === "REGISTERED" ? Math.max(0, (journey.tariffSnapshot ?? 0) - Math.max(0, received)) : 0,
      paymentRows: journey.paymentAllocations.map((allocation) => ({
        id: allocation.id,
        paymentId: allocation.payment.id,
        paidAt: allocation.payment.paidAt,
        amount: allocation.amount,
        netAmount: allocation.amount
          - allocation.refunds.reduce((sum, refund) => sum + refund.amount, 0)
          - allocation.corrections.reduce((sum, correction) => sum + correction.amount, 0),
        evidence: allocation.payment.evidence && !allocation.payment.evidence.purgedAt
          ? { id: allocation.payment.evidence.id, name: allocation.payment.evidence.originalName }
          : null,
      })),
    };
  });

  const balanceRows = balanceEntries.map((entry) => ({
    id: entry.id,
    type: entry.entryType,
    participant: entry.participantNameSnapshot,
    originKorda: entry.originKordaNameSnapshot,
    amount: Math.abs(entry.amount) * (entry.entryType === "CREDIT" ? 1 : -1),
    reason: entry.reason,
    createdAt: entry.createdAt,
    evidence: entry.sourcePaymentAllocation?.payment.evidence && !entry.sourcePaymentAllocation.payment.evidence.purgedAt
      ? { id: entry.sourcePaymentAllocation.payment.evidence.id, name: entry.sourcePaymentAllocation.payment.evidence.originalName }
      : null,
    refundEvidence: entry.sourceRefund?.evidence && !entry.sourceRefund.evidence.purgedAt
      ? { id: entry.sourceRefund.evidence.id, name: entry.sourceRefund.evidence.originalName }
      : null,
  }));

  const billableJourneys = journeyRows.filter((journey) => journey.status === "REGISTERED" && journey.tariff > 0);
  const cancelledJourneys = journeyRows.filter((journey) => journey.status === "CANCELLED");
  const grossBilled = billableJourneys.reduce((sum, journey) => sum + journey.tariff, 0);
  const registrationReceipts = journeyRows.reduce((sum, journey) => sum + journey.received, 0);
  const balanceNet = balanceRows.reduce((sum, entry) => sum + entry.amount, 0);
  const feeAmount = billableJourneys.length * CENTRAL_FEE_PER_JOURNEY;

  const participantMap = new Map<string, {
    id: string;
    participant: string;
    nis: string | null;
    origins: Set<string>;
    events: Set<string>;
    billableJourneyCount: number;
    billed: number;
    received: number;
    outstanding: number;
    payments: Map<string, {
      id: string;
      paidAt: Date;
      amount: number;
      netAmount: number;
      evidence: { id: string; name: string } | null;
      events: Set<string>;
      directions: Set<string>;
    }>;
  }>();

  for (const journey of journeyRows) {
    const key = journey.studentId
      ? `student:${journey.studentId}`
      : journey.externalParticipantId
        ? `external:${journey.externalParticipantId}`
        : `registration:${journey.registrationId}`;
    let participantRow = participantMap.get(key);
    if (!participantRow) {
      participantRow = {
        id: key,
        participant: journey.participant,
        nis: journey.nis,
        origins: new Set<string>(),
        events: new Set<string>(),
        billableJourneyCount: 0,
        billed: 0,
        received: 0,
        outstanding: 0,
        payments: new Map(),
      };
      participantMap.set(key, participantRow);
    }
    if (journey.originKorda) participantRow.origins.add(journey.originKorda);
    participantRow.events.add(journey.eventName);
    participantRow.received += journey.received;
    participantRow.outstanding += journey.outstanding;
    if (journey.status === "REGISTERED" && journey.tariff > 0) {
      participantRow.billableJourneyCount += 1;
      participantRow.billed += journey.tariff;
    }

    for (const payment of journey.paymentRows) {
      const paymentRow = participantRow.payments.get(payment.paymentId) ?? {
        id: payment.paymentId,
        paidAt: payment.paidAt,
        amount: 0,
        netAmount: 0,
        evidence: payment.evidence,
        events: new Set<string>(),
        directions: new Set<string>(),
      };
      paymentRow.amount += payment.amount;
      paymentRow.netAmount += payment.netAmount;
      paymentRow.events.add(journey.eventName);
      paymentRow.directions.add(journey.direction === "OUTBOUND" ? "Pulang" : "Kembali");
      participantRow.payments.set(payment.paymentId, paymentRow);
    }
  }

  const participantRows = [...participantMap.values()]
    .map((participant) => ({
      id: participant.id,
      participant: participant.participant,
      nis: participant.nis,
      origins: [...participant.origins],
      events: [...participant.events],
      billableJourneyCount: participant.billableJourneyCount,
      billed: participant.billed,
      received: participant.received,
      outstanding: participant.outstanding,
      payments: [...participant.payments.values()]
        .map((payment) => ({ ...payment, events: [...payment.events], directions: [...payment.directions] }))
        .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime()),
    }))
    .sort((a, b) => a.participant.localeCompare(b.participant, "id"));

  return {
    korda,
    journeys: journeyRows,
    participantPayments: participantRows,
    balanceEntries: balanceRows,
    disbursements,
    summary: {
      grossBilled,
      billableJourneyCount: billableJourneys.length,
      feeAmount,
      netRegistrationEntitlement: Math.max(0, grossBilled - feeAmount),
      registrationReceipts,
      balanceNet,
      cancelledJourneyCount: cancelledJourneys.length,
      disbursed: disbursements.reduce((sum, disbursement) => sum + disbursement.amount, 0),
    },
  };
}

import prisma from "@/lib/prisma";
import { normalizeExternalParticipantGender } from "@/features/santri/domain/external-participant";
import type { Prisma, RegistrationStatus } from "@/generated/prisma/client";
import {
  andWhere,
  getRegionalAccessScope,
  registrationScopeWhere,
} from "@/server/access-scope";

export interface RegistrationFilters {
  eventId: string;
  journeyType?: "both" | "return_only" | "outbound_only" | "all";
  status?: RegistrationStatus | "all";
  gender?: "Laki-laki" | "Perempuan";
  outboundKordaId?: string;
  returnKordaId?: string;
  dropPointId?: string;
  search?: string; // student name or NIS
  page?: number;
  pageSize?: number;
}

export interface RegistrationWithDetails {
  id: string;
  student: {
    id: string;
    name: string;
    nis: string | null;
    gender: string | null;
    ttl: string | null;
  };
  externalParticipant: { id: string; name: string; gender: string | null; address: string | null } | null;
  outboundKorda: { id: string; name: string } | null;
  outboundDropPoint: { id: string; name: string; price: number } | null;
  outboundBus: { id: string; label: string } | null;
  outboundDate: Date | null;
  outboundPaid: boolean;
  outboundPaymentStatus?: "UNPAID" | "PARTIAL" | "PAID" | "UNKNOWN" | null;
  returnKorda: { id: string; name: string } | null;
  returnDropPoint: { id: string; name: string; price: number } | null;
  returnBus: { id: string; label: string } | null;
  returnDate: Date | null;
  returnPaid: boolean;
  returnPaymentStatus?: "UNPAID" | "PARTIAL" | "PAID" | "UNKNOWN" | null;
  status: RegistrationStatus;
  kordaChanged: boolean;
  kordaChangeConfirmed: boolean;
  registrarName: string;
  registrarPhone: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
  cancelReason: string | null;
}

export async function getFilteredRegistrations(
  filters: RegistrationFilters,
): Promise<{ data: RegistrationWithDetails[]; total: number }> {
  const scope = await getRegionalAccessScope();
  const journeyScope: Prisma.JourneyWhereInput | undefined = scope.role === "admin" ? undefined : scope.role === "korwil" ? { destinationKorda: { korwilId: scope.korwilId ?? "__NO_ACCESS__" } } : { destinationKordaId: scope.kordaId ?? "__NO_ACCESS__" };
  const {
    eventId,
    journeyType = "all",
    status = "all",
    gender,
    outboundKordaId,
    returnKordaId,
    dropPointId,
    search,
    page = 1,
    pageSize = 20,
  } = filters;

  // Build where clause
  const where: Prisma.RegistrationWhereInput = {
    eventId,
  };

  // Journey type filter
  if (journeyType === "both") {
    where.AND = [
      { outboundDate: { not: null } },
      { returnDate: { not: null } },
    ];
  } else if (journeyType === "return_only") {
    where.outboundDate = null;
    where.returnDate = { not: null };
  } else if (journeyType === "outbound_only") {
    where.outboundDate = { not: null };
    where.returnDate = null;
  }
  // 'all' = no filter on dates

  // Status filter
  if (status !== "all") {
    where.status = status;
  }

  // Korda filters (OR logic if both specified)
  if (outboundKordaId || returnKordaId) {
    const kordaConditions = [];
    if (outboundKordaId) {
      kordaConditions.push({ outboundKordaId });
    }
    if (returnKordaId) {
      kordaConditions.push({ returnKordaId });
    }
    if (kordaConditions.length > 1) {
      where.OR = kordaConditions;
    } else {
      Object.assign(where, kordaConditions[0]);
    }
  }

  // Drop point filter (OR for outbound/return)
  if (dropPointId) {
    where.OR = where.OR || [];
    where.OR.push(
      { outboundDropPointId: dropPointId },
      { returnDropPointId: dropPointId },
    );
  }

  const studentConditions: Prisma.StudentWhereInput[] = [];
  const externalConditions: Prisma.ExternalParticipantWhereInput[] = [];
  if (gender) {
    studentConditions.push({ gender });
    externalConditions.push({ gender });
  }
  if (search?.trim()) {
    studentConditions.push({
      OR: [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { nis: { contains: search.trim(), mode: "insensitive" } },
      ],
    });
    externalConditions.push({
      OR: [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { address: { contains: search.trim(), mode: "insensitive" } },
      ],
    });
  }

  if (studentConditions.length) {
    const existingAnd = where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : [];
    where.AND = [
      ...existingAnd,
      {
        OR: [
          { student: { AND: studentConditions } },
          { externalParticipant: { AND: externalConditions } },
        ],
      },
    ];
  }

  const finalWhere = andWhere(where, registrationScopeWhere(scope));

  // Execute query with pagination
  const [data, total] = await Promise.all([
    prisma.registration.findMany({
      where: finalWhere,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            nis: true,
            gender: true,
          },
        },
        externalParticipant: { select: { id: true, name: true, gender: true, address: true } },
        outboundKorda: {
          select: { id: true, name: true },
        },
        outboundDropPoint: {
          select: { id: true, name: true, price: true },
        },
        outboundBus: {
          select: { id: true, label: true },
        },
        returnKorda: {
          select: { id: true, name: true },
        },
        returnDropPoint: {
          select: { id: true, name: true, price: true },
        },
        returnBus: {
          select: { id: true, label: true },
        },
        journeys: {
          where: journeyScope,
          select: { direction: true, tariffSnapshot: true, paymentAllocations: { where: { type: "JOURNEY" }, select: { amount: true, refunds: { select: { amount: true } }, corrections: { select: { amount: true } } } } },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.registration.count({ where: finalWhere }),
  ]);

  const visibleKordaIds = scope.role === "admin"
    ? null
    : new Set((await prisma.korda.findMany({
        where: scope.role === "korwil"
          ? { korwilId: scope.korwilId ?? "__NO_ACCESS__" }
          : { id: scope.kordaId ?? "__NO_ACCESS__" },
        select: { id: true },
      })).map((korda) => korda.id));

  return {
    data: data.map((registration) => ({
      ...registration,
      outboundPaymentStatus: (() => { if (visibleKordaIds && (!registration.outboundKordaId || !visibleKordaIds.has(registration.outboundKordaId))) return null; const journey = registration.journeys.find((row) => row.direction === "OUTBOUND"); if (!journey) return "UNPAID" as const; if (journey.tariffSnapshot == null) return "UNKNOWN" as const; const paid = journey.paymentAllocations.reduce((sum, row) => sum + row.amount - row.refunds.reduce((refundSum, refund) => refundSum + refund.amount, 0) - row.corrections.reduce((correctionSum, correction) => correctionSum + correction.amount, 0), 0); return paid <= 0 ? "UNPAID" as const : paid < journey.tariffSnapshot ? "PARTIAL" as const : "PAID" as const; })(),
      returnPaymentStatus: (() => { if (visibleKordaIds && (!registration.returnKordaId || !visibleKordaIds.has(registration.returnKordaId))) return null; const journey = registration.journeys.find((row) => row.direction === "RETURN"); if (!journey) return "UNPAID" as const; if (journey.tariffSnapshot == null) return "UNKNOWN" as const; const paid = journey.paymentAllocations.reduce((sum, row) => sum + row.amount - row.refunds.reduce((refundSum, refund) => refundSum + refund.amount, 0) - row.corrections.reduce((correctionSum, correction) => correctionSum + correction.amount, 0), 0); return paid <= 0 ? "UNPAID" as const : paid < journey.tariffSnapshot ? "PARTIAL" as const : "PAID" as const; })(),
      outboundPaid: (() => { const journey = registration.journeys.find((row) => row.direction === "OUTBOUND"); return journey?.tariffSnapshot != null && journey.paymentAllocations.reduce((sum, row) => sum + row.amount - row.refunds.reduce((refundSum, refund) => refundSum + refund.amount, 0) - row.corrections.reduce((correctionSum, correction) => correctionSum + correction.amount, 0), 0) >= journey.tariffSnapshot; })(),
      returnPaid: (() => { const journey = registration.journeys.find((row) => row.direction === "RETURN"); return journey?.tariffSnapshot != null && journey.paymentAllocations.reduce((sum, row) => sum + row.amount - row.refunds.reduce((refundSum, refund) => refundSum + refund.amount, 0) - row.corrections.reduce((correctionSum, correction) => correctionSum + correction.amount, 0), 0) >= journey.tariffSnapshot; })(),
      student: registration.student ?? {
        id: registration.externalParticipant?.id ?? "",
        name: registration.externalParticipant?.name ?? "Peserta eksternal",
        nis: null,
        gender: normalizeExternalParticipantGender(registration.externalParticipant?.gender),
        ttl: null,
      },
      ...(visibleKordaIds && (!registration.outboundKordaId || !visibleKordaIds.has(registration.outboundKordaId)) ? {
        outboundKordaId: null,
        outboundKorda: null, outboundDropPoint: null, outboundBus: null,
        outboundDate: null, outboundPaid: false,
      } : {}),
      ...(visibleKordaIds && (!registration.returnKordaId || !visibleKordaIds.has(registration.returnKordaId)) ? {
        returnKordaId: null,
        returnKorda: null, returnDropPoint: null, returnBus: null,
        returnDate: null, returnPaid: false,
      } : {}),
    })) as RegistrationWithDetails[],
    total,
  };
}

export interface RegistrationStats {
  total: number;
  byJourneyType: {
    both: number;
    returnOnly: number;
    outboundOnly: number;
  };
  byStatus: {
    confirmed: number;
    cancelled: number;
    partialCancel: number;
    draft: number;
  };
  paymentStats: {
    outboundPaidCount: number;
    returnPaidCount: number;
    totalPaidAmount: number;
  };
}

export async function getRegistrationStats(
  eventId: string,
): Promise<RegistrationStats> {
  const scope = await getRegionalAccessScope();
  const journeyScope: Prisma.JourneyWhereInput | undefined = scope.role === "admin" ? undefined : scope.role === "korwil" ? { destinationKorda: { korwilId: scope.korwilId ?? "__NO_ACCESS__" } } : { destinationKordaId: scope.kordaId ?? "__NO_ACCESS__" };
  const allRegistrations = await prisma.registration.findMany({
    where: andWhere({ eventId }, registrationScopeWhere(scope)),
    select: {
      outboundDate: true,
      returnDate: true,
      status: true,
      journeys: { where: journeyScope, select: { direction: true, tariffSnapshot: true, paymentAllocations: { where: { type: "JOURNEY" }, select: { amount: true, refunds: { select: { amount: true } }, corrections: { select: { amount: true } } } } } },
    },
  });

  const stats: RegistrationStats = {
    total: allRegistrations.length,
    byJourneyType: {
      both: 0,
      returnOnly: 0,
      outboundOnly: 0,
    },
    byStatus: {
      confirmed: 0,
      cancelled: 0,
      partialCancel: 0,
      draft: 0,
    },
    paymentStats: {
      outboundPaidCount: 0,
      returnPaidCount: 0,
      totalPaidAmount: 0,
    },
  };

  allRegistrations.forEach((reg) => {
    // Journey type
    const hasOutbound = reg.outboundDate != null;
    const hasReturn = reg.returnDate != null;
    if (hasOutbound && hasReturn) stats.byJourneyType.both++;
    else if (!hasOutbound && hasReturn) stats.byJourneyType.returnOnly++;
    else if (hasOutbound && !hasReturn) stats.byJourneyType.outboundOnly++;

    // Status
    if (reg.status === "CONFIRMED") stats.byStatus.confirmed++;
    else if (reg.status === "CANCELLED") stats.byStatus.cancelled++;
    else if (reg.status === "PARTIAL_CANCEL") stats.byStatus.partialCancel++;
    else if (reg.status === "DRAFT") stats.byStatus.draft++;

    // Payment
    for (const journey of reg.journeys) {
      const netPaid = journey.paymentAllocations.reduce((sum, row) => sum + row.amount - row.refunds.reduce((refundSum, refund) => refundSum + refund.amount, 0) - row.corrections.reduce((correctionSum, correction) => correctionSum + correction.amount, 0), 0);
      stats.paymentStats.totalPaidAmount += netPaid;
      if (journey.tariffSnapshot != null && netPaid >= journey.tariffSnapshot) {
        if (journey.direction === "OUTBOUND") stats.paymentStats.outboundPaidCount++;
        else stats.paymentStats.returnPaidCount++;
      }
    }
  });

  return stats;
}

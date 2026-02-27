import prisma from "@/lib/prisma";
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
  outboundKorda: { id: string; name: string } | null;
  outboundDropPoint: { id: string; name: string; price: number } | null;
  outboundDate: Date | null;
  outboundPaid: boolean;
  returnKorda: { id: string; name: string } | null;
  returnDropPoint: { id: string; name: string; price: number } | null;
  returnDate: Date | null;
  returnPaid: boolean;
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

  if (gender) {
    studentConditions.push({ gender });
  }

  // Student search (name or NIS)
  if (search?.trim()) {
    studentConditions.push({
      OR: [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { nis: { contains: search.trim(), mode: "insensitive" } },
      ],
    });
  }

  if (studentConditions.length === 1) {
    where.student = studentConditions[0];
  } else if (studentConditions.length > 1) {
    where.student = { AND: studentConditions };
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
            ttl: true,
          },
        },
        outboundKorda: {
          select: { id: true, name: true },
        },
        outboundDropPoint: {
          select: { id: true, name: true, price: true },
        },
        returnKorda: {
          select: { id: true, name: true },
        },
        returnDropPoint: {
          select: { id: true, name: true, price: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.registration.count({ where: finalWhere }),
  ]);

  return { data, total };
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
  const allRegistrations = await prisma.registration.findMany({
    where: andWhere({ eventId }, registrationScopeWhere(scope)),
    select: {
      outboundDate: true,
      returnDate: true,
      status: true,
      outboundPaid: true,
      returnPaid: true,
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
    if (reg.outboundPaid) stats.paymentStats.outboundPaidCount++;
    if (reg.returnPaid) stats.paymentStats.returnPaidCount++;
  });

  return stats;
}

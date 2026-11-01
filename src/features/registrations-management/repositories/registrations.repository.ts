import prisma from "@/lib/prisma";
import { normalizeExternalParticipantGender } from "@/features/santri/domain/external-participant";
import type { JourneyStatus, Prisma, RegistrationStatus } from "@/generated/prisma/client";
import {
  andWhere,
  getRegionalAccessScope,
  registrationScopeWhere,
} from "@/server/access-scope";

export interface RegistrationFilters {
  eventId: string;
  journeyType?: "both" | "return_only" | "outbound_only" | "all";
  status?: JourneyStatus | "all";
  paymentStatus?: JourneyPaymentStatus | "all";
  gender?: "Laki-laki" | "Perempuan";
  outboundKordaId?: string;
  returnKordaId?: string;
  dropPointId?: string;
  search?: string; // student name or NIS
  page?: number;
  pageSize?: number;
}

export type JourneyPaymentStatus = "PAID" | "PARTIAL" | "UNPAID" | "CANCELLED" | "UNKNOWN";

function getJourneyPaymentStatus(journey: {
  status: JourneyStatus;
  tariffSnapshot: number | null;
  paymentAllocations: Array<{ amount: number; refunds: Array<{ amount: number }>; corrections: Array<{ amount: number }> }>;
}): JourneyPaymentStatus {
  if (journey.status === "CANCELLED") return "CANCELLED";
  if (journey.tariffSnapshot == null) return "UNKNOWN";
  const netPaid = journey.paymentAllocations.reduce((sum, row) => sum + row.amount - row.refunds.reduce((value, refund) => value + refund.amount, 0) - row.corrections.reduce((value, correction) => value + correction.amount, 0), 0);
  if (netPaid >= journey.tariffSnapshot) return "PAID";
  return netPaid > 0 ? "PARTIAL" : "UNPAID";
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
  outboundPaymentStatus?: "UNPAID" | "PARTIAL" | "PAID" | "UNKNOWN" | "CANCELLED" | null;
  outboundJourneyStatus?: "REGISTERED" | "CANCELLED" | null;
  outboundTariffSnapshot: number | null;
  returnKorda: { id: string; name: string } | null;
  returnDropPoint: { id: string; name: string; price: number } | null;
  returnBus: { id: string; label: string } | null;
  returnDate: Date | null;
  returnPaid: boolean;
  returnPaymentStatus?: "UNPAID" | "PARTIAL" | "PAID" | "UNKNOWN" | "CANCELLED" | null;
  returnJourneyStatus?: "REGISTERED" | "CANCELLED" | null;
  returnTariffSnapshot: number | null;
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
  const { page = 1, pageSize = 20, paymentStatus = "all" } = filters;
  const journeyScope = getJourneyScope(scope);
  const finalWhere = andWhere(buildRegistrationWhere(filters, scope), registrationScopeWhere(scope));
  const registrationInclude = {
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
          select: { direction: true, status: true, destinationKordaId: true, destinationKordaNameSnapshot: true, dropPointId: true, locationNameSnapshot: true, travelDate: true, tariffSnapshot: true, busAssignment: { select: { bus: { select: { id: true, label: true } } } }, paymentAllocations: { where: { type: "JOURNEY" }, select: { amount: true, refunds: { select: { amount: true } }, corrections: { select: { amount: true } } } } },
        },
  } satisfies Prisma.RegistrationInclude;
  let data: Prisma.RegistrationGetPayload<{ include: typeof registrationInclude }>[];
  let total: number;

  if (paymentStatus === "all") {
    [data, total] = await Promise.all([
      prisma.registration.findMany({
        where: finalWhere,
        include: registrationInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.registration.count({ where: finalWhere }),
    ]);
  } else {
    const { journeyType = "all", status = "all", outboundKordaId, returnKordaId, dropPointId } = filters;
    const candidateRows = await prisma.registration.findMany({
      where: finalWhere,
      select: {
        id: true,
        journeys: { where: journeyScope, select: { direction: true, status: true, destinationKordaId: true, dropPointId: true, tariffSnapshot: true, paymentAllocations: { where: { type: "JOURNEY" }, select: { amount: true, refunds: { select: { amount: true } }, corrections: { select: { amount: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    const allowedDirections = journeyType === "outbound_only" ? ["OUTBOUND"]
      : journeyType === "return_only" ? ["RETURN"]
        : ["OUTBOUND", "RETURN"];
    const matchingIds = candidateRows.filter((registration) => registration.journeys.some((journey) => {
      if (!allowedDirections.includes(journey.direction)) return false;
      if (status !== "all" && journey.status !== status) return false;
      const selectedKordaId = journey.direction === "OUTBOUND" ? outboundKordaId : returnKordaId;
      if (selectedKordaId && journey.destinationKordaId !== selectedKordaId) return false;
      if (dropPointId && journey.dropPointId !== dropPointId) return false;
      return getJourneyPaymentStatus(journey) === paymentStatus;
    })).map((registration) => registration.id);
    total = matchingIds.length;
    const pageIds = matchingIds.slice((page - 1) * pageSize, page * pageSize);
    data = pageIds.length ? await prisma.registration.findMany({
      where: { id: { in: pageIds } },
      include: registrationInclude,
      orderBy: { createdAt: "desc" },
    }) : [];
  }

  const mappedData = data.map((registration) => {
      const out = registration.journeys.find((row) => row.direction === "OUTBOUND");
      const back = registration.journeys.find((row) => row.direction === "RETURN");
      const outboundPaymentStatus = out ? getJourneyPaymentStatus(out) : "UNPAID";
      const returnPaymentStatus = back ? getJourneyPaymentStatus(back) : "UNPAID";
      return ({
      ...registration,
      outboundKordaId: out?.destinationKordaId ?? null,
      outboundKorda: out ? { id: out.destinationKordaId, name: out.destinationKordaNameSnapshot } : null,
      outboundDropPoint: out ? { id: out.dropPointId ?? "", name: out.locationNameSnapshot, price: out.tariffSnapshot ?? 0 } : null,
      outboundBus: out?.busAssignment?.bus ?? null,
      outboundDate: out?.travelDate ?? null,
      outboundJourneyStatus: out?.status ?? null,
      outboundPaymentStatus,
      outboundPaid: outboundPaymentStatus === "PAID",
      outboundTariffSnapshot: out?.tariffSnapshot ?? null,
      returnKordaId: back?.destinationKordaId ?? null,
      returnKorda: back ? { id: back.destinationKordaId, name: back.destinationKordaNameSnapshot } : null,
      returnDropPoint: back ? { id: back.dropPointId ?? "", name: back.locationNameSnapshot, price: back.tariffSnapshot ?? 0 } : null,
      returnBus: back?.busAssignment?.bus ?? null,
      returnDate: back?.travelDate ?? null,
      returnJourneyStatus: back?.status ?? null,
      returnPaymentStatus,
      returnPaid: returnPaymentStatus === "PAID",
      returnTariffSnapshot: back?.tariffSnapshot ?? null,
      student: registration.student ?? {
        id: registration.externalParticipant?.id ?? "",
        name: registration.externalParticipant?.name ?? "Peserta eksternal",
        nis: null,
        gender: normalizeExternalParticipantGender(registration.externalParticipant?.gender),
        ttl: null,
      },
    }) as RegistrationWithDetails;
  });
  return {
    data: mappedData,
    total,
  };
}

export interface RegistrationStats {
  outbound: JourneyParticipantStats;
  return: JourneyParticipantStats;
}

function getJourneyScope(scope: Awaited<ReturnType<typeof getRegionalAccessScope>>): Prisma.JourneyWhereInput | undefined {
  if (scope.role === "admin") return undefined;
  if (scope.role === "korwil") return { destinationKorda: { korwilId: scope.korwilId ?? "__NO_ACCESS__" } };
  return { destinationKordaId: scope.kordaId ?? "__NO_ACCESS__" };
}

function buildRegistrationWhere(
  filters: RegistrationFilters,
  scope: Awaited<ReturnType<typeof getRegionalAccessScope>>,
): Prisma.RegistrationWhereInput {
  const { eventId, journeyType = "all", status = "all", gender, outboundKordaId, returnKordaId, dropPointId, search } = filters;
  const journeyScope = getJourneyScope(scope);
  const selectedStatus = status === "all" ? {} : { status };
  const journeyFor = (direction: "OUTBOUND" | "RETURN"): Prisma.JourneyWhereInput => ({
    ...(journeyScope ?? {}),
    direction,
    ...selectedStatus,
  });
  const conditions: Prisma.RegistrationWhereInput[] = [];

  if (journeyType === "both") {
    conditions.push({ journeys: { some: journeyFor("OUTBOUND") } }, { journeys: { some: journeyFor("RETURN") } });
  } else if (journeyType === "outbound_only") {
    conditions.push({ journeys: { some: journeyFor("OUTBOUND") } });
  } else if (journeyType === "return_only") {
    conditions.push({ journeys: { some: journeyFor("RETURN") } });
  } else {
    conditions.push({ journeys: { some: { ...(journeyScope ?? {}), ...selectedStatus } } });
  }

  const allowedDirections: Array<"OUTBOUND" | "RETURN"> = journeyType === "outbound_only" ? ["OUTBOUND"]
    : journeyType === "return_only" ? ["RETURN"]
      : ["OUTBOUND", "RETURN"];
  if (outboundKordaId || returnKordaId || dropPointId) {
    const routeConditions = allowedDirections.flatMap((direction) => {
      const destinationKordaId = direction === "OUTBOUND" ? outboundKordaId : returnKordaId;
      if ((outboundKordaId || returnKordaId) && !destinationKordaId && !dropPointId) return [];
      return [{ ...journeyFor(direction), ...(destinationKordaId ? { destinationKordaId } : {}), ...(dropPointId ? { dropPointId } : {}) }];
    });
    if (routeConditions.length) conditions.push({ journeys: { some: { OR: routeConditions } } });
  }

  const studentConditions: Prisma.StudentWhereInput[] = [];
  const externalConditions: Prisma.ExternalParticipantWhereInput[] = [];
  if (gender) {
    studentConditions.push({ gender });
    externalConditions.push({ gender });
  }
  if (search?.trim()) {
    studentConditions.push({ OR: [{ name: { contains: search.trim(), mode: "insensitive" } }, { nis: { contains: search.trim(), mode: "insensitive" } }] });
    externalConditions.push({ OR: [{ name: { contains: search.trim(), mode: "insensitive" } }, { address: { contains: search.trim(), mode: "insensitive" } }] });
  }
  if (studentConditions.length) {
    conditions.push({ OR: [{ student: { AND: studentConditions } }, { externalParticipant: { AND: externalConditions } }] });
  }

  return { eventId, AND: conditions };
}

export interface JourneyParticipantStats {
  total: number;
  paid: number;
  partial: number;
  unpaid: number;
  cancelled: number;
  unknownTariff: number;
}

export async function getRegistrationStats(
  filters: RegistrationFilters,
): Promise<RegistrationStats> {
  const scope = await getRegionalAccessScope();
  const journeyScope = getJourneyScope(scope);
  const allRegistrations = await prisma.registration.findMany({
    where: andWhere(buildRegistrationWhere(filters, scope), registrationScopeWhere(scope)),
    select: {
      journeys: { where: journeyScope, select: { direction: true, status: true, destinationKordaId: true, dropPointId: true, tariffSnapshot: true, paymentAllocations: { where: { type: "JOURNEY" }, select: { amount: true, refunds: { select: { amount: true } }, corrections: { select: { amount: true } } } } } },
    },
  });

  const stats: RegistrationStats = {
    outbound: { total: 0, paid: 0, partial: 0, unpaid: 0, cancelled: 0, unknownTariff: 0 },
    return: { total: 0, paid: 0, partial: 0, unpaid: 0, cancelled: 0, unknownTariff: 0 },
  };

  const { journeyType = "all", status = "all", paymentStatus = "all", outboundKordaId, returnKordaId, dropPointId } = filters;
  const allowedDirections = journeyType === "outbound_only" ? new Set(["OUTBOUND"])
    : journeyType === "return_only" ? new Set(["RETURN"])
      : new Set(["OUTBOUND", "RETURN"]);

  allRegistrations.forEach((reg) => {
    for (const journey of reg.journeys) {
      if (!allowedDirections.has(journey.direction)) continue;
      if (status !== "all" && journey.status !== status) continue;
      const selectedKordaId = journey.direction === "OUTBOUND" ? outboundKordaId : returnKordaId;
      if (selectedKordaId && journey.destinationKordaId !== selectedKordaId) continue;
      if (dropPointId && journey.dropPointId !== dropPointId) continue;
      if (paymentStatus !== "all" && getJourneyPaymentStatus(journey) !== paymentStatus) continue;
      const directionStats = journey.direction === "OUTBOUND" ? stats.outbound : stats.return;
      if (journey.status === "CANCELLED") {
        directionStats.cancelled++;
        continue;
      }
      directionStats.total++;
      if (journey.tariffSnapshot == null) {
        directionStats.unknownTariff++;
        continue;
      }
      const netPaid = journey.paymentAllocations.reduce((sum, row) => sum + row.amount - row.refunds.reduce((refundSum, refund) => refundSum + refund.amount, 0) - row.corrections.reduce((correctionSum, correction) => correctionSum + correction.amount, 0), 0);
      if (netPaid >= journey.tariffSnapshot) directionStats.paid++;
      else if (netPaid > 0) directionStats.partial++;
      else directionStats.unpaid++;
    }
  });

  return stats;
}

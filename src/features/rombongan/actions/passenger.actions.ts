"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logger } from "@/server/logger";
import type { Prisma } from "@/generated/prisma/client";
import { normalizeExternalParticipantGender } from "@/features/santri/domain/external-participant";
import { buildNumberedPrintRoster } from "@/features/registrations-management/lib/print-roster";
import {
  AccessDeniedError,
  andWhere,
  busScopeWhere,
  ensureKordaInScope,
  ensureKorwilInScope,
  getRegionalAccessScope,
  registrationScopeWhere,
} from "@/server/access-scope";
import { assertEventWritable } from "@/server/event-write-guard";
import { canSelectEvent } from "@/server/event-context";

export interface BusPassenger {
  registrationId: string;
  studentId: string;
  studentName: string;
  studentNis: string | null;
  studentGender: string;
  kordaName: string | null;
  dropPointName: string | null;
  dropPointPrice: number | null;
  journeyDate: Date | null;
  paid: boolean;
  assignmentChanged: boolean;
  previousBusLabel: string | null;
  assignmentHistory: Array<{
    action: "ASSIGNED" | "REASSIGNED" | "UNASSIGNED";
    fromBusLabel: string | null;
    toBusLabel: string | null;
    createdAt: Date;
  }>;
}

export interface AssignableRegistration {
  registrationId: string;
  studentId: string;
  studentName: string;
  studentNis: string | null;
  studentGender: string;
  kordaName: string | null;
  dropPointName: string | null;
  journeyDate: Date | null;
}

export interface BusAttendancePassenger {
  registrationId: string;
  rosterNumber: number;
  studentName: string;
  studentNis: string | null;
  studentGender: string;
  kabKota: string | null;
  dropPointName: string | null;
  kordaName: string;
}

export interface BusAttendanceManifest {
  busId: string;
  busLabel: string;
  busCapacity: number;
  dataUpdatedAt: Date;
  korwilName: string | null;
  kordaNames: string[];
  passengers: BusAttendancePassenger[];
}

export interface UnassignedJourneyRow {
  journeyId: string;
  registrationId: string;
  direction: "OUTBOUND" | "RETURN";
  participantName: string;
  participantNis: string | null;
  destinationKordaId: string;
  destinationKordaName: string;
  dropPointName: string;
  journeyDate: Date | null;
}

type UnassignedJourneyFilters = {
  eventId: string;
  korwilId?: string;
  kordaId?: string;
};

function unassignedJourneyWhere(
  scope: Awaited<ReturnType<typeof getRegionalAccessScope>>,
  filters: UnassignedJourneyFilters,
  direction?: "OUTBOUND" | "RETURN",
): Prisma.JourneyWhereInput {
  const destinationClauses: Prisma.JourneyWhereInput[] = [];
  if (scope.role === "korwil") {
    destinationClauses.push({ destinationKorda: { korwilId: scope.korwilId ?? "__NO_ACCESS__" } });
  } else if (scope.role === "korda") {
    destinationClauses.push({ destinationKordaId: scope.kordaId ?? "__NO_ACCESS__" });
  }
  if (filters.korwilId) destinationClauses.push({ destinationKorda: { korwilId: filters.korwilId } });
  if (filters.kordaId) destinationClauses.push({ destinationKordaId: filters.kordaId });

  return {
    AND: [
      {
        direction,
        status: "REGISTERED",
        registration: {
          eventId: filters.eventId,
          status: { not: "CANCELLED" },
          ...(registrationScopeWhere(scope) ? { AND: [registrationScopeWhere(scope)!] } : {}),
        },
        OR: [{ busAssignment: null }, { busAssignment: { busId: null } }],
      },
      ...destinationClauses,
    ],
  };
}

async function validateUnassignedJourneyFilters(
  scope: Awaited<ReturnType<typeof getRegionalAccessScope>>,
  filters: UnassignedJourneyFilters,
) {
  if (!filters.eventId || !(await canSelectEvent(scope, filters.eventId))) {
    throw new AccessDeniedError("Event tidak ditemukan atau di luar cakupan akses.");
  }
  if (filters.korwilId) await ensureKorwilInScope(scope, filters.korwilId);
  if (filters.kordaId) await ensureKordaInScope(scope, filters.kordaId);
}

/** Counts registered, unassigned journeys by direction in the exact event and destination scope. */
export async function getUnassignedJourneyCounts(filters: UnassignedJourneyFilters) {
  try {
    const scope = await getRegionalAccessScope();
    await validateUnassignedJourneyFilters(scope, filters);
    const [outbound, returning] = await Promise.all([
      prisma.journey.count({ where: unassignedJourneyWhere(scope, filters, "OUTBOUND") }),
      prisma.journey.count({ where: unassignedJourneyWhere(scope, filters, "RETURN") }),
    ]);
    return { outbound, returning };
  } catch (error) {
    if (error instanceof AccessDeniedError) throw new Error(error.message);
    logger.error({ error, filters }, "passenger.getUnassignedJourneyCounts.failed");
    throw new Error(error instanceof Error ? error.message : "Gagal memuat jumlah perjalanan tanpa armada.");
  }
}

/** Lists registered, unassigned journeys for the follow-up dialog. */
export async function getUnassignedJourneys(
  filters: UnassignedJourneyFilters & { direction: "OUTBOUND" | "RETURN"; page?: number },
) {
  try {
    const scope = await getRegionalAccessScope();
    await validateUnassignedJourneyFilters(scope, filters);
    const pageSize = 25;
    const page = Math.max(1, Number.isSafeInteger(filters.page) ? filters.page! : 1);
    const where = unassignedJourneyWhere(scope, filters, filters.direction);
    const [rows, total] = await Promise.all([
      prisma.journey.findMany({
        where,
        select: {
          id: true,
          direction: true,
          locationNameSnapshot: true,
          travelDate: true,
          destinationKordaId: true,
          destinationKorda: { select: { name: true } },
          registration: {
            select: {
              id: true,
              student: { select: { name: true, nis: true } },
              externalParticipant: { select: { name: true } },
            },
          },
        },
        orderBy: [
          { destinationKorda: { name: "asc" } },
          { registration: { student: { name: "asc" } } },
          { registration: { externalParticipant: { name: "asc" } } },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.journey.count({ where }),
    ]);
    const journeys: UnassignedJourneyRow[] = rows.map((row) => ({
      journeyId: row.id,
      registrationId: row.registration.id,
      direction: row.direction,
      participantName: row.registration.student?.name ?? row.registration.externalParticipant?.name ?? "Peserta eksternal",
      participantNis: row.registration.student?.nis ?? null,
      destinationKordaId: row.destinationKordaId,
      destinationKordaName: row.destinationKorda.name,
      dropPointName: row.locationNameSnapshot,
      journeyDate: row.travelDate,
    }));
    return { journeys, total, page, pageSize };
  } catch (error) {
    if (error instanceof AccessDeniedError) throw new Error(error.message);
    logger.error({ error, filters }, "passenger.getUnassignedJourneys.failed");
    throw new Error(error instanceof Error ? error.message : "Gagal memuat daftar perjalanan tanpa armada.");
  }
}

/**
 * Get passengers already assigned to a bus for a specific journey
 */
export async function getBusPassengers(
  busId: string,
  journey: "outbound" | "return",
): Promise<BusPassenger[]> {
  try {
    const scope = await getRegionalAccessScope();
    const canAccessBus = await prisma.bus.count({
      where: andWhere({ id: busId }, busScopeWhere(scope)),
    });
    if (!canAccessBus) {
      throw new AccessDeniedError("Bus di luar cakupan akses");
    }

    const assignments = await prisma.journeyBusAssignment.findMany({
      where: {
        busId,
        journey: {
          direction: journey === "outbound" ? "OUTBOUND" : "RETURN",
          status: "REGISTERED",
          registration: registrationScopeWhere(scope),
        },
      },
      include: {
        journey: {
          include: {
            destinationKorda: { select: { name: true } },
            registration: {
              include: {
                student: { select: { id: true, name: true, nis: true, gender: true } },
                externalParticipant: { select: { id: true, name: true, gender: true } },
              },
            },
          },
        },
        history: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { journey: { registration: { student: { name: "asc" } } } },
    });
    return assignments.map((assignment) => {
      const r = assignment.journey.registration;
      return {
        registrationId: r.id,
        studentId: r.student?.id ?? r.externalParticipant?.id ?? "",
        studentName: r.student?.name ?? r.externalParticipant?.name ?? "Peserta eksternal",
        studentNis: r.student?.nis ?? null,
        studentGender: r.student?.gender ?? normalizeExternalParticipantGender(r.externalParticipant?.gender) ?? "-",
        kordaName: assignment.journey.destinationKorda.name,
        dropPointName: assignment.journey.locationNameSnapshot,
        dropPointPrice: assignment.journey.tariffSnapshot,
        journeyDate: assignment.journey.travelDate,
        paid: journey === "outbound" ? r.outboundPaid : r.returnPaid,
        assignmentChanged: assignment.changedAt !== null,
        previousBusLabel: assignment.previousBusLabelSnapshot,
        assignmentHistory: assignment.history.map((item) => ({
          action: item.action,
          fromBusLabel: item.fromBusLabelSnapshot,
          toBusLabel: item.toBusLabelSnapshot,
          createdAt: item.createdAt,
        })),
      };
    });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      throw new Error(error.message);
    }
    logger.error(
      { error, busId, journey },
      "passenger.getBusPassengers.failed",
    );
    throw new Error("Gagal memuat daftar peserta bus");
  }
}

/**
 * Get bus attendance manifest grouped by bus for a specific journey.
 * This is used for printable attendance sheets.
 */
export async function getBusAttendanceManifest(params: {
  eventId: string;
  journey: "outbound" | "return";
  korwilId?: string;
  kordaId?: string;
}): Promise<BusAttendanceManifest[]> {
  try {
    const scope = await getRegionalAccessScope();
    if (!params.eventId) throw new Error("Event wajib dipilih.");
    if (!(await canSelectEvent(scope, params.eventId))) throw new AccessDeniedError("Event di luar cakupan akses.");
    if (params.korwilId) {
      ensureKorwilInScope(scope, params.korwilId);
    }
    if (params.kordaId) {
      await ensureKordaInScope(scope, params.kordaId);
    }

    const assignments = await prisma.journeyBusAssignment.findMany({
      where: {
        busId: { not: null },
        bus: { is: andWhere({ eventId: params.eventId }, busScopeWhere(scope)) },
        journey: {
          direction: params.journey === "outbound" ? "OUTBOUND" : "RETURN",
          status: "REGISTERED",
          registration: { eventId: params.eventId, status: { not: "CANCELLED" } },
          ...(scope.role === "korda"
            ? { destinationKordaId: scope.kordaId ?? "__NO_ACCESS__" }
            : scope.role === "korwil"
              ? { destinationKorda: { korwilId: scope.korwilId ?? "__NO_ACCESS__" } }
              : {}),
        },
      },
      select: {
        updatedAt: true,
        bus: {
          select: {
            id: true,
            label: true,
            capacity: true,
            updatedAt: true,
            korwil: { select: { name: true } },
          },
        },
        journey: {
          select: {
            id: true,
            destinationKordaId: true,
            destinationKorda: { select: { name: true, korwilId: true, korwil: { select: { name: true } } } },
            locationNameSnapshot: true,
            updatedAt: true,
            registration: {
              select: {
                id: true,
                student: { select: { name: true, nis: true, gender: true, regency: { select: { name: true, label: true } } } },
                externalParticipant: { select: { name: true, gender: true } },
              },
            },
          },
        },
      },
    });

    const completeRoster = buildNumberedPrintRoster(assignments.flatMap((assignment) => {
      const bus = assignment.bus;
      if (!bus) return [];
      const journey = assignment.journey;
      const registration = journey.registration;
      const student = registration.student;
      const name = student?.name ?? registration.externalParticipant?.name ?? "Peserta eksternal";
      return [{
        id: journey.id,
        participantName: name,
        destinationKordaId: journey.destinationKordaId,
        destinationKordaName: journey.destinationKorda.name,
        destinationKorwilId: journey.destinationKorda.korwilId,
        korwilName: journey.destinationKorda.korwil?.name ?? null,
        busId: bus.id,
        busLabel: bus.label,
        dropPointId: null,
        dropPointName: journey.locationNameSnapshot,
        studentNis: student?.nis ?? null,
        registrationId: registration.id,
        studentName: name,
        studentGender: student?.gender ?? normalizeExternalParticipantGender(registration.externalParticipant?.gender) ?? "-",
        kabKota: student?.regency?.label ?? student?.regency?.name ?? null,
        busCapacity: bus.capacity,
        busUpdatedAt: bus.updatedAt,
        assignmentUpdatedAt: assignment.updatedAt,
        journeyUpdatedAt: journey.updatedAt,
        busKorwilName: bus.korwil?.name ?? null,
      }];
    }));

    const visibleRoster = completeRoster.filter((entry) =>
      (!params.kordaId || entry.destinationKordaId === params.kordaId) &&
      (!params.korwilId || entry.destinationKorwilId === params.korwilId),
    );
    const assignmentsByJourneyId = new Map(assignments.map((assignment) => [assignment.journey.id, assignment]));
    const manifestsByBusId = new Map<string, BusAttendanceManifest & { firstIndex: number }>();
    visibleRoster.forEach((entry, index) => {
      const assignment = assignmentsByJourneyId.get(entry.id);
      const bus = assignment?.bus;
      if (!bus) return;
      const latestUpdate = [entry.busUpdatedAt, entry.assignmentUpdatedAt, entry.journeyUpdatedAt]
        .reduce((latest, candidate) => candidate > latest ? candidate : latest, entry.busUpdatedAt);
      let manifest = manifestsByBusId.get(bus.id);
      if (!manifest) {
        manifest = {
          busId: bus.id,
          busLabel: bus.label,
          busCapacity: entry.busCapacity,
          dataUpdatedAt: latestUpdate,
          korwilName: entry.busKorwilName,
          kordaNames: [],
          passengers: [],
          firstIndex: index,
        };
        manifestsByBusId.set(bus.id, manifest);
      }
      if (latestUpdate > manifest.dataUpdatedAt) manifest.dataUpdatedAt = latestUpdate;
      if (!manifest.kordaNames.includes(entry.destinationKordaName)) manifest.kordaNames.push(entry.destinationKordaName);
      manifest.passengers.push({
        registrationId: entry.registrationId,
        rosterNumber: entry.rosterNumber,
        studentName: entry.studentName,
        studentNis: entry.studentNis,
        studentGender: entry.studentGender,
        kabKota: entry.kabKota,
        dropPointName: entry.dropPointName,
        kordaName: entry.destinationKordaName,
      });
    });

    return Array.from(manifestsByBusId.values())
      .sort((left, right) => left.firstIndex - right.firstIndex)
      .map((manifest) => ({
        busId: manifest.busId,
        busLabel: manifest.busLabel,
        busCapacity: manifest.busCapacity,
        dataUpdatedAt: manifest.dataUpdatedAt,
        korwilName: manifest.korwilName,
        kordaNames: manifest.kordaNames,
        passengers: manifest.passengers,
      }));
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      throw new Error(error.message);
    }
    logger.error({ error, params }, "passenger.getBusAttendanceManifest.failed");
    throw new Error("Gagal memuat data absensi bus");
  }
}

/**
 * Get registrations that can be assigned to this bus for a specific journey.
 * Filters: same event, korda matches one of bus's kordas, not yet assigned to any bus.
 */
export async function getAssignableRegistrations(
  busId: string,
  journey: "outbound" | "return",
  search?: string,
): Promise<AssignableRegistration[]> {
  try {
    const scope = await getRegionalAccessScope();
    // Get bus info and allowed kordas
    const bus = await prisma.bus.findFirst({
      where: andWhere({ id: busId }, busScopeWhere(scope)),
      select: {
        eventId: true,
        kordas: {
          select: {
            kordaId: true,
          },
        },
      },
    });
    if (!bus) throw new Error("Bus tidak ditemukan");
    const busKordaIds = bus.kordas.map((item) => item.kordaId);
    if (busKordaIds.length === 0) {
      return [];
    }

    const normalizedSearch = search?.trim();
    const searchFilter = normalizedSearch
      ? {
          OR: [
            { name: { contains: normalizedSearch, mode: "insensitive" as const } },
            { nis: { contains: normalizedSearch, mode: "insensitive" as const } },
          ],
        }
      : undefined;

    const journeys = await prisma.journey.findMany({
      where: andWhere(
        {
          direction: journey === "outbound" ? "OUTBOUND" : "RETURN",
          status: "REGISTERED",
          destinationKordaId: { in: busKordaIds },
          OR: [{ busAssignment: null }, { busAssignment: { busId: null } }],
          registration: {
            eventId: bus.eventId,
            ...(normalizedSearch && { OR: [
              { student: searchFilter },
              { externalParticipant: { name: { contains: normalizedSearch, mode: "insensitive" as const } } },
            ] }),
          },
        },
        { registration: registrationScopeWhere(scope) },
      ),
      include: {
        destinationKorda: { select: { name: true } },
        registration: {
          include: {
            student: { select: { id: true, name: true, nis: true, gender: true } },
            externalParticipant: { select: { id: true, name: true, gender: true } },
          },
        },
      },
      orderBy: { registration: { student: { name: "asc" } } },
    });
    return journeys.map((item) => ({
      registrationId: item.registration.id,
      studentId: item.registration.student?.id ?? item.registration.externalParticipant?.id ?? "",
      studentName: item.registration.student?.name ?? item.registration.externalParticipant?.name ?? "Peserta eksternal",
      studentNis: item.registration.student?.nis ?? null,
      studentGender: item.registration.student?.gender ?? normalizeExternalParticipantGender(item.registration.externalParticipant?.gender) ?? "-",
      kordaName: item.destinationKorda.name,
      dropPointName: item.locationNameSnapshot,
      journeyDate: item.travelDate,
    }));
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      throw new Error(error.message);
    }
    logger.error({ error, busId, journey }, "passenger.getAssignable.failed");
    throw new Error("Gagal memuat daftar peserta yang bisa di-assign");
  }
}

/**
 * Assign a registration to a bus for a specific journey
 */
export async function assignToBus(
  registrationId: string,
  busId: string,
  journey: "outbound" | "return",
): Promise<void> {
  try {
    const scope = await getRegionalAccessScope();
    const [bus, journeyRecord] = await Promise.all([
      prisma.bus.findFirst({
        where: andWhere({ id: busId }, busScopeWhere(scope)),
        select: {
          id: true,
          label: true,
          eventId: true,
          capacity: true,
          kordas: {
            select: {
              kordaId: true,
            },
          },
        },
      }),
      prisma.journey.findFirst({
        where: {
          registrationId,
          direction: journey === "outbound" ? "OUTBOUND" : "RETURN",
          status: "REGISTERED",
          registration: registrationScopeWhere(scope),
        },
        include: {
          registration: { select: { eventId: true } },
          busAssignment: { include: { bus: { select: { label: true } } } },
        },
      }),
    ]);

    if (!bus) {
      throw new AccessDeniedError("Bus di luar cakupan akses");
    }
    if (!journeyRecord) {
      throw new AccessDeniedError("Registrasi di luar cakupan akses");
    }
    if (journeyRecord.registration.eventId !== bus.eventId) {
      throw new Error("Registrasi tidak sesuai event bus");
    }
    const busKordaIds = bus.kordas.map((item) => item.kordaId);
    if (busKordaIds.length === 0) {
      throw new Error("Bus belum memiliki korda. Tambahkan korda pada bus terlebih dahulu.");
    }
    if (!busKordaIds.includes(journeyRecord.destinationKordaId)) {
      throw new Error("Korda peserta tidak sesuai dengan korda bus.");
    }
    await ensureKordaInScope(scope, journeyRecord.destinationKordaId);
    if (bus.capacity < 1) throw new Error("Kapasitas bus belum valid. Admin/Korwil harus mengisi kapasitas kursi terlebih dahulu.");

    await prisma.$transaction(async (tx) => {
      await assertEventWritable(tx, bus.eventId);
      await tx.$queryRaw`SELECT "id" FROM "Bus" WHERE "id" = ${busId} FOR UPDATE`;
      const current = await tx.journeyBusAssignment.findUnique({
        where: { journeyId: journeyRecord.id },
        include: { bus: { select: { label: true } } },
      });
      if (current?.busId === busId) return;
      const occupied = await tx.journeyBusAssignment.count({
        where: {
          busId,
          journey: {
            status: "REGISTERED",
            direction: journeyRecord.direction,
          },
        },
      });
      if (occupied >= bus.capacity) {
        throw new Error(`Kapasitas bus penuh (${occupied}/${bus.capacity} kursi)`);
      }
      const changed = Boolean(current?.busId && current.busId !== busId);
      const previousBusLabelSnapshot = changed
        ? current?.bus?.label ?? null
        : current?.previousBusLabelSnapshot ?? null;
      const assignment = await tx.journeyBusAssignment.upsert({
        where: { journeyId: journeyRecord.id },
        create: { journeyId: journeyRecord.id, busId },
        update: {
          busId,
          ...(changed ? { previousBusLabelSnapshot, changedAt: new Date(), changedByUserId: scope.userId } : {}),
        },
      });
      await tx.journeyBusAssignmentHistory.create({
        data: {
          assignmentId: assignment.id,
          action: current ? "REASSIGNED" : "ASSIGNED",
          fromBusLabelSnapshot: current?.bus?.label ?? current?.previousBusLabelSnapshot ?? null,
          toBusLabelSnapshot: bus.label,
          actorUserId: scope.userId,
        },
      });
      await tx.registration.update({
        where: { id: registrationId },
        data: journey === "outbound" ? { outboundBusId: busId } : { returnBusId: busId },
      });
    });
    logger.info({ registrationId, busId, journey }, "passenger.assigned");
    revalidatePath("/rombongan");
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      throw new Error(error.message);
    }
    logger.error(
      { error, registrationId, busId, journey },
      "passenger.assign.failed",
    );
    throw error instanceof Error ? error : new Error("Gagal assign peserta ke bus");
  }
}

/**
 * Unassign a registration from a bus for a specific journey
 */
export async function unassignFromBus(
  registrationId: string,
  journey: "outbound" | "return",
): Promise<void> {
  try {
    const scope = await getRegionalAccessScope();
    const existing = await prisma.journey.findFirst({
      where: {
        registrationId,
        direction: journey === "outbound" ? "OUTBOUND" : "RETURN",
        status: "REGISTERED",
        registration: registrationScopeWhere(scope),
        busAssignment: { bus: busScopeWhere(scope) },
      },
      include: { registration: { select: { eventId: true } }, busAssignment: { include: { bus: { select: { label: true } } } } },
    });
    if (!existing) {
      throw new AccessDeniedError("Registrasi di luar cakupan akses");
    }

    await ensureKordaInScope(scope, existing.destinationKordaId);
    const existingAssignment = existing.busAssignment;
    if (existingAssignment?.busId) {
      await prisma.$transaction(async (tx) => {
        await assertEventWritable(tx, existing.registration.eventId);
        await tx.journeyBusAssignment.update({
          where: { journeyId: existing.id },
          data: {
            busId: null,
            previousBusLabelSnapshot: existingAssignment.bus?.label ?? null,
            changedAt: new Date(),
            changedByUserId: scope.userId,
          },
        });
        await tx.journeyBusAssignmentHistory.create({
          data: {
            assignmentId: existingAssignment.id,
            action: "UNASSIGNED",
            fromBusLabelSnapshot: existingAssignment.bus?.label ?? null,
            actorUserId: scope.userId,
          },
        });
        await tx.registration.update({
          where: { id: registrationId },
          data: journey === "outbound" ? { outboundBusId: null } : { returnBusId: null },
        });
      });
    }
    logger.info({ registrationId, journey }, "passenger.unassigned");
    revalidatePath("/rombongan");
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      throw new Error(error.message);
    }
    logger.error(
      { error, registrationId, journey },
      "passenger.unassign.failed",
    );
    throw error instanceof Error ? error : new Error("Gagal hapus peserta dari bus");
  }
}

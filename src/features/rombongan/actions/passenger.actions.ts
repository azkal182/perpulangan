"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logger } from "@/server/logger";
import { normalizeExternalParticipantGender } from "@/features/santri/domain/external-participant";
import {
  AccessDeniedError,
  andWhere,
  busScopeWhere,
  ensureKordaInScope,
  ensureKorwilInScope,
  getRegionalAccessScope,
  registrationScopeWhere,
} from "@/server/access-scope";

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
  studentName: string;
  studentNis: string | null;
  studentGender: string;
  kabKota: string | null;
  dropPointName: string | null;
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

function normalizeSortValue(
  value: string | null | undefined,
  options?: { nullLast?: boolean },
): string {
  const normalized = value?.trim().toLocaleLowerCase("id-ID");
  if (normalized && normalized.length > 0) {
    return normalized;
  }
  return options?.nullLast === false ? "" : "\uffff";
}

function compareSortValue(
  left: string | null | undefined,
  right: string | null | undefined,
  options?: { nullLast?: boolean },
): number {
  return normalizeSortValue(left, options).localeCompare(
    normalizeSortValue(right, options),
    "id",
    { sensitivity: "base", numeric: true },
  );
}

function sortBusAttendancePassengers(
  passengers: BusAttendancePassenger[],
): BusAttendancePassenger[] {
  return [...passengers].sort((a, b) => {
    const dropPointCompare = compareSortValue(a.dropPointName, b.dropPointName);
    if (dropPointCompare !== 0) {
      return dropPointCompare;
    }

    const nameCompare = compareSortValue(a.studentName, b.studentName, {
      nullLast: false,
    });
    if (nameCompare !== 0) {
      return nameCompare;
    }

    return compareSortValue(a.studentNis, b.studentNis);
  });
}

function sortBusAttendanceManifest(
  manifests: BusAttendanceManifest[],
): BusAttendanceManifest[] {
  return [...manifests].sort((a, b) => {
    const korwilCompare = compareSortValue(a.korwilName, b.korwilName);
    if (korwilCompare !== 0) {
      return korwilCompare;
    }

    const kordaA = a.kordaNames[0] ?? null;
    const kordaB = b.kordaNames[0] ?? null;
    const kordaCompare = compareSortValue(kordaA, kordaB);
    if (kordaCompare !== 0) {
      return kordaCompare;
    }

    return compareSortValue(a.busLabel, b.busLabel, { nullLast: false });
  });
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
    if (params.korwilId) {
      ensureKorwilInScope(scope, params.korwilId);
    }
    if (params.kordaId) {
      await ensureKordaInScope(scope, params.kordaId);
    }

    const buses = await prisma.bus.findMany({
      where: andWhere(
        {
          eventId: params.eventId,
          ...(params.korwilId && { korwilId: params.korwilId }),
          ...(params.kordaId && {
            kordas: {
              some: {
                kordaId: params.kordaId,
              },
            },
          }),
        },
        busScopeWhere(scope),
      ),
      select: {
        id: true,
        label: true,
        capacity: true,
        updatedAt: true,
        korwil: { select: { name: true } },
        kordas: {
          select: {
            kordaId: true,
            korda: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            korda: { name: "asc" },
          },
        },
      },
      orderBy: { label: "asc" },
    });
    const busIds = buses.map((bus) => bus.id);
    const registrationAccessWhere = registrationScopeWhere(scope);
    const assignments = busIds.length
      ? await prisma.journeyBusAssignment.findMany({
          where: {
            busId: { in: busIds },
            journey: {
              direction: params.journey === "outbound" ? "OUTBOUND" : "RETURN",
              status: "REGISTERED",
              registration: {
                eventId: params.eventId,
                ...(registrationAccessWhere ? { AND: [registrationAccessWhere] } : {}),
              },
            },
          },
          include: {
            bus: { select: { id: true } },
            journey: {
              include: {
                destinationKorda: { select: { name: true } },
                registration: {
                  include: {
                    student: { select: { name: true, nis: true, gender: true, regency: { select: { name: true, label: true } } } },
                    externalParticipant: { select: { name: true, gender: true } },
                  },
                },
              },
            },
          },
        })
      : [];
    const assignmentsByBusId = new Map<string, typeof assignments>();
    for (const assignment of assignments) {
      if (!assignment.busId || !assignment.bus) continue;
      const current = assignmentsByBusId.get(assignment.busId) ?? [];
      current.push(assignment);
      assignmentsByBusId.set(assignment.busId, current);
    }
    const manifests = buses.map((bus) => {
      const allowedKordaIds = new Set(bus.kordas.map((item) => item.kordaId));
      const busAssignments = assignmentsByBusId.get(bus.id) ?? [];
      const latestUpdate = busAssignments.reduce((latest, assignment) => {
        const candidate = assignment.updatedAt > assignment.journey.updatedAt ? assignment.updatedAt : assignment.journey.updatedAt;
        return candidate > latest ? candidate : latest;
      }, bus.updatedAt);
      const passengers = busAssignments
        .filter((assignment) => allowedKordaIds.has(assignment.journey.destinationKordaId))
        .map((assignment) => {
          const registration = assignment.journey.registration;
          return {
            registrationId: registration.id,
            studentName: registration.student?.name ?? registration.externalParticipant?.name ?? "Peserta eksternal",
            studentNis: registration.student?.nis ?? null,
            studentGender: registration.student?.gender ?? normalizeExternalParticipantGender(registration.externalParticipant?.gender) ?? "-",
            kabKota: registration.student?.regency?.label ?? registration.student?.regency?.name ?? null,
            dropPointName: assignment.journey.locationNameSnapshot,
          };
        });
      return {
        busId: bus.id,
        busLabel: bus.label,
        busCapacity: bus.capacity,
        dataUpdatedAt: latestUpdate,
        korwilName: bus.korwil?.name ?? null,
        kordaNames: bus.kordas.map((item) => item.korda.name),
        passengers: sortBusAttendancePassengers(passengers),
      };
    });
    return sortBusAttendanceManifest(manifests);
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
    throw new Error("Gagal assign peserta ke bus");
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
      include: { busAssignment: { include: { bus: { select: { label: true } } } } },
    });
    if (!existing) {
      throw new AccessDeniedError("Registrasi di luar cakupan akses");
    }

    await ensureKordaInScope(scope, existing.destinationKordaId);
    const existingAssignment = existing.busAssignment;
    if (existingAssignment?.busId) {
      await prisma.$transaction(async (tx) => {
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
    throw new Error("Gagal hapus peserta dari bus");
  }
}

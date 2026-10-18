"use server";

import { revalidatePath } from "next/cache";
import {
  OutboundDispositionReason,
  OutboundDispositionStatus,
  Prisma,
} from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/server/logger";
import {
  AccessDeniedError,
  andWhere,
  getRegionalAccessScope,
  requireAdmin,
  studentScopeWhere,
} from "@/server/access-scope";

const reasonLabels: Record<OutboundDispositionReason, string> = {
  WISUDA: "Wisuda",
  PARTISIPAN: "Partisipan",
  SEDANG_PULANG: "Sedang Pulang",
};

function normalizeSearch(value: string | undefined) {
  return value?.trim().slice(0, 100) ?? "";
}

function studentSearchWhere(query: string): Prisma.StudentWhereInput | undefined {
  if (!query) return undefined;
  return {
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { nis: { contains: query, mode: "insensitive" } },
    ],
  };
}

export async function getOutboundRoster(eventId: string, search?: string, requestedPage = 1) {
  try {
    const scope = await getRegionalAccessScope();
    if (!eventId) return { success: false as const, error: "Pilih event terlebih dahulu." };
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, name: true, status: true } });
    if (!event) return { success: false as const, error: "Event tidak ditemukan." };

    const query = normalizeSearch(search);
    const pageSize = 50;
    const page = Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1;
    const skip = (page - 1) * pageSize;
    const scopedStudentWhere = andWhere<Prisma.StudentWhereInput>(
      { status: true },
      studentScopeWhere(scope),
      studentSearchWhere(query),
    );

    const candidateWhere = andWhere<Prisma.StudentWhereInput>(scopedStudentWhere, {
      registrations: { none: { eventId, status: { not: "CANCELLED" }, journeys: { some: { direction: "OUTBOUND", status: "REGISTERED" } } } },
      outboundDispositions: { none: { eventId, status: "ACTIVE" } },
    });
    const excludedWhere: Prisma.OutboundDispositionWhereInput = { eventId, status: "ACTIVE", student: scopedStudentWhere };
    const registeredWhere: Prisma.JourneyWhereInput = { direction: "OUTBOUND", status: "REGISTERED", registration: { eventId, status: { not: "CANCELLED" }, student: { is: scopedStudentWhere } } };
    const [candidates, excluded, registered, historyRows, candidateCount, excludedCount, registeredCount, historyCount] = await Promise.all([
      prisma.student.findMany({
        where: candidateWhere,
        select: { id: true, name: true, nis: true, dormitory: true, regency: { select: { name: true, korda: { select: { name: true } } } } },
        orderBy: [{ name: "asc" }, { nis: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.outboundDisposition.findMany({
        where: { eventId, status: "ACTIVE", student: scopedStudentWhere },
        select: { id: true, reason: true, createdAt: true, updatedAt: true, student: { select: { id: true, name: true, nis: true, dormitory: true, regency: { select: { name: true, korda: { select: { name: true } } } } } }, history: { select: { fromReason: true, toReason: true, fromStatus: true, toStatus: true, actorUserId: true, createdAt: true }, orderBy: { createdAt: "desc" } } },
        orderBy: [{ student: { name: "asc" } }],
        skip,
        take: pageSize,
      }),
      prisma.journey.findMany({
        where: registeredWhere,
        select: { id: true, destinationKordaNameSnapshot: true, locationNameSnapshot: true, registration: { select: { student: { select: { id: true, name: true, nis: true, dormitory: true, regency: { select: { name: true, korda: { select: { name: true } } } } } } } } },
        orderBy: [{ registration: { student: { name: "asc" } } }],
        skip,
        take: pageSize,
      }),
      prisma.outboundDisposition.findMany({
        where: { eventId, student: scopedStudentWhere },
        select: { id: true, reason: true, status: true, createdAt: true, updatedAt: true, student: { select: { id: true, name: true, nis: true, dormitory: true, regency: { select: { name: true, korda: { select: { name: true } } } } } }, history: { select: { fromReason: true, toReason: true, fromStatus: true, toStatus: true, actorUserId: true, createdAt: true }, orderBy: { createdAt: "desc" } } },
        orderBy: [{ updatedAt: "desc" }],
        skip,
        take: pageSize,
      }),
      prisma.student.count({ where: candidateWhere }),
      prisma.outboundDisposition.count({ where: excludedWhere }),
      prisma.journey.count({ where: registeredWhere }),
      prisma.outboundDisposition.count({ where: { eventId, student: scopedStudentWhere } }),
    ]);

    const actorIds = [...new Set(historyRows.flatMap((row) => row.history.map((entry) => entry.actorUserId)))];
    const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
    const actorNames = new Map(actors.map((actor) => [actor.id, actor.name]));

    return {
      success: true as const,
      event,
      reasons: Object.entries(reasonLabels).map(([value, label]) => ({ value, label })),
      counts: { candidates: candidateCount, excluded: excludedCount, registered: registeredCount, history: historyCount },
      pagination: { page, pageSize },
      candidates,
      excluded: excluded.map((row) => ({ ...row, history: row.history.map((entry) => ({ ...entry, actorName: actorNames.get(entry.actorUserId) ?? "Pengguna" })) })),
      historyRows: historyRows.map((row) => ({ ...row, history: row.history.map((entry) => ({ ...entry, actorName: actorNames.get(entry.actorUserId) ?? "Pengguna" })) })),
      registered: registered.flatMap((journey) => journey.registration.student ? [{
        journeyId: journey.id,
        ...journey.registration.student,
        destinationKordaName: journey.destinationKordaNameSnapshot,
        dropPointName: journey.locationNameSnapshot,
      }] : []),
    };
  } catch (error) {
    if (error instanceof AccessDeniedError) return { success: false as const, error: error.message };
    logger.error({ err: error, eventId, search }, "getOutboundRoster failed");
    return { success: false as const, error: "Gagal memuat daftar Pulang." };
  }
}

export async function createOutboundDisposition(input: { eventId: string; studentId: string; reason: OutboundDispositionReason }) {
  try {
    const scope = await getRegionalAccessScope();
    requireAdmin(scope);
    if (!Object.values(OutboundDispositionReason).includes(input.reason)) return { success: false as const, error: "Pilih alasan pengecualian yang tersedia." };
    await prisma.$transaction(async (tx) => {
      const [event, student, outboundJourney, existing] = await Promise.all([
        tx.event.findUnique({ where: { id: input.eventId }, select: { id: true } }),
        tx.student.findUnique({ where: { id: input.studentId }, select: { id: true, status: true } }),
        tx.journey.findFirst({ where: { direction: "OUTBOUND", status: "REGISTERED", registration: { eventId: input.eventId, studentId: input.studentId, status: { not: "CANCELLED" } } }, select: { id: true } }),
        tx.outboundDisposition.findUnique({ where: { eventId_studentId: { eventId: input.eventId, studentId: input.studentId } } }),
      ]);
      if (!event || !student?.status) throw new Error("Santri aktif atau event tidak ditemukan.");
      if (outboundJourney) throw new Error("Santri sudah terdaftar untuk perjalanan Pulang.");
      if (existing?.status === "ACTIVE") throw new Error("Santri sudah tercatat tidak ikut Pulang.");
      const disposition = existing
        ? await tx.outboundDisposition.update({ where: { id: existing.id }, data: { reason: input.reason, status: OutboundDispositionStatus.ACTIVE, updatedByUserId: scope.userId } })
        : await tx.outboundDisposition.create({ data: { eventId: input.eventId, studentId: input.studentId, reason: input.reason, createdByUserId: scope.userId, updatedByUserId: scope.userId } });
      await tx.outboundDispositionHistory.create({ data: {
        dispositionId: disposition.id,
        fromReason: existing?.reason ?? null,
        toReason: input.reason,
        fromStatus: existing?.status ?? null,
        toStatus: OutboundDispositionStatus.ACTIVE,
        actorUserId: scope.userId,
      } });
    }, { isolationLevel: "Serializable" });
    revalidatePath("/data-pulang");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AccessDeniedError) return { success: false as const, error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) return { success: false as const, error: "Data berubah bersamaan. Muat ulang daftar lalu coba lagi." };
    return { success: false as const, error: error instanceof Error ? error.message : "Gagal mencatat pengecualian." };
  }
}

export async function updateOutboundDisposition(input: { dispositionId: string; reason: OutboundDispositionReason }) {
  try {
    const scope = await getRegionalAccessScope();
    requireAdmin(scope);
    if (!Object.values(OutboundDispositionReason).includes(input.reason)) return { success: false as const, error: "Pilih alasan pengecualian yang tersedia." };
    const existing = await prisma.outboundDisposition.findUnique({ where: { id: input.dispositionId } });
    if (!existing || existing.status !== "ACTIVE") return { success: false as const, error: "Pengecualian aktif tidak ditemukan." };
    const outboundJourney = await prisma.journey.findFirst({ where: { direction: "OUTBOUND", status: "REGISTERED", registration: { eventId: existing.eventId, studentId: existing.studentId, status: { not: "CANCELLED" } } }, select: { id: true } });
    if (outboundJourney) return { success: false as const, error: "Santri sudah terdaftar untuk Pulang. Pengecualian tidak dapat diubah." };
    await prisma.$transaction(async (tx) => {
      await tx.outboundDisposition.update({ where: { id: existing.id }, data: { reason: input.reason, updatedByUserId: scope.userId } });
      await tx.outboundDispositionHistory.create({ data: { dispositionId: existing.id, fromReason: existing.reason, toReason: input.reason, fromStatus: existing.status, toStatus: existing.status, actorUserId: scope.userId } });
    });
    revalidatePath("/data-pulang");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AccessDeniedError) return { success: false as const, error: error.message };
    return { success: false as const, error: "Gagal memperbarui alasan pengecualian." };
  }
}

export async function cancelOutboundDisposition(dispositionId: string) {
  try {
    const scope = await getRegionalAccessScope();
    requireAdmin(scope);
    const existing = await prisma.outboundDisposition.findUnique({ where: { id: dispositionId } });
    if (!existing || existing.status !== "ACTIVE") return { success: false as const, error: "Pengecualian aktif tidak ditemukan." };
    await prisma.$transaction(async (tx) => {
      await tx.outboundDisposition.update({ where: { id: existing.id }, data: { status: OutboundDispositionStatus.CANCELLED, updatedByUserId: scope.userId } });
      await tx.outboundDispositionHistory.create({ data: { dispositionId: existing.id, fromReason: existing.reason, toReason: existing.reason, fromStatus: existing.status, toStatus: OutboundDispositionStatus.CANCELLED, actorUserId: scope.userId } });
    });
    revalidatePath("/data-pulang");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AccessDeniedError) return { success: false as const, error: error.message };
    return { success: false as const, error: "Gagal membatalkan pengecualian." };
  }
}

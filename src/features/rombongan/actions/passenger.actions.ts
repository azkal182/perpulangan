"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logger } from "@/server/logger";
import {
  AccessDeniedError,
  andWhere,
  busScopeWhere,
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

    if (journey === "outbound") {
      const regs = await prisma.registration.findMany({
        where: andWhere(
          { outboundBusId: busId },
          registrationScopeWhere(scope),
        ),
        include: {
          student: {
            select: { id: true, name: true, nis: true, gender: true },
          },
          outboundKorda: { select: { name: true } },
          outboundDropPoint: { select: { name: true, price: true } },
        },
        orderBy: { student: { name: "asc" } },
      });
      return regs.map((r) => ({
        registrationId: r.id,
        studentId: r.student.id,
        studentName: r.student.name,
        studentNis: r.student.nis,
        studentGender: r.student.gender,
        kordaName: r.outboundKorda?.name ?? null,
        dropPointName: r.outboundDropPoint?.name ?? null,
        dropPointPrice: r.outboundDropPoint?.price ?? null,
        journeyDate: r.outboundDate,
        paid: r.outboundPaid,
      }));
    } else {
      const regs = await prisma.registration.findMany({
        where: andWhere(
          { returnBusId: busId },
          registrationScopeWhere(scope),
        ),
        include: {
          student: {
            select: { id: true, name: true, nis: true, gender: true },
          },
          returnKorda: { select: { name: true } },
          returnDropPoint: { select: { name: true, price: true } },
        },
        orderBy: { student: { name: "asc" } },
      });
      return regs.map((r) => ({
        registrationId: r.id,
        studentId: r.student.id,
        studentName: r.student.name,
        studentNis: r.student.nis,
        studentGender: r.student.gender,
        kordaName: r.returnKorda?.name ?? null,
        dropPointName: r.returnDropPoint?.name ?? null,
        dropPointPrice: r.returnDropPoint?.price ?? null,
        journeyDate: r.returnDate,
        paid: r.returnPaid,
      }));
    }
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
    // Get bus info (event only — korda filter dihapus agar semua peserta event bisa di-assign)
    const bus = await prisma.bus.findFirst({
      where: andWhere({ id: busId }, busScopeWhere(scope)),
      select: { eventId: true },
    });
    if (!bus) throw new Error("Bus tidak ditemukan");

    const searchFilter = search?.trim()
      ? {
          OR: [
            { name: { contains: search.trim(), mode: "insensitive" as const } },
            { nis: { contains: search.trim(), mode: "insensitive" as const } },
          ],
        }
      : undefined;

    if (journey === "outbound") {
      const regs = await prisma.registration.findMany({
        where: andWhere(
          {
            eventId: bus.eventId,
            outboundBusId: null, // belum di-assign ke bus manapun
            status: { in: ["CONFIRMED", "PARTIAL_CANCEL"] },
            ...(searchFilter && { student: searchFilter }),
          },
          registrationScopeWhere(scope),
        ),
        include: {
          student: {
            select: { id: true, name: true, nis: true, gender: true },
          },
          outboundKorda: { select: { name: true } },
          outboundDropPoint: { select: { name: true } },
        },
        orderBy: { student: { name: "asc" } },
      });
      return regs.map((r) => ({
        registrationId: r.id,
        studentId: r.student.id,
        studentName: r.student.name,
        studentNis: r.student.nis,
        studentGender: r.student.gender,
        kordaName: r.outboundKorda?.name ?? null,
        dropPointName: r.outboundDropPoint?.name ?? null,
        journeyDate: r.outboundDate,
      }));
    } else {
      const regs = await prisma.registration.findMany({
        where: andWhere(
          {
            eventId: bus.eventId,
            returnBusId: null, // belum di-assign ke bus manapun
            status: { in: ["CONFIRMED", "PARTIAL_CANCEL"] },
            ...(searchFilter && { student: searchFilter }),
          },
          registrationScopeWhere(scope),
        ),
        include: {
          student: {
            select: { id: true, name: true, nis: true, gender: true },
          },
          returnKorda: { select: { name: true } },
          returnDropPoint: { select: { name: true } },
        },
        orderBy: { student: { name: "asc" } },
      });
      return regs.map((r) => ({
        registrationId: r.id,
        studentId: r.student.id,
        studentName: r.student.name,
        studentNis: r.student.nis,
        studentGender: r.student.gender,
        kordaName: r.returnKorda?.name ?? null,
        dropPointName: r.returnDropPoint?.name ?? null,
        journeyDate: r.returnDate,
      }));
    }
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
    const [bus, registration] = await Promise.all([
      prisma.bus.findFirst({
        where: andWhere({ id: busId }, busScopeWhere(scope)),
        select: { id: true, eventId: true },
      }),
      prisma.registration.findFirst({
        where: andWhere({ id: registrationId }, registrationScopeWhere(scope)),
        select: { id: true, eventId: true },
      }),
    ]);

    if (!bus) {
      throw new AccessDeniedError("Bus di luar cakupan akses");
    }
    if (!registration) {
      throw new AccessDeniedError("Registrasi di luar cakupan akses");
    }
    if (registration.eventId !== bus.eventId) {
      throw new Error("Registrasi tidak sesuai event bus");
    }

    if (journey === "outbound") {
      await prisma.registration.update({
        where: { id: registrationId },
        data: { outboundBusId: busId },
      });
    } else {
      await prisma.registration.update({
        where: { id: registrationId },
        data: { returnBusId: busId },
      });
    }
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
    const existing = await prisma.registration.findFirst({
      where: andWhere({ id: registrationId }, registrationScopeWhere(scope)),
      select: { id: true },
    });
    if (!existing) {
      throw new AccessDeniedError("Registrasi di luar cakupan akses");
    }

    if (journey === "outbound") {
      await prisma.registration.update({
        where: { id: registrationId },
        data: { outboundBusId: null },
      });
    } else {
      await prisma.registration.update({
        where: { id: registrationId },
        data: { returnBusId: null },
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

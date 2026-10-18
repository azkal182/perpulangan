"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import {
  registrationRepository,
  type RegistrationCreateData,
  type RegistrationUpdateData,
} from "../repositories/registration.repository";
import { logger } from "@/server/logger";
import { RegistrationStatus } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import {
  AccessDeniedError,
  ensureKordaInScope,
  getRegionalAccessScope,
  registrationScopeWhere,
} from "@/server/access-scope";

async function resolveOutboundDisposition(
  tx: Prisma.TransactionClient,
  eventId: string,
  studentId: string | null | undefined,
  actorUserId: string,
) {
  if (!studentId) return;
  const disposition = await tx.outboundDisposition.findUnique({
    where: { eventId_studentId: { eventId, studentId } },
  });
  if (!disposition || disposition.status !== "ACTIVE") return;
  await tx.outboundDisposition.update({
    where: { id: disposition.id },
    data: { status: "COMPLETED", updatedByUserId: actorUserId },
  });
  await tx.outboundDispositionHistory.create({ data: {
    dispositionId: disposition.id,
    fromReason: disposition.reason,
    toReason: disposition.reason,
    fromStatus: disposition.status,
    toStatus: "COMPLETED",
    actorUserId,
  } });
}

async function maskRegistrationForScope<T extends {
  outboundKordaId?: string | null;
  returnKordaId?: string | null;
  outboundKorda?: unknown;
  outboundDropPoint?: unknown;
  outboundDropPointId?: string | null;
  outboundDate?: Date | null;
  outboundPaid?: boolean;
  outboundBusId?: string | null;
  outboundBus?: unknown;
  returnKorda?: unknown;
  returnDropPoint?: unknown;
  returnDropPointId?: string | null;
  returnDate?: Date | null;
  returnPaid?: boolean;
  returnBusId?: string | null;
  returnBus?: unknown;
}>(registration: T, scope: Awaited<ReturnType<typeof getRegionalAccessScope>>) {
  if (scope.role === "admin") return registration;
  const kordas = await prisma.korda.findMany({
    where: scope.role === "korwil"
      ? { korwilId: scope.korwilId ?? "__NO_ACCESS__" }
      : { id: scope.kordaId ?? "__NO_ACCESS__" },
    select: { id: true },
  });
  const allowed = new Set(kordas.map((korda) => korda.id));
  const outboundVisible = !!registration.outboundKordaId && allowed.has(registration.outboundKordaId);
  const returnVisible = !!registration.returnKordaId && allowed.has(registration.returnKordaId);
  return {
    ...registration,
    ...(!outboundVisible ? {
      outboundKordaId: null, outboundKorda: null, outboundDropPointId: null,
      outboundDropPoint: null, outboundDate: null, outboundPaid: false,
      outboundBusId: null, outboundBus: null,
    } : {}),
    ...(!returnVisible ? {
      returnKordaId: null, returnKorda: null, returnDropPointId: null,
      returnDropPoint: null, returnDate: null, returnPaid: false,
      returnBusId: null, returnBus: null,
    } : {}),
  };
}

export async function getRegistrations(params?: {
  eventId?: string;
  studentId?: string;
  status?: RegistrationStatus;
}) {
  try {
    const scope = await getRegionalAccessScope();
    const data = await registrationRepository.findMany({
      ...params,
      where: registrationScopeWhere(scope),
    });
    return { success: true, data: await Promise.all(data.map((row) => maskRegistrationForScope(row, scope))) };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    logger.error({ err: error, params }, "getRegistrations action failed");
    return { success: false, error: "Failed to fetch registrations" };
  }
}

export async function getRegistrationById(id: string) {
  try {
    const scope = await getRegionalAccessScope();
    const data = await registrationRepository.findById(
      id,
      registrationScopeWhere(scope),
    );
    if (!data) {
      return { success: false, error: "Registration not found" };
    }
    return { success: true, data: await maskRegistrationForScope(data, scope) };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    logger.error({ err: error, id }, "getRegistrationById action failed");
    return { success: false, error: "Failed to fetch registration" };
  }
}

export async function createRegistration(data: RegistrationCreateData) {
  try {
    const scope = await getRegionalAccessScope();
    const requestedJourneys = data.journeys ?? [
      ...(data.outboundKordaId && data.outboundDropPointId ? [{ direction: "OUTBOUND" as const, destinationKordaId: data.outboundKordaId, dropPointId: data.outboundDropPointId }] : []),
      ...(data.returnKordaId && data.returnDropPointId ? [{ direction: "RETURN" as const, destinationKordaId: data.returnKordaId, dropPointId: data.returnDropPointId }] : []),
    ];
    if (requestedJourneys.length === 0) {
      return { success: false, error: "Pilih setidaknya satu perjalanan dan titik tujuan." };
    }
    if (new Set(requestedJourneys.map((journey) => journey.direction)).size !== requestedJourneys.length) {
      return { success: false, error: "Jenis perjalanan yang sama tidak boleh didaftarkan dua kali." };
    }

    for (const journey of requestedJourneys) await ensureKordaInScope(scope, journey.destinationKordaId);
    if (requestedJourneys.length === 2 && new Set(requestedJourneys.map((journey) => journey.destinationKordaId)).size !== 1) {
      return { success: false, error: "Pulang-pergi harus menggunakan satu Korda tujuan. Untuk tujuan berbeda, daftarkan perjalanannya satu per satu." };
    }

    const event = await prisma.event.findUnique({ where: { id: data.eventId }, select: { id: true, status: true, startDate: true, endDate: true } });
    if (!event || event.status === "DRAFT") return { success: false, error: "Event tidak ditemukan atau belum dibuka." };

    let originKordaId: string | null = null;
    let originKordaNameSnapshot: string | null = null;
    if (data.studentId) {
      const student = await prisma.student.findUnique({
        where: { id: data.studentId },
        select: { id: true, name: true, nis: true, gender: true, provinceId: true, regencyId: true, regionalStatus: true, regency: { select: { kordaId: true, korda: { select: { name: true } } } } },
      });
      if (!student) return { success: false, error: "Santri tidak ditemukan." };
      if (!student.name.trim() || !student.gender.trim() || student.regionalStatus === "NEEDS_REVIEW" || !student.provinceId || !student.regencyId || !student.regency?.kordaId) {
        return { success: false, error: "Data wilayah santri belum lengkap. Minta admin memperbarui provinsi, kota/kabupaten, dan Korda asal sebelum registrasi." };
      }
      originKordaId = student.regency.kordaId;
      originKordaNameSnapshot = student.regency.korda?.name ?? null;
    } else if (data.externalParticipantId) {
      const participant = await prisma.externalParticipant.findUnique({ where: { id: data.externalParticipantId }, select: { id: true, name: true, gender: true, address: true, status: true, intendedKordaId: true } });
      if (!participant) return { success: false, error: "Profil peserta eksternal tidak ditemukan." };
      if (participant.status !== "COMPLETE" || !participant.name.trim() || !participant.gender?.trim() || !participant.address?.trim()) {
        return { success: false, error: "Profil peserta eksternal belum lengkap. Admin perlu melengkapi nama, jenis kelamin, dan alamat sebelum registrasi." };
      }
      if (requestedJourneys.some((journey) => journey.destinationKordaId !== participant.intendedKordaId)) {
        return { success: false, error: "Peserta eksternal hanya dapat didaftarkan ke Korda tujuan yang tercantum pada profilnya." };
      }
    } else {
      return { success: false, error: "Pilih data santri atau profil peserta eksternal." };
    }

    const snapshots: NonNullable<RegistrationCreateData["journeys"]> = [];
    for (const journey of requestedJourneys) {
      const destination = await prisma.korda.findUnique({ where: { id: journey.destinationKordaId }, select: { id: true, name: true } });
      const dropPoint = await prisma.dropPoint.findFirst({ where: { id: journey.dropPointId, kordaId: journey.destinationKordaId }, select: { id: true, name: true, price: true } });
      if (!destination || !dropPoint) return { success: false, error: "Titik tujuan tidak sesuai dengan Korda tujuan yang dipilih." };
      snapshots.push({
        direction: journey.direction,
        destinationKordaId: destination.id,
        destinationKordaNameSnapshot: destination.name,
        dropPointId: dropPoint.id,
        locationNameSnapshot: dropPoint.name,
        travelDate: "travelDate" in journey ? journey.travelDate ?? null : journey.direction === "OUTBOUND" ? event.startDate : event.endDate,
        tariffSnapshot: dropPoint.price,
      });
    }

    const whereParticipant = data.studentId ? { studentId: data.studentId } : { externalParticipantId: data.externalParticipantId! };
    const existingRegistration = await prisma.registration.findFirst({ where: { eventId: data.eventId, ...whereParticipant }, include: { journeys: true } });
    if (event.status === "COMPLETED" && (!existingRegistration || requestedJourneys.some((journey) => journey.direction !== "RETURN"))) {
      return { success: false, error: "Event sudah selesai. Hanya perjalanan Kembali yang belum terdaftar pada peserta/event ini yang dapat ditambahkan." };
    }
    if (existingRegistration) {
      const existingDirections = new Set(existingRegistration.journeys.map((journey) => journey.direction));
      const missing = snapshots.filter((journey) => !existingDirections.has(journey.direction));
      if (!missing.length) return { success: false, error: "Perjalanan ini sudah terdaftar pada event tersebut." };
      const created = await prisma.$transaction(async (tx) => {
        await tx.journey.createMany({ data: missing.map((journey) => ({ ...journey, registrationId: existingRegistration.id })) });
        const outbound = snapshots.find((journey) => journey.direction === "OUTBOUND");
        const returning = snapshots.find((journey) => journey.direction === "RETURN");
        const updatedRegistration = await tx.registration.update({ where: { id: existingRegistration.id }, data: {
          ...(outbound ? { outboundKordaId: outbound.destinationKordaId, outboundDropPointId: outbound.dropPointId, outboundDate: outbound.travelDate } : {}),
          ...(returning ? { returnKordaId: returning.destinationKordaId, returnDropPointId: returning.dropPointId, returnDate: returning.travelDate } : {}),
        } });
        if (missing.some((journey) => journey.direction === "OUTBOUND")) {
          await resolveOutboundDisposition(tx, data.eventId, data.studentId, scope.userId);
        }
        return updatedRegistration;
      });
      revalidatePath("/registrasi");
      revalidatePath("/data-pulang");
      revalidatePath(`/event/${data.eventId}/participants`);
      return { success: true, data: await maskRegistrationForScope(created, scope) };
    }

    const outbound = snapshots.find((journey) => journey.direction === "OUTBOUND");
    const returning = snapshots.find((journey) => journey.direction === "RETURN");
    const registrar = await prisma.user.findUnique({ where: { id: scope.userId }, select: { name: true } });
    const registrationData: RegistrationCreateData = {
      ...data,
      journeys: snapshots,
      originKordaId,
      originKordaNameSnapshot,
      registrarUserId: scope.userId,
      kordaChanged: !!originKordaId && snapshots.some((journey) => journey.destinationKordaId !== originKordaId),
      kordaChangeConfirmed: true,
      outboundKordaId: outbound?.destinationKordaId ?? null,
      outboundDropPointId: outbound?.dropPointId ?? null,
      returnKordaId: returning?.destinationKordaId ?? null,
      returnDropPointId: returning?.dropPointId ?? null,
      outboundDate: outbound?.travelDate ?? null,
      returnDate: returning?.travelDate ?? null,
      outboundPaid: false,
      returnPaid: false,
      registrarName: registrar?.name || data.registrarName || "Pengguna",
      registrarPhone: data.registrarPhone || "",
    };
    const result = await prisma.$transaction(async (tx) => {
      const created = await registrationRepository.create(registrationData, tx);
      if (snapshots.some((journey) => journey.direction === "OUTBOUND")) {
        await resolveOutboundDisposition(tx, data.eventId, data.studentId, scope.userId);
      }
      return created;
    });
    revalidatePath("/registrasi");
    revalidatePath("/data-pulang");
    revalidatePath(`/event/${data.eventId}/participants`);
      return { success: true, data: await maskRegistrationForScope(result, scope) };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    logger.error({ err: error, data: { eventId: data.eventId, studentId: data.studentId, externalParticipantId: data.externalParticipantId } }, "createRegistration action failed");
    return { success: false, error: "Failed to create registration" };
  }
}

export async function checkStudentAlreadyRegistered(params: {
  eventId: string;
  studentId: string;
}) {
  try {
    await getRegionalAccessScope();
    const registration = await prisma.registration.findFirst({
      where: { eventId: params.eventId, studentId: params.studentId },
      select: {
        outboundKorda: { select: { name: true } },
        returnKorda: { select: { name: true } },
        outboundKordaId: true,
        returnKordaId: true,
        outboundDate: true,
        returnDate: true,
        journeys: { select: { direction: true } },
      },
    });

    if (!registration) {
      return {
        success: true,
        registered: false,
        hasOutbound: false,
        hasReturn: false,
      };
    }

    return {
      success: true,
      registered: true,
      hasOutbound: registration.journeys.some((journey) => journey.direction === "OUTBOUND") || registration.outboundDate !== null || registration.outboundKordaId !== null,
      hasReturn: registration.journeys.some((journey) => journey.direction === "RETURN") || registration.returnDate !== null || registration.returnKordaId !== null,
    };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return {
        success: false,
        registered: false,
        error: error.message,
      };
    }

    logger.error(
      { err: error, params },
      "checkStudentAlreadyRegistered action failed",
    );
    return {
      success: false,
      registered: false,
      error: "Gagal memeriksa status registrasi santri",
    };
  }
}

export async function updateRegistration(
  id: string,
  data: RegistrationUpdateData
) {
  try {
    if (data.outboundPaid !== undefined || data.returnPaid !== undefined) {
      return { success: false, error: "Status pembayaran dihitung dari transaksi dan tidak dapat diubah langsung. Catat pembayaran/refund pada menu Pembayaran." };
    }
    const scope = await getRegionalAccessScope();
    const existing = await registrationRepository.findById(
      id,
      registrationScopeWhere(scope),
    );
    if (!existing) {
      return { success: false, error: "Registration not found" };
    }

    if (data.outboundKordaId) {
      await ensureKordaInScope(scope, data.outboundKordaId);
    }
    if (data.returnKordaId) {
      await ensureKordaInScope(scope, data.returnKordaId);
    }
    if (scope.role !== "admin") {
      if (("status" in data || "cancelledAt" in data || "cancelReason" in data || "refundAmount" in data) && existing.outboundKordaId && existing.returnKordaId) {
        await ensureKordaInScope(scope, existing.outboundKordaId, "Perubahan status harus mencakup seluruh perjalanan dalam registrasi");
        await ensureKordaInScope(scope, existing.returnKordaId, "Perubahan status harus mencakup seluruh perjalanan dalam registrasi");
      }
      if (("outboundPaid" in data || "outboundDate" in data || "outboundDropPointId" in data) && existing.outboundKordaId) {
        await ensureKordaInScope(scope, existing.outboundKordaId, "Perjalanan pulang di luar cakupan akses");
      }
      if (("returnPaid" in data || "returnDate" in data || "returnDropPointId" in data) && existing.returnKordaId) {
        await ensureKordaInScope(scope, existing.returnKordaId, "Perjalanan kembali di luar cakupan akses");
      }
    }

    const result = await registrationRepository.update(id, data);
    revalidatePath("/registrasi");
    revalidatePath(`/event/${result.eventId}/participants`);
    return { success: true, data: await maskRegistrationForScope(result, scope) };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    logger.error({ err: error, id, data }, "updateRegistration action failed");
    return { success: false, error: "Failed to update registration" };
  }
}

export async function deleteRegistration(id: string) {
  try {
    const scope = await getRegionalAccessScope();
    const existing = await registrationRepository.findById(
      id,
      registrationScopeWhere(scope),
    );
    if (!existing) {
      return { success: false, error: "Registration not found" };
    }

    if (scope.role !== "admin") {
      if (existing.outboundKordaId) await ensureKordaInScope(scope, existing.outboundKordaId, "Registrasi memiliki perjalanan di luar cakupan akses");
      if (existing.returnKordaId) await ensureKordaInScope(scope, existing.returnKordaId, "Registrasi memiliki perjalanan di luar cakupan akses");
    }

    const result = await registrationRepository.delete(id);
    revalidatePath("/registrasi");
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    logger.error({ err: error, id }, "deleteRegistration action failed");
    return { success: false, error: "Failed to delete registration" };
  }
}

export async function cancelRegistration(
  id: string,
  type: 'full' | 'partial',
  reason: string,
  refundAmount: number
) {
  try {
    const scope = await getRegionalAccessScope();
    const registration = await registrationRepository.findById(
      id,
      registrationScopeWhere(scope),
    );
    if (!registration) {
      return { success: false, error: "Registration not found" };
    }

    if (scope.role !== "admin") {
      if (registration.outboundKordaId) await ensureKordaInScope(scope, registration.outboundKordaId, "Registrasi memiliki perjalanan di luar cakupan akses");
      if (registration.returnKordaId) await ensureKordaInScope(scope, registration.returnKordaId, "Registrasi memiliki perjalanan di luar cakupan akses");
    }

    if (registration.status === "CANCELLED") {
      return { success: false, error: "Registration already cancelled" };
    }

    // Determine new status
    let newStatus: RegistrationStatus = "CANCELLED";
    
    if (type === 'partial') {
      // Logic: Partial cancel usually means cancelling one leg. 
      // In this context, it mostly means cancelling the return leg while keeping outbound.
      // If the user only has return leg (return-only), partial cancel effectively cancels the whole thing 
      // or we can allow PARTIAL_CANCEL status to indicate 'Return Cancelled' state specifically.
      // Let's stick to the business rule: "Cancellations and refunds are possible for the return journey."
      
      if (!registration.outboundDropPointId) {
        // If return-only, partial cancel is effectively full cancel
        newStatus = "CANCELLED";
      } else {
        newStatus = "PARTIAL_CANCEL";
      }
    }

    const result = await registrationRepository.update(id, {
      status: newStatus,
      cancelledAt: new Date(),
      cancelReason: reason,
      refundAmount: refundAmount,
    });

    logger.info(
      { id, type, newStatus },
      "Registration cancelled"
    );

    revalidatePath("/registrasi");
    revalidatePath(`/event/${result.eventId}/participants`);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    logger.error({ err: error, id }, "cancelRegistration action failed");
    return { success: false, error: "Failed to cancel registration" };
  }
}

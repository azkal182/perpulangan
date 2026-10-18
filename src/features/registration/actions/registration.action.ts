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
import { randomUUID } from "node:crypto";
import { getJourneyTariff } from "@/features/drop-points/domain/package-tariff";
import type { Prisma } from "@/generated/prisma/client";
import { allowedEvidenceMime, createEvidenceCleanupToken, createSignedEvidenceUpload, deleteEvidenceObject, isValidEvidenceCleanupToken, isValidEvidenceStorageKey, verifyEvidenceObject } from "@/features/payment/services/supabase-storage";
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
        tariffSnapshot: getJourneyTariff(dropPoint.price, journey.direction),
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

type RegistrationBatchEntry = RegistrationCreateData & { participantKey: string };
type RegistrationEvidenceInput = { id: string; storageKey: string; name: string; mimeType: string; sizeBytes: number };

export async function createRegistrationEvidenceUploadAction(input: { name: string; mimeType: string; sizeBytes: number }) {
  try {
    const scope = await getRegionalAccessScope();
    if (!scope.userId) throw new Error("Sesi pengguna tidak valid.");
    if (!allowedEvidenceMime(input.mimeType) || !Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > 10 * 1024 * 1024) throw new Error("Bukti harus PDF, JPG, PNG, atau WebP dengan ukuran maksimal 10 MB.");
    const id = randomUUID();
    const extension = input.mimeType === "application/pdf" ? "pdf" : input.mimeType === "image/jpeg" ? "jpg" : input.mimeType === "image/png" ? "png" : "webp";
    const storageKey = `evidence/${id}.${extension}`;
    const signed = await createSignedEvidenceUpload(storageKey);
    if (!signed.token) throw new Error("Supabase tidak mengembalikan token upload.");
    return { success: true as const, id, storageKey, signedUrl: signed.signedUrl, cleanupToken: createEvidenceCleanupToken(scope.userId, storageKey) };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Gagal menyiapkan upload bukti." };
  }
}

export async function cleanupRegistrationEvidenceUploadAction(storageKey: string, cleanupToken: string) {
  try {
    const scope = await getRegionalAccessScope();
    if (!scope.userId || !/^evidence\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/i.test(storageKey) || !isValidEvidenceCleanupToken(scope.userId, storageKey, cleanupToken)) return { success: false };
    if (await prisma.evidenceFile.findUnique({ where: { storageKey }, select: { id: true } })) return { success: false };
    await deleteEvidenceObject(storageKey);
    return { success: true };
  } catch {
    return { success: false };
  }
}

/** Atomically creates the submitted registrations and their optional shared family payment. */
export async function finalizeRegistrationBatchAction(input: {
  registrations: RegistrationBatchEntry[];
  payment?: { amount: number; balanceOwnerKey?: string | null; allocations?: Array<{ participantKey: string; direction: "OUTBOUND" | "RETURN"; journeyAmount: number }>; evidence?: RegistrationEvidenceInput | null } | null;
}) {
  let uploadedStorageKey: string | null = null;
  try {
    const scope = await getRegionalAccessScope();
    if (!input.registrations.length) return { success: false, error: "Tambahkan setidaknya satu peserta ke registrasi." };
    const keys = input.registrations.map((row) => row.studentId ? `student:${row.eventId}:${row.studentId}` : `external:${row.eventId}:${row.externalParticipantId}`);
    if (new Set(keys).size !== keys.length) return { success: false, error: "Peserta yang sama tercantum lebih dari sekali." };
    const participantKeys = input.registrations.map((row) => row.participantKey);
    if (participantKeys.some((key) => !key) || new Set(participantKeys).size !== participantKeys.length) return { success: false, error: "Penanda peserta tidak valid atau berulang." };
    const eventIds = new Set(input.registrations.map((row) => row.eventId));
    if (eventIds.size !== 1) return { success: false, error: "Satu penyelesaian hanya dapat mencakup satu event." };
    const eventId = input.registrations[0].eventId;
    const evidence = input.payment?.evidence ?? null;
    let evidenceSha256: string | null = null;
    if (input.payment) {
      if (!Number.isSafeInteger(input.payment.amount) || input.payment.amount <= 0) return { success: false, error: "Masukkan nominal pembayaran berupa rupiah bulat yang lebih dari nol." };
      if (!evidence) return { success: false, error: "Bukti transfer wajib diunggah saat pembayaran dicatat bersama registrasi." };
      if (evidence) {
        if (!isValidEvidenceStorageKey(evidence.storageKey, evidence.id, evidence.mimeType)) return { success: false, error: "Metadata bukti tidak valid." };
        uploadedStorageKey = evidence.storageKey;
        evidenceSha256 = await verifyEvidenceObject(evidence.storageKey, evidence.mimeType, evidence.sizeBytes);
      }
    }
    const registrar = await prisma.user.findUnique({ where: { id: scope.userId }, select: { name: true } });
    const created = await prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({ where: { id: eventId }, select: { id: true, status: true, startDate: true, endDate: true } });
      if (!event || event.status === "DRAFT") throw new Error("Event tidak ditemukan atau belum dibuka.");
      const newJourneyRows: Array<{ id: string; direction: "OUTBOUND" | "RETURN"; destinationKordaId: string; destinationName: string; participantName: string; originName: string | null; tariff: number; participantKey: string }> = [];
      const madeRegistrations: Array<{ id: string; participantName: string }> = [];

      for (const data of input.registrations) {
        const requested = data.journeys ?? [
          ...(data.outboundKordaId && data.outboundDropPointId ? [{ direction: "OUTBOUND" as const, destinationKordaId: data.outboundKordaId, dropPointId: data.outboundDropPointId }] : []),
          ...(data.returnKordaId && data.returnDropPointId ? [{ direction: "RETURN" as const, destinationKordaId: data.returnKordaId, dropPointId: data.returnDropPointId }] : []),
        ];
        if (!requested.length || new Set(requested.map((j) => j.direction)).size !== requested.length) throw new Error("Pilih perjalanan yang valid untuk setiap peserta.");
        for (const journey of requested) await ensureKordaInScope(scope, journey.destinationKordaId);
        if (requested.length === 2 && new Set(requested.map((j) => j.destinationKordaId)).size !== 1) throw new Error("Pulang-pergi harus menggunakan satu Korda tujuan.");
        let originKordaId: string | null = null;
        let originName: string | null = null;
        let participantName = "";
        if (data.studentId) {
          const student = await tx.student.findUnique({ where: { id: data.studentId }, select: { name: true, gender: true, provinceId: true, regencyId: true, regionalStatus: true, regency: { select: { kordaId: true, korda: { select: { name: true } } } } } });
          if (!student) throw new Error("Santri tidak ditemukan.");
          if (!student.name.trim() || !student.gender.trim() || student.regionalStatus === "NEEDS_REVIEW" || !student.provinceId || !student.regencyId || !student.regency?.kordaId) throw new Error(`Data wilayah ${student.name} belum lengkap. Minta admin memperbarui provinsi, kabupaten/kota, dan Korda asal.`);
          participantName = student.name; originKordaId = student.regency.kordaId; originName = student.regency.korda?.name ?? null;
        } else if (data.externalParticipantId) {
          const person = await tx.externalParticipant.findUnique({ where: { id: data.externalParticipantId }, select: { name: true, gender: true, address: true, status: true, intendedKordaId: true } });
          if (!person || person.status !== "COMPLETE" || !person.name.trim() || !person.gender?.trim() || !person.address?.trim()) throw new Error("Profil peserta eksternal belum lengkap.");
          if (requested.some((j) => j.destinationKordaId !== person.intendedKordaId)) throw new Error("Peserta eksternal hanya dapat didaftarkan ke Korda tujuan pada profilnya.");
          participantName = person.name;
        } else throw new Error("Pilih data santri atau profil peserta eksternal.");
        const snapshots = [] as Array<{ direction: "OUTBOUND" | "RETURN"; destinationKordaId: string; destinationKordaNameSnapshot: string; dropPointId: string; locationNameSnapshot: string; travelDate: Date | null; tariffSnapshot: number }>;
        for (const journey of requested) {
          const [destination, dropPoint] = await Promise.all([
            tx.korda.findUnique({ where: { id: journey.destinationKordaId }, select: { id: true, name: true } }),
            tx.dropPoint.findFirst({ where: { id: journey.dropPointId, kordaId: journey.destinationKordaId }, select: { id: true, name: true, price: true } }),
          ]);
          if (!destination || !dropPoint) throw new Error("Titik tujuan tidak sesuai dengan Korda tujuan.");
          snapshots.push({ direction: journey.direction, destinationKordaId: destination.id, destinationKordaNameSnapshot: destination.name, dropPointId: dropPoint.id, locationNameSnapshot: dropPoint.name, travelDate: journey.direction === "OUTBOUND" ? event.startDate : event.endDate, tariffSnapshot: getJourneyTariff(dropPoint.price, journey.direction) });
        }
        const existing = await tx.registration.findFirst({ where: { eventId, ...(data.studentId ? { studentId: data.studentId } : { externalParticipantId: data.externalParticipantId! }) }, include: { journeys: true } });
        if (event.status === "COMPLETED" && (!existing || requested.some((j) => j.direction !== "RETURN"))) throw new Error("Event selesai; hanya Journey Kembali susulan yang dapat ditambahkan.");
        let registrationId: string;
        let journeyIds: string[];
        if (existing) {
          const existingDirections = new Set(existing.journeys.map((j) => j.direction));
          const missing = snapshots.filter((j) => !existingDirections.has(j.direction));
          if (!missing.length) throw new Error(`${participantName} sudah memiliki perjalanan yang dipilih.`);
          await tx.journey.createMany({ data: missing.map((journey) => ({ ...journey, registrationId: existing.id })) });
          const outbound = snapshots.find((j) => j.direction === "OUTBOUND"); const returning = snapshots.find((j) => j.direction === "RETURN");
          await tx.registration.update({ where: { id: existing.id }, data: { ...(outbound ? { outboundKordaId: outbound.destinationKordaId, outboundDropPointId: outbound.dropPointId, outboundDate: outbound.travelDate } : {}), ...(returning ? { returnKordaId: returning.destinationKordaId, returnDropPointId: returning.dropPointId, returnDate: returning.travelDate } : {}) } });
          registrationId = existing.id;
          journeyIds = (await tx.journey.findMany({ where: { registrationId, direction: { in: missing.map((j) => j.direction) } }, select: { id: true, direction: true } })).map((j) => j.id);
          if (missing.some((j) => j.direction === "OUTBOUND")) await resolveOutboundDisposition(tx, eventId, data.studentId, scope.userId);
        } else {
          const outbound = snapshots.find((j) => j.direction === "OUTBOUND"); const returning = snapshots.find((j) => j.direction === "RETURN");
          const registration = await registrationRepository.create({ ...data, journeys: snapshots, originKordaId, originKordaNameSnapshot: originName, registrarUserId: scope.userId, kordaChanged: !!originKordaId && snapshots.some((j) => j.destinationKordaId !== originKordaId), kordaChangeConfirmed: true, outboundKordaId: outbound?.destinationKordaId ?? null, outboundDropPointId: outbound?.dropPointId ?? null, returnKordaId: returning?.destinationKordaId ?? null, returnDropPointId: returning?.dropPointId ?? null, outboundDate: outbound?.travelDate ?? null, returnDate: returning?.travelDate ?? null, outboundPaid: false, returnPaid: false, registrarName: registrar?.name || "Pengguna", registrarPhone: "" }, tx);
          registrationId = registration.id;
          journeyIds = (await tx.journey.findMany({ where: { registrationId }, select: { id: true, direction: true } })).map((j) => j.id);
          if (snapshots.some((j) => j.direction === "OUTBOUND")) await resolveOutboundDisposition(tx, eventId, data.studentId, scope.userId);
        }
        madeRegistrations.push({ id: registrationId, participantName });
        const journeys = await tx.journey.findMany({ where: { id: { in: journeyIds } }, select: { id: true, direction: true, destinationKordaId: true, destinationKordaNameSnapshot: true, tariffSnapshot: true } });
        for (const journey of journeys) if (journey.tariffSnapshot !== null) newJourneyRows.push({ id: journey.id, direction: journey.direction, destinationKordaId: journey.destinationKordaId, destinationName: journey.destinationKordaNameSnapshot, participantName, originName, tariff: journey.tariffSnapshot, participantKey: data.participantKey });
      }

      if (input.payment) {
        const amount = input.payment.amount;
        const rows = [] as Array<{ journey: typeof newJourneyRows[number]; journeyAmount: number; balanceAmount: number }>;
        let remaining = amount;
        const manual = input.payment.allocations;
        if (manual && (new Set(manual.map((row) => `${row.participantKey}:${row.direction}`)).size !== manual.length || manual.some((row) => !Number.isSafeInteger(row.journeyAmount) || row.journeyAmount < 0))) throw new Error("Rincian alokasi partial tidak valid.");
        if (manual && (manual.length !== newJourneyRows.length || manual.some((row) => !newJourneyRows.some((journey) => journey.participantKey === row.participantKey && journey.direction === row.direction)))) throw new Error("Rincian alokasi harus cocok tepat dengan seluruh perjalanan peserta.");
        if (manual && manual.reduce((sum, row) => sum + row.journeyAmount, 0) > amount) throw new Error("Jumlah alokasi perjalanan melebihi nominal transfer.");
        for (const journey of newJourneyRows) {
          const [paid, refunded, corrected] = await Promise.all([
            tx.paymentAllocation.aggregate({ where: { journeyId: journey.id, type: "JOURNEY" }, _sum: { amount: true } }),
            tx.refund.aggregate({ where: { paymentAllocation: { journeyId: journey.id } }, _sum: { amount: true } }),
            tx.financialCorrection.aggregate({ where: { paymentAllocation: { journeyId: journey.id } }, _sum: { amount: true } }),
          ]);
          const due = Math.max(0, journey.tariff - (paid._sum.amount ?? 0) + (refunded._sum.amount ?? 0) + (corrected._sum.amount ?? 0));
          const manualRow = manual?.find((row) => row.participantKey === journey.participantKey && row.direction === journey.direction);
          if (manual && !manualRow) throw new Error("Rincian alokasi harus mencakup setiap perjalanan.");
          const allocated = manual ? manualRow!.journeyAmount : Math.min(due, remaining);
          if (allocated > due) throw new Error(`Alokasi ke ${journey.participantName} melebihi sisa tagihan Rp${due.toLocaleString("id-ID")}.`);
          if (!manual) remaining -= allocated;
          rows.push({ journey, journeyAmount: allocated, balanceAmount: 0 });
        }
        if (manual) remaining = amount - rows.reduce((sum, row) => sum + row.journeyAmount, 0);
        if (remaining > 0) {
          const owner = rows.find((row) => input.payment?.balanceOwnerKey === `${row.journey.participantKey}:${row.journey.direction}`);
          if (!owner && rows.length > 0) throw new Error("Pilih peserta dan arah perjalanan untuk mencatat pemilik kelebihan pembayaran.");
          if (!owner) throw new Error("Tidak ada perjalanan yang dapat menerima pembayaran.");
          owner.balanceAmount = remaining;
        }
        const paymentId = randomUUID();
        const generatedNote = rows.map(({ journey, journeyAmount, balanceAmount }) => `${journey.participantName} / ${journey.direction === "OUTBOUND" ? "Pulang" : "Kembali"} — tagihan Rp${journeyAmount.toLocaleString("id-ID")}${balanceAmount ? `, Saldo Lain Rp${balanceAmount.toLocaleString("id-ID")}` : ""} (${journey.destinationName})`).join("; ");
        await tx.payment.create({ data: { id: paymentId, eventId, payerName: "Tidak dicatat", amount, method: "Transfer", paidAt: new Date(), noteSnapshot: generatedNote, createdByUserId: scope.userId } });
        if (evidence && evidenceSha256) await tx.evidenceFile.create({ data: { id: evidence.id, storageKey: evidence.storageKey, originalName: evidence.name.slice(0, 255), mimeType: evidence.mimeType, sizeBytes: evidence.sizeBytes, sha256: evidenceSha256, uploadedByUserId: scope.userId, paymentId } });
        for (const { journey, journeyAmount, balanceAmount } of rows) {
          if (journeyAmount > 0) await tx.paymentAllocation.create({ data: { paymentId, type: "JOURNEY", journeyId: journey.id, participantNameSnapshot: journey.participantName, originKordaNameSnapshot: journey.originName, destinationKordaNameSnapshot: journey.destinationName, payerNameSnapshot: "Tidak dicatat", amount: journeyAmount, createdByUserId: scope.userId } });
          if (balanceAmount > 0) {
            const allocation = await tx.paymentAllocation.create({ data: { paymentId, type: "BALANCE", balanceOwnerKordaId: journey.destinationKordaId, participantNameSnapshot: journey.participantName, originKordaNameSnapshot: journey.originName, destinationKordaNameSnapshot: journey.destinationName, payerNameSnapshot: "Tidak dicatat", amount: balanceAmount, createdByUserId: scope.userId } });
            await tx.kordaBalanceEntry.create({ data: { ownerKordaId: journey.destinationKordaId, originKordaNameSnapshot: journey.originName, destinationKordaNameSnapshot: journey.destinationName, participantNameSnapshot: journey.participantName, payerNameSnapshot: "Tidak dicatat", sourcePaymentAllocationId: allocation.id, entryType: "CREDIT", amount: balanceAmount, createdByUserId: scope.userId } });
          }
        }
        await tx.financialAuditEntry.create({ data: { action: "PAYMENT_RECORDED", entityType: "Payment", entityId: paymentId, eventId, actorUserId: scope.userId, actorRoleSnapshot: scope.role, amount, paymentId } });
      }
      return madeRegistrations;
    }, { isolationLevel: "Serializable" });
    uploadedStorageKey = null;
    revalidatePath("/registrasi"); revalidatePath("/pembayaran"); revalidatePath("/daftar-peserta"); revalidatePath("/data-pulang"); revalidatePath(`/event/${eventId}/participants`);
    return { success: true, data: created };
  } catch (error) {
    if (uploadedStorageKey) await deleteEvidenceObject(uploadedStorageKey).catch(() => undefined);
    if (error instanceof AccessDeniedError) return { success: false, error: error.message };
    logger.error({ err: error }, "finalizeRegistrationBatchAction failed");
    return { success: false, error: error instanceof Error ? error.message : "Registrasi tidak berhasil disimpan." };
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

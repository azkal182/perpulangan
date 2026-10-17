"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AccessDeniedError, ensureKordaInScope, getRegionalAccessScope } from "@/server/access-scope";
import type { StudentBasic } from "./students.action";
import { normalizeExternalParticipantGender } from "../domain/external-participant";

function value(form: FormData, key: string) { return String(form.get(key) ?? "").trim(); }

export async function saveExternalParticipant(form: FormData) {
  try {
    const scope = await getRegionalAccessScope();
    const id = value(form, "id");
    const intendedKordaId = value(form, "intendedKordaId");
    const name = value(form, "name");
    const rawGender = value(form, "gender");
    const gender = normalizeExternalParticipantGender(rawGender);
    const address = value(form, "address") || null;
    if (rawGender && !gender) throw new Error("Jenis kelamin harus Laki-laki atau Perempuan.");
    if (!name || !gender || !address || !intendedKordaId) {
      throw new Error("Nama, jenis kelamin, alamat, dan Korda tujuan wajib diisi sebelum profil disimpan.");
    }
    await ensureKordaInScope(scope, intendedKordaId);

    if (id) {
      const existing = await prisma.externalParticipant.findFirst({ where: { id, ...(scope.role === "admin" ? {} : scope.role === "korwil" ? { intendedKorda: { korwilId: scope.korwilId ?? "__NO_ACCESS__" } } : { intendedKordaId: scope.kordaId ?? "__NO_ACCESS__" }) } });
      if (!existing) throw new AccessDeniedError("Profil eksternal tidak ditemukan dalam cakupan akses");
      if (scope.role !== "admin" && existing.status === "COMPLETE") {
        throw new AccessDeniedError("Profil yang sudah dilengkapi admin hanya dapat diperbarui oleh admin");
      }
      await prisma.externalParticipant.update({ where: { id }, data: { name, gender, address, status: "COMPLETE", updatedByUserId: scope.userId } });
    } else {
      await prisma.externalParticipant.create({ data: { name, gender, address, intendedKordaId, status: "COMPLETE", createdByUserId: scope.userId, updatedByUserId: scope.userId } });
    }
    revalidatePath("/peserta-eksternal");
    revalidatePath("/santri");
    redirect("/peserta-eksternal?notice=Profil+berhasil+disimpan");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`/peserta-eksternal?error=${encodeURIComponent(error instanceof Error ? error.message : "Gagal menyimpan profil eksternal")}`);
  }
}

export async function getExternalParticipantQueue() {
  const scope = await getRegionalAccessScope();
  const where = scope.role === "admin" ? {} : scope.role === "korwil" ? { intendedKorda: { korwilId: scope.korwilId ?? "__NO_ACCESS__" } } : { intendedKordaId: scope.kordaId ?? "__NO_ACCESS__" };
  return prisma.externalParticipant.findMany({ where, orderBy: [{ status: "asc" }, { updatedAt: "desc" }], include: { intendedKorda: { select: { id: true, name: true } } } });
}

/** Search only complete external profiles assigned to an authorized destination Korda. */
export async function searchCompleteExternalParticipants(query: string, intendedKordaId: string): Promise<StudentBasic[]> {
  const scope = await getRegionalAccessScope();
  await ensureKordaInScope(scope, intendedKordaId);
  const trimmed = query.trim();
  if (!trimmed) return [];
  const participants = await prisma.externalParticipant.findMany({
    where: {
      intendedKordaId,
      status: "COMPLETE",
      OR: [
        { name: { contains: trimmed, mode: "insensitive" } },
        { address: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, gender: true, address: true },
    orderBy: { name: "asc" },
    take: 50,
  });
  return participants.map((participant) => ({
    id: `external:${participant.id}`,
    externalParticipantId: participant.id,
    name: participant.name,
    nis: null,
    gender: normalizeExternalParticipantGender(participant.gender) ?? undefined,
    address: participant.address,
    regencyId: null,
    regency: null,
  }));
}

export async function createExternalParticipantFromRegistration(input: {
  intendedKordaId: string;
  name: string;
  gender?: string;
  address?: string;
}) {
  const scope = await getRegionalAccessScope();
  const name = input.name.trim();
  const gender = normalizeExternalParticipantGender(input.gender);
  const address = input.address?.trim() || null;
  if (input.gender?.trim() && !gender) {
    return { success: false as const, error: "Jenis kelamin harus Laki-laki atau Perempuan." };
  }
  if (!name || !gender || !address) {
    return { success: false as const, error: "Nama, jenis kelamin, dan alamat wajib diisi sebelum peserta eksternal disimpan." };
  }
  if (!input.intendedKordaId.trim()) {
    return { success: false as const, error: "Korda tujuan wajib dipilih sebelum profil eksternal disimpan." };
  }
  await ensureKordaInScope(scope, input.intendedKordaId);
  const participant = await prisma.externalParticipant.create({
    data: {
      name,
      gender,
      address,
      intendedKordaId: input.intendedKordaId,
      status: "COMPLETE",
      createdByUserId: scope.userId,
      updatedByUserId: scope.userId,
    },
    select: { id: true, name: true, gender: true, address: true, status: true, intendedKordaId: true },
  });
  revalidatePath("/peserta-eksternal");
  return { success: true as const, data: participant };
}

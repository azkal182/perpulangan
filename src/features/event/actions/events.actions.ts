"use server";

import { revalidatePath } from "next/cache";

import { failure, success, type Result } from "@/lib/result";
import prisma from "@/lib/prisma";
import { eventRepository } from "../repositories/event.repository";
import {
  eventCreateSchema,
  eventDeleteSchema,
  eventUpdateSchema,
  type EventCreateInput,
  type EventDeleteInput,
  type EventUpdateInput,
} from "../validators/event.validator";
import type { EventItem } from "../types";

export async function createEvent(
  input: EventCreateInput,
): Promise<Result<EventItem>> {
  const parsed = eventCreateSchema.safeParse(input);
  if (!parsed.success) return failure("Data event tidak valid.", parsed.error);

  try {
    const data = parsed.data;
    const startDate = new Date(`${data.startDate}T00:00:00`);
    const endDate = new Date(`${data.endDate}T00:00:00`);

    const created =
      data.status === "ACTIVE"
        ? await prisma.$transaction(async (tx) => {
            await tx.event.updateMany({
              where: { status: "ACTIVE" },
              data: { status: "COMPLETED" },
            });

            return tx.event.create({
              data: {
                name: data.name,
                startDate,
                endDate,
                status: "ACTIVE",
              },
              include: {
                _count: {
                  select: {
                    registrations: true,
                  },
                },
              },
            });
          })
        : await eventRepository.create({
            name: data.name,
            startDate,
            endDate,
            status: data.status,
          });

    revalidatePath("/event");
    revalidatePath("/registrasi");
    revalidatePath("/registrasi/kembali-saja");
    revalidatePath("/registrasi-kembali");
    revalidatePath("/daftar-peserta");
    revalidatePath("/dashboard");
    return success(created);
  } catch {
    return failure("Gagal membuat event.");
  }
}

export async function updateEvent(
  input: EventUpdateInput,
): Promise<Result<EventItem>> {
  const parsed = eventUpdateSchema.safeParse(input);
  if (!parsed.success) return failure("Data event tidak valid.", parsed.error);

  try {
    const data = parsed.data;
    const existing = await eventRepository.findById(data.id);
    if (!existing) return failure("Event tidak ditemukan.");

    const updated =
      data.status === "ACTIVE"
        ? await prisma.$transaction(async (tx) => {
            await tx.event.updateMany({
              where: {
                status: "ACTIVE",
                NOT: { id: data.id },
              },
              data: { status: "COMPLETED" },
            });

            return tx.event.update({
              where: { id: data.id },
              data: {
                name: data.name,
                startDate: new Date(`${data.startDate}T00:00:00`),
                endDate: new Date(`${data.endDate}T00:00:00`),
                status: "ACTIVE",
              },
              include: {
                _count: {
                  select: {
                    registrations: true,
                  },
                },
              },
            });
          })
        : await eventRepository.update(data.id, {
            name: data.name,
            startDate: new Date(`${data.startDate}T00:00:00`),
            endDate: new Date(`${data.endDate}T00:00:00`),
            status: data.status,
          });

    revalidatePath("/event");
    revalidatePath("/registrasi");
    revalidatePath("/registrasi/kembali-saja");
    revalidatePath("/registrasi-kembali");
    revalidatePath("/daftar-peserta");
    revalidatePath("/dashboard");
    return success(updated);
  } catch {
    return failure("Gagal memperbarui event.");
  }
}

export async function deleteEvent(
  input: EventDeleteInput,
): Promise<Result<EventItem>> {
  const parsed = eventDeleteSchema.safeParse(input);
  if (!parsed.success) return failure("Data event tidak valid.", parsed.error);

  try {
    const existing = await eventRepository.findById(parsed.data.id);
    if (!existing) return failure("Event tidak ditemukan.");

    const deleted = await eventRepository.delete(parsed.data.id);
    revalidatePath("/event");
    revalidatePath("/registrasi");
    revalidatePath("/registrasi/kembali-saja");
    revalidatePath("/registrasi-kembali");
    revalidatePath("/daftar-peserta");
    revalidatePath("/dashboard");
    return success(deleted);
  } catch {
    return failure("Gagal menghapus event.");
  }
}

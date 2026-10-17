"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logger } from "@/server/logger";
import {
  AccessDeniedError,
  andWhere,
  busScopeWhere,
  ensureKordaInScope,
  ensureKorwilInScope,
  getRegionalAccessScope,
  requireKorwilOrAdmin,
} from "@/server/access-scope";

export interface BusWithDetails {
  id: string;
  label: string;
  capacity: number;
  trackerId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  event: {
    id: string;
    name: string;
  };
  korwil: {
    id: string;
    name: string;
  } | null;
  kordas: Array<{
    id: string;
    kordaId: string;
    korda: {
      id: string;
      name: string;
    };
  }>;
  _count: {
    outboundRegistrations: number;
    returnRegistrations: number;
  };
  journeyAssignments: Array<{ journey: { direction: "OUTBOUND" | "RETURN"; status: "REGISTERED" | "CANCELLED"; destinationKordaId: string } }>;
}

/**
 * Get buses with filters
 */
export async function getBuses(params?: {
  eventId?: string;
  korwilId?: string;
  kordaId?: string;
}): Promise<BusWithDetails[]> {
  try {
    const scope = await getRegionalAccessScope();
    if (params?.korwilId) {
      await ensureKorwilInScope(scope, params.korwilId);
    }
    if (params?.kordaId) {
      await ensureKordaInScope(scope, params.kordaId);
    }

    const buses = await prisma.bus.findMany({
      where: andWhere(
        {
          ...(params?.eventId && { eventId: params.eventId }),
          ...(params?.korwilId && { korwilId: params.korwilId }),
          ...(params?.kordaId && {
            kordas: {
              some: {
                kordaId: params.kordaId,
              },
            },
          }),
        },
        busScopeWhere(scope),
      ),
      include: {
        event: {
          select: {
            id: true,
            name: true,
          },
        },
        korwil: {
          select: {
            id: true,
            name: true,
          },
        },
        kordas: {
          include: {
            korda: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            outboundRegistrations: true,
            returnRegistrations: true,
          },
        },
        journeyAssignments: {
          select: { journey: { select: { direction: true, status: true, destinationKordaId: true } } },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return buses;
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      throw new Error(error.message);
    }
    logger.error({ error, params }, "bus.getBuses.failed");
    throw new Error("Failed to fetch buses");
  }
}

/**
 * Create a local fleet bus. Tracker synchronization is intentionally optional.
 */
export async function createBus(data: {
  eventId: string;
  korwilId?: string | null;
  kordaIds: string[];
  label: string;
  capacity: number;
}): Promise<{ id: string; trackerId: null }> {
  try {
    if (!Number.isInteger(data.capacity) || (data.capacity ?? 0) < 1) {
      throw new Error("Kapasitas bus wajib minimal 1 kursi");
    }
    if (!data.label.trim() || data.kordaIds.length === 0) {
      throw new Error("Label bus dan minimal satu Korda wajib diisi");
    }
    const scope = await getRegionalAccessScope();
    requireKorwilOrAdmin(scope);
    if (data.korwilId) {
      await ensureKorwilInScope(scope, data.korwilId);
    }
    for (const kordaId of data.kordaIds) {
      await ensureKordaInScope(scope, kordaId);
    }

    const eventExists = await prisma.event.count({ where: { id: data.eventId } });
    if (!eventExists) throw new Error("Event tidak ditemukan");

    // Create bus in database
    const bus = await prisma.bus.create({
      data: {
        label: data.label,
        capacity: data.capacity,
        eventId: data.eventId,
        korwilId: data.korwilId || null,
        kordas: {
          create: data.kordaIds.map((kordaId) => ({
            kordaId,
          })),
        },
      },
    });

    logger.info({ busId: bus.id }, "bus.created");
    revalidatePath("/rombongan");

    return { id: bus.id, trackerId: null };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      throw new Error(error.message);
    }
    logger.error({ error, data }, "bus.create.failed");
    throw error;
  }
}

/**
 * Update bus
 */
export async function updateBus(
  id: string,
  data: {
    label?: string;
    korwilId?: string | null;
    kordaIds?: string[];
    capacity?: number;
  },
): Promise<void> {
  try {
    const scope = await getRegionalAccessScope();
    requireKorwilOrAdmin(scope);
    const existing = await prisma.bus.findFirst({
      where: andWhere({ id }, busScopeWhere(scope)),
      select: { id: true },
    });
    if (!existing) {
      throw new Error("Bus tidak ditemukan");
    }

    if (data.capacity !== undefined && (!Number.isInteger(data.capacity) || data.capacity < 1)) {
      throw new Error("Kapasitas bus wajib minimal 1 kursi");
    }

    if (data.korwilId) {
      await ensureKorwilInScope(scope, data.korwilId);
    }
    if (data.kordaIds) {
      for (const kordaId of data.kordaIds) {
        await ensureKordaInScope(scope, kordaId);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Bus" WHERE "id" = ${id} FOR UPDATE`;
      if (data.capacity !== undefined) {
        const [outboundCount, returnCount] = await Promise.all([
          tx.journeyBusAssignment.count({ where: { busId: id, journey: { status: "REGISTERED", direction: "OUTBOUND" } } }),
          tx.journeyBusAssignment.count({ where: { busId: id, journey: { status: "REGISTERED", direction: "RETURN" } } }),
        ]);
        const assignedCount = Math.max(outboundCount, returnCount);
        if (data.capacity < assignedCount) {
          throw new Error(`Kapasitas tidak dapat kurang dari ${assignedCount} peserta yang sudah dialokasikan`);
        }
      }
      if (data.kordaIds) {
        const incompatible = await tx.journeyBusAssignment.count({
          where: {
            busId: id,
            journey: { status: "REGISTERED", destinationKordaId: { notIn: data.kordaIds } },
          },
        });
        if (incompatible > 0) {
          throw new Error("Korda bus tidak dapat diubah karena masih ada peserta teralokasi dengan tujuan tersebut");
        }
      }
      // Update bus basic info
      await tx.bus.update({
        where: { id },
        data: {
          ...(data.label && { label: data.label }),
          ...(data.korwilId !== undefined && { korwilId: data.korwilId }),
          ...(data.capacity !== undefined && { capacity: data.capacity }),
        },
      });

      // Update kordas if provided
      if (data.kordaIds) {
        // Delete existing kordas
        await tx.busKorda.deleteMany({
          where: { busId: id },
        });

        // Create new kordas
        await tx.busKorda.createMany({
          data: data.kordaIds.map((kordaId) => ({
            busId: id,
            kordaId,
          })),
        });
      }
    });

    logger.info({ busId: id }, "bus.updated");
    revalidatePath("/rombongan");
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      throw new Error(error.message);
    }
    logger.error({ error, busId: id, data }, "bus.update.failed");
    throw error instanceof Error ? error : new Error("Gagal memperbarui bus");
  }
}

/**
 * Toggle bus active status. Fleet planning is local and does not depend on Tracker.
 */
export async function toggleBusActive(id: string): Promise<void> {
  try {
    const scope = await getRegionalAccessScope();
    requireKorwilOrAdmin(scope);
    const bus = await prisma.bus.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!bus) {
      throw new Error("Bus not found");
    }

    const canAccess = await prisma.bus.count({
      where: andWhere({ id: bus.id }, busScopeWhere(scope)),
    });
    if (!canAccess) {
      throw new AccessDeniedError("Bus di luar cakupan akses");
    }

    const newStatus = !bus.isActive;

    // Update in database
    await prisma.bus.update({
      where: { id },
      data: { isActive: newStatus },
    });

    logger.info({ busId: id, isActive: newStatus }, "bus.status.toggled");
    revalidatePath("/rombongan");
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      throw new Error(error.message);
    }
    logger.error({ error, busId: id }, "bus.toggleActive.failed");
    throw new Error("Failed to toggle bus status");
  }
}

/**
 * Delete bus
 */
export async function deleteBus(id: string): Promise<void> {
  try {
    const scope = await getRegionalAccessScope();
    requireKorwilOrAdmin(scope);
    const bus = await prisma.bus.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!bus) {
      throw new Error("Bus not found");
    }

    const canAccess = await prisma.bus.count({
      where: andWhere({ id: bus.id }, busScopeWhere(scope)),
    });
    if (!canAccess) {
      throw new AccessDeniedError("Bus di luar cakupan akses");
    }

    const hasAssignments = await prisma.journeyBusAssignment.count({ where: { busId: id } });
    if (hasAssignments > 0) {
      throw new Error("Bus masih memiliki penempatan peserta. Hapus penempatan peserta terlebih dahulu.");
    }

    // Delete from database (cascade deletes BusKorda)
    await prisma.bus.delete({
      where: { id },
    });

    logger.info({ busId: id }, "bus.deleted");
    revalidatePath("/rombongan");
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      throw new Error(error.message);
    }
    logger.error({ error, busId: id }, "bus.delete.failed");
    throw new Error("Failed to delete bus");
  }
}

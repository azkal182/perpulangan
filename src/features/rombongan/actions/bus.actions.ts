"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logger } from "@/server/logger";
import { trackerApi } from "@/services/tracker-api.service";
import {
  AccessDeniedError,
  andWhere,
  busScopeWhere,
  ensureKordaInScope,
  ensureKorwilInScope,
  getRegionalAccessScope,
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
 * Create bus with tracker integration
 */
export async function createBus(data: {
  eventId: string;
  korwilId?: string | null;
  kordaIds: string[];
  label: string;
  capacity?: number;
}): Promise<{ id: string; trackerId: string }> {
  try {
    const scope = await getRegionalAccessScope();
    if (data.korwilId) {
      await ensureKorwilInScope(scope, data.korwilId);
    }
    for (const kordaId of data.kordaIds) {
      await ensureKordaInScope(scope, kordaId);
    }

    // Get event details for tracker API
    const event = await prisma.event.findUnique({
      where: { id: data.eventId },
      select: {
        id: true,
        name: true,
        trackerEventId: true,
      },
    });

    if (!event) {
      throw new Error("Event not found");
    }

    if (!event.trackerEventId) {
      throw new Error(
        "Event belum di-sync ke tracker API. Silakan sync event terlebih dahulu.",
      );
    }

    // Create tracker in tracker API
    const trackerId = await trackerApi.createTracker({
      eventId: event.trackerEventId,
      label: data.label,
      kind: "bus",
    });

    // Create bus in database
    const bus = await prisma.bus.create({
      data: {
        label: data.label,
        capacity: data.capacity ?? 0,
        trackerId,
        eventId: data.eventId,
        korwilId: data.korwilId || null,
        kordas: {
          create: data.kordaIds.map((kordaId) => ({
            kordaId,
          })),
        },
      },
    });

    logger.info({ busId: bus.id, trackerId }, "bus.created");
    revalidatePath("/rombongan");

    return { id: bus.id, trackerId };
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
    const existing = await prisma.bus.findFirst({
      where: andWhere({ id }, busScopeWhere(scope)),
      select: { id: true },
    });
    if (!existing) {
      throw new Error("Bus tidak ditemukan");
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
    throw new Error("Failed to update bus");
  }
}

/**
 * Toggle bus active status (syncs to tracker API)
 */
export async function toggleBusActive(id: string): Promise<void> {
  try {
    const scope = await getRegionalAccessScope();
    const bus = await prisma.bus.findUnique({
      where: { id },
      select: { id: true, trackerId: true, isActive: true },
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

    // Sync to tracker API if trackerId exists
    if (bus.trackerId) {
      await trackerApi.updateTrackerStatus(bus.trackerId, newStatus);
    }

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
 * Delete bus (deactivates tracker)
 */
export async function deleteBus(id: string): Promise<void> {
  try {
    const scope = await getRegionalAccessScope();
    const bus = await prisma.bus.findUnique({
      where: { id },
      select: { id: true, trackerId: true },
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

    // Deactivate in tracker API first
    if (bus.trackerId) {
      await trackerApi.updateTrackerStatus(bus.trackerId, false);
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

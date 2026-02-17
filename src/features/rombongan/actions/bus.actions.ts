"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logger } from "@/server/logger";
import { trackerApi } from "@/services/tracker-api.service";

export interface BusWithDetails {
  id: string;
  label: string;
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
    const buses = await prisma.bus.findMany({
      where: {
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
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return buses;
  } catch (error) {
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
}): Promise<{ id: string; trackerId: string }> {
  try {
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
  },
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      // Update bus basic info
      await tx.bus.update({
        where: { id },
        data: {
          ...(data.label && { label: data.label }),
          ...(data.korwilId !== undefined && { korwilId: data.korwilId }),
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
    logger.error({ error, busId: id, data }, "bus.update.failed");
    throw new Error("Failed to update bus");
  }
}

/**
 * Toggle bus active status (syncs to tracker API)
 */
export async function toggleBusActive(id: string): Promise<void> {
  try {
    const bus = await prisma.bus.findUnique({
      where: { id },
      select: { trackerId: true, isActive: true },
    });

    if (!bus) {
      throw new Error("Bus not found");
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
    logger.error({ error, busId: id }, "bus.toggleActive.failed");
    throw new Error("Failed to toggle bus status");
  }
}

/**
 * Delete bus (deactivates tracker)
 */
export async function deleteBus(id: string): Promise<void> {
  try {
    const bus = await prisma.bus.findUnique({
      where: { id },
      select: { trackerId: true },
    });

    if (!bus) {
      throw new Error("Bus not found");
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
    logger.error({ error, busId: id }, "bus.delete.failed");
    throw new Error("Failed to delete bus");
  }
}

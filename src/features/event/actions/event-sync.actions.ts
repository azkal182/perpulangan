"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logger } from "@/server/logger";
import { trackerApi } from "@/services/tracker-api.service";

/**
 * Sync event to tracker API
 */
export async function syncEventToTracker(eventId: string): Promise<{
  success: boolean;
  trackerEventId?: string;
  message: string;
}> {
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        trackerEventId: true,
      },
    });

    if (!event) {
      return {
        success: false,
        message: "Event not found",
      };
    }

    // Check if already synced
    if (event.trackerEventId) {
      return {
        success: true,
        trackerEventId: event.trackerEventId,
        message: "Event already synced to tracker API",
      };
    }

    // Create event in tracker API
    const trackerEventId = await trackerApi.createEvent({
      name: event.name,
      startAt: event.startDate,
      endAt: event.endDate,
    });

    // Update event with tracker event ID
    await prisma.event.update({
      where: { id: eventId },
      data: {
        trackerEventId,
        trackerSyncAt: new Date(),
      },
    });

    logger.info({ eventId, trackerEventId }, "event.syncedToTracker");
    revalidatePath("/master/events");

    return {
      success: true,
      trackerEventId,
      message: "Event successfully synced to tracker API",
    };
  } catch (error) {
    logger.error({ error, eventId }, "event.syncToTracker.failed");
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to sync event",
    };
  }
}

/**
 * Get event tracker sync status
 */
export async function getEventTrackerStatus(eventId: string): Promise<{
  synced: boolean;
  trackerEventId?: string | null;
  syncedAt?: Date | null;
}> {
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        trackerEventId: true,
        trackerSyncAt: true,
      },
    });

    if (!event) {
      return { synced: false };
    }

    return {
      synced: !!event.trackerEventId,
      trackerEventId: event.trackerEventId,
      syncedAt: event.trackerSyncAt,
    };
  } catch (error) {
    logger.error({ error, eventId }, "event.getTrackerStatus.failed");
    return { synced: false };
  }
}

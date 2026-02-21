"use server";

import prisma from "@/lib/prisma";
import { logger } from "@/server/logger";
import {
  trackerApi,
  type MonitoringData,
} from "@/services/tracker-api.service";
import {
  AccessDeniedError,
  andWhere,
  busScopeWhere,
  ensureKordaInScope,
  getRegionalAccessScope,
  kordaScopeWhere,
} from "@/server/access-scope";

/**
 * Get events that have been synced to tracker API (for dropdown)
 */
export async function getTrackingEvents() {
  try {
    const scope = await getRegionalAccessScope();
    const eventWhere = {
      trackerEventId: {
        not: null,
      },
      ...(scope.role === "admin"
        ? {}
        : {
            buses: {
              some: busScopeWhere(scope),
            },
          }),
    };

    const events = await prisma.event.findMany({
      where: eventWhere,
      select: {
        id: true,
        name: true,
        trackerEventId: true,
        startDate: true,
        endDate: true,
      },
      orderBy: {
        startDate: "desc",
      },
    });

    return events;
  } catch (error) {
    logger.error({ error }, "tracking.getEvents.failed");
    return [];
  }
}

/**
 * Get buses for tracking with tracker IDs and korda info
 */
export async function getBusesForTracking(params: {
  eventId: string;
  kordaId?: string;
}) {
  try {
    const scope = await getRegionalAccessScope();
    if (params.kordaId) {
      await ensureKordaInScope(scope, params.kordaId);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      eventId: params.eventId,
      trackerId: {
        not: null,
      },
    };

    if (params.kordaId) {
      where.kordas = {
        some: {
          kordaId: params.kordaId,
        },
      };
    }

    const buses = await prisma.bus.findMany({
      where: andWhere(where, busScopeWhere(scope)),
      select: {
        id: true,
        label: true,
        trackerId: true,
        isActive: true,
        korwil: {
          select: {
            id: true,
            name: true,
          },
        },
        kordas: {
          select: {
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
        label: "asc",
      },
    });

    return buses.map((bus) => ({
      ...bus,
      kordas: bus.kordas.map((bk) => bk.korda),
    }));
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return [];
    }
    logger.error(
      { error, eventId: params.eventId },
      "tracking.getBuses.failed",
    );
    return [];
  }
}

/**
 * Get real-time GPS positions for all trackers in an event
 */
export async function getGPSPositions(eventId: string): Promise<{
  success: boolean;
  data: MonitoringData[];
  message?: string;
}> {
  try {
    const scope = await getRegionalAccessScope();
    const canAccess = await prisma.bus.count({
      where: andWhere({ eventId }, busScopeWhere(scope)),
    });
    if (!canAccess) {
      return {
        success: false,
        data: [],
        message: "Event di luar cakupan akses",
      };
    }

    // Get event's trackerEventId
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { trackerEventId: true },
    });

    if (!event?.trackerEventId) {
      return {
        success: false,
        data: [],
        message: "Event not synced to tracker API",
      };
    }

    // Fetch monitoring data from tracker API
    const positions = await trackerApi.getMonitoring(event.trackerEventId);

    console.log(JSON.stringify(positions, null, 2));

    return {
      success: true,
      data: positions,
    };
  } catch (error) {
    logger.error({ error, eventId }, "tracking.getGPSPositions.failed");
    return {
      success: false,
      data: [],
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch GPS positions",
    };
  }
}

/**
 * Get all kordas for filter dropdown
 */
export async function getKordasForFilter() {
  try {
    const scope = await getRegionalAccessScope();
    const kordas = await prisma.korda.findMany({
      where: kordaScopeWhere(scope),
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return kordas;
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return [];
    }
    logger.error({ error }, "tracking.getKordas.failed");
    return [];
  }
}

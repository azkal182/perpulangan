import prisma from "@/lib/prisma";
import { logger } from "@/server/logger";
import type { EventItem, EventStatus } from "../types";

export type EventCreateData = {
  name: string;
  startDate: Date;
  endDate: Date;
  status: EventStatus;
};

export type EventUpdateData = EventCreateData;

const eventSelect = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      registrations: true,
    },
  },
};

type PaymentSummary = {
  totalDue: number;
  totalPaid: number;
  outboundDue: number;
  outboundPaid: number;
  returnDue: number;
  returnPaid: number;
};

type EventWithPayment = EventItem & { payment: PaymentSummary };

const toNum = (v: bigint | number | null | undefined) => Number(v ?? 0);

async function getPaymentSummaryByEventIds(
  eventIds: string[],
): Promise<Record<string, PaymentSummary>> {
  if (eventIds.length === 0) return {};

  const rows = await prisma.$queryRaw<
    Array<{
      event_id: string;
      total_due: bigint | null;
      total_paid: bigint | null;
      outbound_due: bigint | null;
      outbound_paid: bigint | null;
      return_due: bigint | null;
      return_paid: bigint | null;
    }>
  >`
    SELECT
      r."eventId"::text AS event_id,

      COALESCE(SUM(COALESCE(od.price, 0) + COALESCE(rd.price, 0)), 0) AS total_due,
      COALESCE(SUM(
        (CASE WHEN r."outboundPaid" THEN COALESCE(od.price, 0) ELSE 0 END) +
        (CASE WHEN r."returnPaid" THEN COALESCE(rd.price, 0) ELSE 0 END)
      ), 0) AS total_paid,

      COALESCE(SUM(COALESCE(od.price, 0)), 0) AS outbound_due,
      COALESCE(SUM(CASE WHEN r."outboundPaid" THEN COALESCE(od.price, 0) ELSE 0 END), 0) AS outbound_paid,

      COALESCE(SUM(COALESCE(rd.price, 0)), 0) AS return_due,
      COALESCE(SUM(CASE WHEN r."returnPaid" THEN COALESCE(rd.price, 0) ELSE 0 END), 0) AS return_paid
    FROM "Registration" r
    LEFT JOIN "DropPoint" od ON od.id = r."outboundDropPointId"
    LEFT JOIN "DropPoint" rd ON rd.id = r."returnDropPointId"
    WHERE r."eventId"::text = ANY(${eventIds}::text[])
      AND r.status <> 'CANCELLED'
    GROUP BY r."eventId";
  `;

  const map: Record<string, PaymentSummary> = {};
  for (const row of rows) {
    map[row.event_id] = {
      totalDue: toNum(row.total_due),
      totalPaid: toNum(row.total_paid),
      outboundDue: toNum(row.outbound_due),
      outboundPaid: toNum(row.outbound_paid),
      returnDue: toNum(row.return_due),
      returnPaid: toNum(row.return_paid),
    };
  }

  return map;
}

export const eventRepository = {
  async findMany(): Promise<EventWithPayment[]> {
    try {
      const items = await prisma.event.findMany({
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        select: eventSelect,
      });

      const ids = items.map((e) => e.id);
      const paymentMap = await getPaymentSummaryByEventIds(ids);

      const enriched: EventWithPayment[] = items.map((e) => ({
        ...e,
        payment: paymentMap[e.id] ?? {
          totalDue: 0,
          totalPaid: 0,
          outboundDue: 0,
          outboundPaid: 0,
          returnDue: 0,
          returnPaid: 0,
        },
      }));

      logger.debug(
        { count: enriched.length },
        "eventRepository.findMany success (with payment summary)",
      );
      return enriched;
    } catch (error) {
      logger.error({ err: error }, "eventRepository.findMany failed");
      throw error;
    }
  },

  async findById(id: string): Promise<EventWithPayment | null> {
    try {
      const item = await prisma.event.findUnique({
        where: { id },
        select: eventSelect,
      });

      if (!item) {
        logger.debug({ id, found: false }, "eventRepository.findById success");
        return null;
      }

      const paymentMap = await getPaymentSummaryByEventIds([id]);

      const enriched: EventWithPayment = {
        ...item,
        payment: paymentMap[id] ?? {
          totalDue: 0,
          totalPaid: 0,
          outboundDue: 0,
          outboundPaid: 0,
          returnDue: 0,
          returnPaid: 0,
        },
      };

      logger.debug(
        { id, found: true },
        "eventRepository.findById success (with payment summary)",
      );
      return enriched;
    } catch (error) {
      logger.error({ err: error, id }, "eventRepository.findById failed");
      throw error;
    }
  },

  async create(data: EventCreateData): Promise<EventItem> {
    try {
      const result = await prisma.event.create({
        data: {
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          status: data.status,
        },
        select: eventSelect,
      });
      logger.info(
        { id: result.id, name: result.name },
        "eventRepository.create success",
      );
      return result;
    } catch (error) {
      logger.error({ err: error, data }, "eventRepository.create failed");
      throw error;
    }
  },

  async update(id: string, data: EventUpdateData): Promise<EventItem> {
    try {
      const result = await prisma.event.update({
        where: { id },
        data: {
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          status: data.status,
        },
        select: eventSelect,
      });
      logger.info({ id: result.id }, "eventRepository.update success");
      return result;
    } catch (error) {
      logger.error({ err: error, id, data }, "eventRepository.update failed");
      throw error;
    }
  },

  async delete(id: string): Promise<EventItem> {
    try {
      const result = await prisma.event.delete({
        where: { id },
        select: eventSelect,
      });
      logger.info({ id: result.id }, "eventRepository.delete success");
      return result;
    } catch (error) {
      logger.error({ err: error, id }, "eventRepository.delete failed");
      throw error;
    }
  },
};

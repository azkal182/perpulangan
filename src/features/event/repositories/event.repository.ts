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
};

export const eventRepository = {
  async findMany(): Promise<EventItem[]> {
    try {
      const items = await prisma.event.findMany({
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        select: eventSelect,
      });
      logger.debug({ count: items.length }, "eventRepository.findMany success");
      return items;
    } catch (error) {
      logger.error({ err: error }, "eventRepository.findMany failed");
      throw error;
    }
  },

  async findById(id: string): Promise<EventItem | null> {
    try {
      const item = await prisma.event.findUnique({
        where: { id },
        select: eventSelect,
      });
      logger.debug({ id, found: !!item }, "eventRepository.findById success");
      return item;
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
      logger.info({ id: result.id, name: result.name }, "eventRepository.create success");
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

import prisma from "@/lib/prisma";
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
    return prisma.event.findMany({
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: eventSelect,
    });
  },

  async findById(id: string): Promise<EventItem | null> {
    return prisma.event.findUnique({
      where: { id },
      select: eventSelect,
    });
  },

  async create(data: EventCreateData): Promise<EventItem> {
    return prisma.event.create({
      data: {
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status,
      },
      select: eventSelect,
    });
  },

  async update(id: string, data: EventUpdateData): Promise<EventItem> {
    return prisma.event.update({
      where: { id },
      data: {
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status,
      },
      select: eventSelect,
    });
  },

  async delete(id: string): Promise<EventItem> {
    return prisma.event.delete({
      where: { id },
      select: eventSelect,
    });
  },
};

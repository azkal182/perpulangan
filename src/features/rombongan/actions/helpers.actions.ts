"use server";

import prisma from "@/lib/prisma";

export async function getAllEvents() {
  return await prisma.event.findMany({
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
      trackerEventId: true,
      trackerSyncAt: true,
    },
    orderBy: {
      startDate: "desc",
    },
  });
}

export async function getAllKordas() {
  return await prisma.korda.findMany({
    select: {
      id: true,
      name: true,
      korwil: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function getAllKorwils() {
  return await prisma.korwil.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

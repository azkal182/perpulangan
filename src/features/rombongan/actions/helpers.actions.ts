"use server";

import prisma from "@/lib/prisma";
import {
  getRegionalAccessScope,
  kordaScopeWhere,
  korwilScopeWhere,
} from "@/server/access-scope";

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
  const scope = await getRegionalAccessScope();
  return await prisma.korda.findMany({
    where: kordaScopeWhere(scope),
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
  const scope = await getRegionalAccessScope();
  return await prisma.korwil.findMany({
    where: korwilScopeWhere(scope),
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

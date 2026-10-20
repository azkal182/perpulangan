import "server-only";

import { cookies } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/server/db/prisma";
import { getRegionalAccessScope, type RegionalAccessScope } from "@/server/access-scope";

export const EVENT_SELECTION_COOKIE = "mabarati-selected-event";

export type EventOption = {
  id: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED";
  startDate: Date;
  endDate: Date;
};

function eventScope(scope: RegionalAccessScope): Prisma.EventWhereInput {
  if (scope.role === "admin") return {};

  const destinationKorda = scope.role === "korwil"
    ? { korwilId: scope.korwilId ?? "__NO_ACCESS__" }
    : { id: scope.kordaId ?? "__NO_ACCESS__" };

  return {
    OR: [
      { status: "ACTIVE" },
      {
        registrations: {
          some: {
            journeys: {
              some: { destinationKorda },
            },
          },
        },
      },
    ],
  };
}

export async function getEventContext(scope: RegionalAccessScope) {
  const events = await prisma.event.findMany({
    where: eventScope(scope),
    select: { id: true, name: true, status: true, startDate: true, endDate: true },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  }) as EventOption[];

  const activeEvent = events.find((event) => event.status === "ACTIVE") ?? null;
  const store = await cookies();
  const cookieValue = store.get(EVENT_SELECTION_COOKIE)?.value ?? "";
  const [savedUserId, requestedId] = cookieValue.split(":", 2);
  const userSelection = savedUserId === scope.userId ? requestedId : undefined;
  const selectedEvent = events.find((event) => event.id === userSelection) ?? activeEvent;

  // Keep ACTIVE at the top of the menu while retaining useful historical ordering.
  events.sort((a, b) => Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE")
    || b.startDate.getTime() - a.startDate.getTime());

  return { events, activeEvent, selectedEvent: selectedEvent ?? null };
}

export async function getGlobalEventContext() {
  const scope = await getRegionalAccessScope();
  return getEventContext(scope);
}

export async function canSelectEvent(scope: RegionalAccessScope, eventId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, ...eventScope(scope) },
    select: { id: true },
  });
  return Boolean(event);
}

export function eventBalanceEntryWhere(eventId: string): Prisma.KordaBalanceEntryWhereInput {
  return {
    OR: [
      { sourcePaymentAllocation: { payment: { eventId } } },
      {
        sourceRefund: {
          OR: [
            { paymentAllocation: { payment: { eventId } } },
            { balanceSourceEntry: { sourcePaymentAllocation: { payment: { eventId } } } },
          ],
        },
      },
      { sourceCorrection: { eventId } },
    ],
  };
}

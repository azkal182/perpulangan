"use server";

import { cookies } from "next/headers";
import { getRegionalAccessScope } from "@/server/access-scope";
import { canSelectEvent, EVENT_SELECTION_COOKIE } from "@/server/event-context";

export async function setGlobalEventSelection(eventId: string) {
  const scope = await getRegionalAccessScope();
  const store = await cookies();

  if (eventId && !(await canSelectEvent(scope, eventId))) {
    return { success: false as const, error: "Event tidak tersedia dalam cakupan akun Anda." };
  }

  if (eventId) {
    store.set(EVENT_SELECTION_COOKIE, `${scope.userId}:${eventId}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    store.delete(EVENT_SELECTION_COOKIE);
  }

  return { success: true as const };
}

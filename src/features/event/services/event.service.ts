"use server";

import { eventRepository } from "../repositories/event.repository";
import { logger } from "@/server/logger";

export async function getEvent() {
  try {
    const data = await eventRepository.findMany();
    return { success: true, data };
  } catch (error) {
    logger.error({ err: error }, "getEvent action failed");
    return { success: false, error: "Failed to fetch events" };
  }
}

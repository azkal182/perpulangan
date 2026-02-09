"use server";

import { revalidatePath } from "next/cache";
import { dropPointRepository, type DropPointCreateData, type DropPointUpdateData } from "../repositories/drop-point.repository";
import { logger } from "@/server/logger";

export async function getDropPoints(kordaId?: string) {
  try {
    const data = await dropPointRepository.findMany({ kordaId });
    return { success: true, data };
  } catch (error) {
    logger.error({ err: error, kordaId }, "getDropPoints action failed");
    return { success: false, error: "Failed to fetch drop points" };
  }
}

export async function createDropPoint(data: DropPointCreateData) {
  try {
    const result = await dropPointRepository.create(data);
    revalidatePath("/titik_turun");
    return { success: true, data: result };
  } catch (error) {
    logger.error({ err: error, data }, "createDropPoint action failed");
    return { success: false, error: "Failed to create drop point" };
  }
}

export async function updateDropPoint(id: string, data: DropPointUpdateData) {
  try {
    const result = await dropPointRepository.update(id, data);
    revalidatePath("/titik_turun");
    return { success: true, data: result };
  } catch (error) {
    logger.error({ err: error, id, data }, "updateDropPoint action failed");
    return { success: false, error: "Failed to update drop point" };
  }
}

export async function deleteDropPoint(id: string) {
  try {
    const result = await dropPointRepository.delete(id);
    revalidatePath("/titik_turun");
    return { success: true, data: result };
  } catch (error) {
    logger.error({ err: error, id }, "deleteDropPoint action failed");
    return { success: false, error: "Failed to delete drop point" };
  }
}

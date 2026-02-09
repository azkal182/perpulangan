"use server";

import { revalidatePath } from "next/cache";
import {
  registrationRepository,
  type RegistrationCreateData,
  type RegistrationUpdateData,
} from "../repositories/registration.repository";
import { logger } from "@/server/logger";
import { RegistrationStatus } from "@/generated/prisma/client";

export async function getRegistrations(params?: {
  eventId?: string;
  studentId?: string;
  status?: RegistrationStatus;
}) {
  try {
    const data = await registrationRepository.findMany(params);
    return { success: true, data };
  } catch (error) {
    logger.error({ err: error, params }, "getRegistrations action failed");
    return { success: false, error: "Failed to fetch registrations" };
  }
}

export async function getRegistrationById(id: string) {
  try {
    const data = await registrationRepository.findById(id);
    if (!data) {
      return { success: false, error: "Registration not found" };
    }
    return { success: true, data };
  } catch (error) {
    logger.error({ err: error, id }, "getRegistrationById action failed");
    return { success: false, error: "Failed to fetch registration" };
  }
}

export async function createRegistration(data: RegistrationCreateData) {
  try {
    //Check for duplicate registration
    const existing = await registrationRepository.findMany({
      eventId: data.eventId,
      studentId: data.studentId,
    });

    if (existing.length > 0) {
      return {
        success: false,
        error: "Student already registered for this event",
      };
    }

    // Log warning if Korda changed but not confirmed
    if (data.kordaChanged && !data.kordaChangeConfirmed) {
      logger.warn(
        { studentId: data.studentId, eventId: data.eventId },
        "Registration created with Korda change but not confirmed"
      );
    }

    const result = await registrationRepository.create(data);
    revalidatePath("/registrasi");
    revalidatePath(`/event/${data.eventId}/participants`);
    return { success: true, data: result };
  } catch (error) {
    logger.error({ err: error, data }, "createRegistration action failed");
    return { success: false, error: "Failed to create registration" };
  }
}

export async function updateRegistration(
  id: string,
  data: RegistrationUpdateData
) {
  try {
    const result = await registrationRepository.update(id, data);
    revalidatePath("/registrasi");
    revalidatePath(`/event/${result.eventId}/participants`);
    return { success: true, data: result };
  } catch (error) {
    logger.error({ err: error, id, data }, "updateRegistration action failed");
    return { success: false, error: "Failed to update registration" };
  }
}

export async function deleteRegistration(id: string) {
  try {
    const result = await registrationRepository.delete(id);
    revalidatePath("/registrasi");
    return { success: true, data: result };
  } catch (error) {
    logger.error({ err: error, id }, "deleteRegistration action failed");
    return { success: false, error: "Failed to delete registration" };
  }
}

export async function confirmKordaChange(id: string) {
  try {
    const result = await registrationRepository.update(id, {
      kordaChangeConfirmed: true,
    });
    logger.info(
      { id, studentId: result.studentId },
      "Korda change confirmed for registration"
    );
    revalidatePath("/registrasi");
    return { success: true, data: result };
  } catch (error) {
    logger.error({ err: error, id }, "confirmKordaChange action failed");
    return { success: false, error: "Failed to confirm Korda change" };
  }
}

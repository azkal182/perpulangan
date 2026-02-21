"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import {
  registrationRepository,
  type RegistrationCreateData,
  type RegistrationUpdateData,
} from "../repositories/registration.repository";
import { logger } from "@/server/logger";
import { RegistrationStatus } from "@/generated/prisma/client";
import {
  AccessDeniedError,
  andWhere,
  ensureKordaInScope,
  getRegionalAccessScope,
  registrationScopeWhere,
  studentScopeWhere,
} from "@/server/access-scope";

export async function getRegistrations(params?: {
  eventId?: string;
  studentId?: string;
  status?: RegistrationStatus;
}) {
  try {
    const scope = await getRegionalAccessScope();
    const data = await registrationRepository.findMany({
      ...params,
      where: registrationScopeWhere(scope),
    });
    return { success: true, data };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    logger.error({ err: error, params }, "getRegistrations action failed");
    return { success: false, error: "Failed to fetch registrations" };
  }
}

export async function getRegistrationById(id: string) {
  try {
    const scope = await getRegionalAccessScope();
    const data = await registrationRepository.findById(
      id,
      registrationScopeWhere(scope),
    );
    if (!data) {
      return { success: false, error: "Registration not found" };
    }
    return { success: true, data };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    logger.error({ err: error, id }, "getRegistrationById action failed");
    return { success: false, error: "Failed to fetch registration" };
  }
}

export async function createRegistration(data: RegistrationCreateData) {
  try {
    const scope = await getRegionalAccessScope();

    if (data.outboundKordaId) {
      await ensureKordaInScope(scope, data.outboundKordaId);
    }
    if (data.returnKordaId) {
      await ensureKordaInScope(scope, data.returnKordaId);
    }

    const student = await prisma.student.findFirst({
      where: andWhere({ id: data.studentId }, studentScopeWhere(scope)),
      select: { id: true },
    });
    if (!student) {
      return { success: false, error: "Santri tidak ditemukan atau di luar cakupan akses" };
    }

    //Check for duplicate registration
    const existing = await registrationRepository.findMany({
      eventId: data.eventId,
      studentId: data.studentId,
      where: registrationScopeWhere(scope),
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
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    logger.error({ err: error, data }, "createRegistration action failed");
    return { success: false, error: "Failed to create registration" };
  }
}

export async function updateRegistration(
  id: string,
  data: RegistrationUpdateData
) {
  try {
    const scope = await getRegionalAccessScope();
    const existing = await registrationRepository.findById(
      id,
      registrationScopeWhere(scope),
    );
    if (!existing) {
      return { success: false, error: "Registration not found" };
    }

    if (data.outboundKordaId) {
      await ensureKordaInScope(scope, data.outboundKordaId);
    }
    if (data.returnKordaId) {
      await ensureKordaInScope(scope, data.returnKordaId);
    }

    const result = await registrationRepository.update(id, data);
    revalidatePath("/registrasi");
    revalidatePath(`/event/${result.eventId}/participants`);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    logger.error({ err: error, id, data }, "updateRegistration action failed");
    return { success: false, error: "Failed to update registration" };
  }
}

export async function deleteRegistration(id: string) {
  try {
    const scope = await getRegionalAccessScope();
    const existing = await registrationRepository.findById(
      id,
      registrationScopeWhere(scope),
    );
    if (!existing) {
      return { success: false, error: "Registration not found" };
    }

    const result = await registrationRepository.delete(id);
    revalidatePath("/registrasi");
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    logger.error({ err: error, id }, "deleteRegistration action failed");
    return { success: false, error: "Failed to delete registration" };
  }
}

export async function confirmKordaChange(id: string) {
  try {
    const scope = await getRegionalAccessScope();
    const existing = await registrationRepository.findById(
      id,
      registrationScopeWhere(scope),
    );
    if (!existing) {
      return { success: false, error: "Registration not found" };
    }

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
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    logger.error({ err: error, id }, "confirmKordaChange action failed");
    return { success: false, error: "Failed to confirm Korda change" };
  }
}

export async function cancelRegistration(
  id: string,
  type: 'full' | 'partial',
  reason: string,
  refundAmount: number
) {
  try {
    const scope = await getRegionalAccessScope();
    const registration = await registrationRepository.findById(
      id,
      registrationScopeWhere(scope),
    );
    if (!registration) {
      return { success: false, error: "Registration not found" };
    }

    if (registration.status === "CANCELLED") {
      return { success: false, error: "Registration already cancelled" };
    }

    // Determine new status
    let newStatus: RegistrationStatus = "CANCELLED";
    
    if (type === 'partial') {
      // Logic: Partial cancel usually means cancelling one leg. 
      // In this context, it mostly means cancelling the return leg while keeping outbound.
      // If the user only has return leg (return-only), partial cancel effectively cancels the whole thing 
      // or we can allow PARTIAL_CANCEL status to indicate 'Return Cancelled' state specifically.
      // Let's stick to the business rule: "Cancellations and refunds are possible for the return journey."
      
      if (!registration.outboundDropPointId) {
        // If return-only, partial cancel is effectively full cancel
        newStatus = "CANCELLED";
      } else {
        newStatus = "PARTIAL_CANCEL";
      }
    }

    const result = await registrationRepository.update(id, {
      status: newStatus,
      cancelledAt: new Date(),
      cancelReason: reason,
      refundAmount: refundAmount,
    });

    logger.info(
      { id, type, newStatus },
      "Registration cancelled"
    );

    revalidatePath("/registrasi");
    revalidatePath(`/event/${result.eventId}/participants`);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    logger.error({ err: error, id }, "cancelRegistration action failed");
    return { success: false, error: "Failed to cancel registration" };
  }
}

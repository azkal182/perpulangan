"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import type { RegistrationStatus } from "@/generated/prisma/client";
import {
  AccessDeniedError,
  andWhere,
  getRegionalAccessScope,
  registrationScopeWhere,
} from "@/server/access-scope";

// Update payment status
export async function updatePaymentStatusAction(params: {
  registrationId: string;
  outboundPaid?: boolean;
  returnPaid?: boolean;
}) {
  try {
    const scope = await getRegionalAccessScope();
    const { registrationId, outboundPaid, returnPaid } = params;

    const updateData: {
      outboundPaid?: boolean;
      returnPaid?: boolean;
    } = {};

    if (outboundPaid !== undefined) updateData.outboundPaid = outboundPaid;
    if (returnPaid !== undefined) updateData.returnPaid = returnPaid;

    const existing = await prisma.registration.findFirst({
      where: andWhere({ id: registrationId }, registrationScopeWhere(scope)),
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: "Registrasi tidak ditemukan" };
    }

    await prisma.registration.update({
      where: { id: registrationId },
      data: updateData,
    });

    revalidatePath("/daftar-peserta");
    revalidatePath("/registrasi");

    return { success: true };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to update payment status:", error);
    return { success: false, error: "Gagal mengupdate status pembayaran" };
  }
}

// Cancel registration
export async function cancelRegistrationAction(params: {
  registrationId: string;
  cancelType: "full" | "return_only";
  reason?: string;
}) {
  try {
    const scope = await getRegionalAccessScope();
    const { registrationId, cancelType, reason } = params;

    const status: RegistrationStatus =
      cancelType === "full" ? "CANCELLED" : "PARTIAL_CANCEL";

    const existing = await prisma.registration.findFirst({
      where: andWhere({ id: registrationId }, registrationScopeWhere(scope)),
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: "Registrasi tidak ditemukan" };
    }

    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        status,
        cancelledAt: new Date(),
        cancelReason: reason || null,
      },
    });

    revalidatePath("/daftar-peserta");
    revalidatePath("/registrasi");

    return { success: true };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to cancel registration:", error);
    return { success: false, error: "Gagal membatalkan registrasi" };
  }
}

// Delete registration
export async function deleteRegistrationAction(registrationId: string) {
  try {
    const scope = await getRegionalAccessScope();
    const existing = await prisma.registration.findFirst({
      where: andWhere({ id: registrationId }, registrationScopeWhere(scope)),
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: "Registrasi tidak ditemukan" };
    }

    await prisma.registration.delete({
      where: { id: registrationId },
    });

    revalidatePath("/daftar-peserta");
    revalidatePath("/registrasi");

    return { success: true };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to delete registration:", error);
    return { success: false, error: "Gagal menghapus registrasi" };
  }
}

// Get registration detail
export async function getRegistrationDetailAction(registrationId: string) {
  try {
    const scope = await getRegionalAccessScope();
    const registration = await prisma.registration.findFirst({
      where: andWhere({ id: registrationId }, registrationScopeWhere(scope)),
      include: {
        student: {
          select: {
            id: true,
            nis: true,
            name: true,
            gender: true,
            ttl: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
          },
        },
        outboundKorda: {
          select: {
            id: true,
            name: true,
          },
        },
        outboundDropPoint: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
        returnKorda: {
          select: {
            id: true,
            name: true,
          },
        },
        returnDropPoint: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
    });

    if (!registration) {
      return { success: false, error: "Registrasi tidak ditemukan" };
    }

    return { success: true, data: registration };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to get registration detail:", error);
    return { success: false, error: "Gagal mengambil detail registrasi" };
  }
}

// Refund payment
export async function refundPaymentAction(params: {
  registrationId: string;
  refundOutbound?: boolean;
  refundReturn?: boolean;
}) {
  try {
    const scope = await getRegionalAccessScope();
    const { registrationId, refundOutbound, refundReturn } = params;

    const updateData: {
      outboundPaid?: boolean;
      returnPaid?: boolean;
    } = {};

    if (refundOutbound) updateData.outboundPaid = false;
    if (refundReturn) updateData.returnPaid = false;

    const existing = await prisma.registration.findFirst({
      where: andWhere({ id: registrationId }, registrationScopeWhere(scope)),
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: "Registrasi tidak ditemukan" };
    }

    await prisma.registration.update({
      where: { id: registrationId },
      data: updateData,
    });

    revalidatePath("/daftar-peserta");
    revalidatePath("/registrasi");

    return { success: true };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to refund payment:", error);
    return { success: false, error: "Gagal melakukan refund" };
  }
}

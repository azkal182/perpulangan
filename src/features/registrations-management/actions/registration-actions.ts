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
import { assertEventWritable } from "@/server/event-write-guard";

// Update payment status
export async function updatePaymentStatusAction(params: {
  registrationId: string;
  outboundPaid?: boolean;
  returnPaid?: boolean;
}) {
  void params;
  return { success: false, error: "Status lunas tidak lagi dapat diubah langsung. Catat nominal transaksi di halaman Pembayaran." };
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
      select: { id: true, eventId: true },
    });
    if (!existing) {
      return { success: false, error: "Registrasi tidak ditemukan" };
    }

    await prisma.$transaction(async (tx) => {
      await assertEventWritable(tx, existing.eventId);
      await tx.registration.update({
        where: { id: registrationId },
        data: {
          status,
          cancelledAt: new Date(),
          cancelReason: reason || null,
        },
      });
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
  void registrationId;
  return { success: false, error: "Penghapusan langsung dinonaktifkan. Gunakan Hapus Permanen khusus Admin di daftar peserta agar seluruh peserta pembayaran keluarga, saldo, konfirmasi, dan riwayat diproses bersama." };
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
  void params;
  return { success: false, error: "Refund harus dicatat sebagai transaksi dengan nominal, alasan, metode, dan riwayat di halaman Pembayaran." };
}

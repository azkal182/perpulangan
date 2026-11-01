"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import {
  AccessDeniedError,
  andWhere,
  ensureKordaInScope,
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
  cancelType: "full" | "return_only" | "outbound_only";
  reason?: string;
}) {
  try {
    const scope = await getRegionalAccessScope();
    const { registrationId, cancelType, reason } = params;

    const existing = await prisma.registration.findFirst({
      where: andWhere({ id: registrationId }, registrationScopeWhere(scope)),
      select: { id: true, eventId: true, journeys: { select: { id: true, direction: true, status: true, destinationKordaId: true } } },
    });
    if (!existing) {
      return { success: false, error: "Registrasi tidak ditemukan" };
    }

    await prisma.$transaction(async (tx) => {
      await assertEventWritable(tx, existing.eventId);
      const selected = existing.journeys.filter((journey) =>
        journey.status === "REGISTERED" && (cancelType === "full" || (cancelType === "return_only" ? journey.direction === "RETURN" : journey.direction === "OUTBOUND")),
      );
      if (!selected.length) throw new Error("Tidak ada perjalanan aktif yang sesuai untuk dibatalkan.");
      for (const journey of (cancelType === "full" ? existing.journeys : selected)) await ensureKordaInScope(scope, journey.destinationKordaId);
      await tx.journey.updateMany({ where: { id: { in: selected.map((journey) => journey.id) }, status: "REGISTERED" }, data: { status: "CANCELLED" } });
      const activeCount = await tx.journey.count({ where: { registrationId, status: "REGISTERED" } });
      await tx.registration.update({
        where: { id: registrationId },
        data: {
          status: activeCount ? "PARTIAL_CANCEL" : "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: reason || null,
        },
      });
    });

    revalidatePath("/daftar-peserta");
    revalidatePath("/registrasi");
    revalidatePath("/data-pulang");
    revalidatePath("/rombongan");
    revalidatePath("/cetak-dokumen");
    revalidatePath("/laporan");
    revalidatePath("/keuangan");

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

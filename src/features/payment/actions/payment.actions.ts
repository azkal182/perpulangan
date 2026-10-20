"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { ensureKordaInScope, getRegionalAccessScope } from "@/server/access-scope";
import { assertEventWritable } from "@/server/event-write-guard";
import { canSelectEvent } from "@/server/event-context";
import { allowedEvidenceMime, createEvidenceCleanupToken, createSignedEvidenceUpload, deleteEvidenceObject, isValidEvidenceCleanupToken, isValidEvidenceStorageKey, verifyEvidenceObject } from "../services/supabase-storage";

export type PaymentAllocationInput = {
  journeyId: string;
  journeyAmount: number;
  balanceAmount: number;
};

export async function createEvidenceUploadAction(input: { eventId: string; name: string; mimeType: string; sizeBytes: number }) {
  try {
    const scope = await getRegionalAccessScope();
    if (!scope.userId) throw new Error("Sesi pengguna tidak valid.");
    if (!(await canSelectEvent(scope, input.eventId))) throw new Error("Event di luar cakupan akses Anda.");
    const event = await prisma.event.findUnique({ where: { id: input.eventId }, select: { status: true } });
    if (!event || event.status !== "ACTIVE") throw new Error("Event tidak aktif dan tidak menerima upload bukti baru.");
    if (!allowedEvidenceMime(input.mimeType) || !Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > 10 * 1024 * 1024) throw new Error("Bukti harus PDF, JPG, PNG, atau WebP dengan ukuran maksimal 10 MB.");
    const id = randomUUID();
    const extension = input.mimeType === "application/pdf" ? "pdf" : input.mimeType === "image/jpeg" ? "jpg" : input.mimeType === "image/png" ? "png" : "webp";
    const storageKey = `evidence/${id}.${extension}`;
    const signed = await createSignedEvidenceUpload(storageKey);
    if (!signed.token) throw new Error("Supabase tidak mengembalikan token upload.");
    return { success: true as const, id, storageKey, signedUrl: signed.signedUrl, token: signed.token, cleanupToken: createEvidenceCleanupToken(scope.userId, storageKey) };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Gagal menyiapkan upload bukti." };
  }
}

export async function cleanupPaymentEvidenceUploadAction(storageKey: string, cleanupToken: string) {
  try {
    const scope = await getRegionalAccessScope();
    if (!scope.userId || !/^evidence\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/i.test(storageKey) || !isValidEvidenceCleanupToken(scope.userId, storageKey, cleanupToken)) return { success: false };
    if (await prisma.evidenceFile.findUnique({ where: { storageKey }, select: { id: true } })) return { success: false };
    await deleteEvidenceObject(storageKey);
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function recordFamilyPaymentAction(formData: FormData) {
  let storageKeyToCleanup: string | null = null;
  try {
    const input = {
      eventId: String(formData.get("eventId") ?? ""),
      amount: Number(formData.get("amount")),
      paidAt: String(formData.get("paidAt") ?? ""),
      allocations: JSON.parse(String(formData.get("allocations") ?? "[]")) as PaymentAllocationInput[],
    };
    const evidenceId = String(formData.get("evidenceId") ?? "") || null;
    const evidenceStorageKey = String(formData.get("evidenceStorageKey") ?? "") || null;
    const evidenceName = String(formData.get("evidenceName") ?? "");
    const evidenceMime = String(formData.get("evidenceMime") ?? "");
    const evidenceSize = Number(formData.get("evidenceSize"));
    const scope = await getRegionalAccessScope();
    // Sender identity is intentionally not collected in the payment UI.
    const payerName = "Tidak dicatat";
    const amount = Math.trunc(input.amount);
    if (!input.eventId || !Number.isSafeInteger(amount) || amount <= 0 || !input.allocations.length) {
      return { success: false, error: "Pilih event, perjalanan, dan nominal transfer yang valid." };
    }
    if (new Set(input.allocations.map((row) => row.journeyId)).size !== input.allocations.length || input.allocations.some((row) => !Number.isSafeInteger(row.journeyAmount) || !Number.isSafeInteger(row.balanceAmount))) return { success: false, error: "Setiap perjalanan hanya boleh dicantumkan satu kali dan nominal harus berupa rupiah bulat." };
    const totalAllocated = input.allocations.reduce((sum, row) => sum + Math.trunc(row.journeyAmount) + Math.trunc(row.balanceAmount), 0);
    if (input.allocations.some((row) => row.journeyAmount < 0 || row.balanceAmount < 0) || totalAllocated !== amount) {
      return { success: false, error: "Total alokasi perjalanan dan Saldo Lain harus sama dengan nominal pembayaran." };
    }
    if (Number.isNaN(new Date(input.paidAt).getTime())) return { success: false, error: "Tanggal pembayaran tidak valid." };
    const event = await prisma.event.findUnique({ where: { id: input.eventId }, select: { id: true, status: true } });
    if (!event || event.status !== "ACTIVE") return { success: false, error: "Event tidak aktif dan tidak dapat menerima pembayaran." };

    const journeys = await prisma.journey.findMany({
      where: { id: { in: input.allocations.map((row) => row.journeyId) }, registration: { eventId: input.eventId } },
      include: { destinationKorda: { select: { id: true, name: true } }, registration: { include: { student: { select: { name: true } }, externalParticipant: { select: { name: true } } } } },
    });
    if (journeys.length !== new Set(input.allocations.map((r) => r.journeyId)).size) return { success: false, error: "Ada perjalanan yang tidak ditemukan dalam event ini." };

    const resolved: Array<{ row: PaymentAllocationInput; journey: (typeof journeys)[number]; name: string }> = [];
    for (const row of input.allocations) {
      const journey = journeys.find((item) => item.id === row.journeyId)!;
      await ensureKordaInScope(scope, journey.destinationKordaId, "Pembayaran hanya dapat dicatat dalam cakupan Korda tujuan.");
      if (journey.status !== "REGISTERED") return { success: false, error: "Perjalanan yang dibatalkan tidak dapat menerima alokasi pembayaran baru." };
      if (journey.tariffSnapshot === null) return { success: false, error: `Tarif ${journey.registration.student?.name ?? journey.registration.externalParticipant?.name ?? "peserta"} belum tersedia. Lengkapi tarif perjalanan terlebih dahulu.` };
      const alreadyPaid = await prisma.paymentAllocation.aggregate({ where: { journeyId: journey.id, type: "JOURNEY" }, _sum: { amount: true } });
      const [refunded, corrected] = await Promise.all([
        prisma.refund.aggregate({ where: { paymentAllocation: { journeyId: journey.id } }, _sum: { amount: true } }),
        prisma.financialCorrection.aggregate({ where: { paymentAllocation: { journeyId: journey.id } }, _sum: { amount: true } }),
      ]);
      const outstanding = Math.max(0, journey.tariffSnapshot - (alreadyPaid._sum.amount ?? 0) + (refunded._sum.amount ?? 0) + (corrected._sum.amount ?? 0));
      if (row.journeyAmount > outstanding) return { success: false, error: `Alokasi ke tagihan melebihi sisa tagihan (${outstanding}). Masukkan kelebihan secara eksplisit pada Saldo Lain.` };
      if (row.journeyAmount + row.balanceAmount <= 0) return { success: false, error: "Pilih nominal untuk setiap perjalanan yang dicantumkan." };
      resolved.push({ row, journey, name: journey.registration.student?.name ?? journey.registration.externalParticipant?.name ?? "Peserta" });
    }

    const paymentId = randomUUID();
    const generatedNote = resolved.map(({ journey, name, row }) => `${name} / ${journey.direction === "OUTBOUND" ? "Pulang" : "Kembali"} — tagihan Rp${row.journeyAmount.toLocaleString("id-ID")}${row.balanceAmount ? `, Saldo Lain Rp${row.balanceAmount.toLocaleString("id-ID")}` : ""} (${journey.destinationKorda.name})`).join("; ");
    const evidenceFieldsPresent = [evidenceId, evidenceStorageKey].some(Boolean);
    let verifiedEvidenceSha256: string | null = null;
    if (!evidenceId || !evidenceStorageKey) return { success: false, error: "Bukti transfer wajib diunggah saat pembayaran dicatat." };
    if (evidenceFieldsPresent) {
      if (!evidenceId || !evidenceStorageKey || !isValidEvidenceStorageKey(evidenceStorageKey, evidenceId, evidenceMime)) return { success: false, error: "Metadata bukti tidak lengkap atau tidak valid." };
      verifiedEvidenceSha256 = await verifyEvidenceObject(evidenceStorageKey, evidenceMime, evidenceSize);
      storageKeyToCleanup = evidenceStorageKey;
    }
    await prisma.$transaction(async (tx) => {
      await assertEventWritable(tx, input.eventId);
      for (const { row, journey } of resolved) {
        const [alreadyPaid, refunded, corrected] = await Promise.all([
          tx.paymentAllocation.aggregate({ where: { journeyId: journey.id, type: "JOURNEY" }, _sum: { amount: true } }),
          tx.refund.aggregate({ where: { paymentAllocation: { journeyId: journey.id } }, _sum: { amount: true } }),
          tx.financialCorrection.aggregate({ where: { paymentAllocation: { journeyId: journey.id } }, _sum: { amount: true } }),
        ]);
        const currentDue = Math.max(0, journey.tariffSnapshot! - (alreadyPaid._sum.amount ?? 0) + (refunded._sum.amount ?? 0) + (corrected._sum.amount ?? 0));
        if (row.journeyAmount > currentDue) throw new Error("Sisa tagihan berubah karena transaksi lain. Muat ulang halaman sebelum menyimpan.");
      }
      await tx.payment.create({ data: { id: paymentId, eventId: input.eventId, payerName, amount, method: "Transfer", paidAt: new Date(input.paidAt), noteSnapshot: generatedNote, createdByUserId: scope.userId } });
      if (evidenceId && evidenceStorageKey && verifiedEvidenceSha256) await tx.evidenceFile.create({ data: { id: evidenceId, storageKey: evidenceStorageKey, originalName: evidenceName.slice(0, 255), mimeType: evidenceMime, sizeBytes: evidenceSize, sha256: verifiedEvidenceSha256, uploadedByUserId: scope.userId, paymentId } });
      for (const { row, journey, name } of resolved) {
        const originName = journey.registration.originKordaNameSnapshot;
        if (row.journeyAmount > 0) {
          await tx.paymentAllocation.create({ data: { paymentId, type: "JOURNEY", journeyId: journey.id, participantNameSnapshot: name, originKordaNameSnapshot: originName, destinationKordaNameSnapshot: journey.destinationKorda.name, payerNameSnapshot: payerName, amount: Math.trunc(row.journeyAmount), createdByUserId: scope.userId } });
        }
        if (row.balanceAmount > 0) {
          const allocation = await tx.paymentAllocation.create({ data: { paymentId, type: "BALANCE", balanceOwnerKordaId: journey.destinationKordaId, participantNameSnapshot: name, originKordaNameSnapshot: originName, destinationKordaNameSnapshot: journey.destinationKorda.name, payerNameSnapshot: payerName, amount: Math.trunc(row.balanceAmount), createdByUserId: scope.userId } });
          await tx.kordaBalanceEntry.create({ data: { ownerKordaId: journey.destinationKordaId, originKordaNameSnapshot: originName, destinationKordaNameSnapshot: journey.destinationKorda.name, participantNameSnapshot: name, payerNameSnapshot: payerName, sourcePaymentAllocationId: allocation.id, entryType: "CREDIT", amount: Math.trunc(row.balanceAmount), createdByUserId: scope.userId } });
        }
      }
      await tx.financialAuditEntry.create({ data: { action: "PAYMENT_RECORDED", entityType: "Payment", entityId: paymentId, eventId: input.eventId, actorUserId: scope.userId, actorRoleSnapshot: scope.role, amount, paymentId } });
    }, { isolationLevel: "Serializable" });
    storageKeyToCleanup = null;
    revalidatePath("/pembayaran"); revalidatePath("/daftar-peserta"); revalidatePath("/registrasi");
    return { success: true, paymentId };
  } catch (error) {
    if (storageKeyToCleanup) await deleteEvidenceObject(storageKeyToCleanup).catch(() => undefined);
    console.error("recordFamilyPaymentAction failed", error);
    return { success: false, error: error instanceof Error ? error.message : "Gagal mencatat pembayaran." };
  }
}

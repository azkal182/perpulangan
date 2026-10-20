"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { ensureKordaInScope, getRegionalAccessScope } from "@/server/access-scope";
import { assertEventWritable } from "@/server/event-write-guard";
import { canSelectEvent } from "@/server/event-context";
import { allowedEvidenceMime, createEvidenceCleanupToken, createSignedEvidenceUpload, deleteEvidenceObject, isValidEvidenceCleanupToken, isValidEvidenceStorageKey, verifyEvidenceObject } from "../services/supabase-storage";

export async function createRefundEvidenceUploadAction(input: { eventId: string; name: string; mimeType: string; sizeBytes: number }) {
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
    return { success: true as const, id, storageKey, signedUrl: signed.signedUrl, cleanupToken: createEvidenceCleanupToken(scope.userId, storageKey) };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Gagal menyiapkan upload bukti." };
  }
}

export async function cleanupRefundEvidenceUploadAction(storageKey: string, cleanupToken: string) {
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

export async function recordRefundAction(formData: FormData) {
  let storageKeyToCleanup: string | null = null;
  try {
    const scope = await getRegionalAccessScope();
    const selectedEventId = String(formData.get("eventId") ?? "");
    if (!selectedEventId) return { success: false, error: "Pilih event terlebih dahulu." };
    const paymentAllocationId = String(formData.get("paymentAllocationId") ?? "") || null;
    const balanceSourceEntryId = String(formData.get("balanceSourceEntryId") ?? "") || null;
    const amount = Math.trunc(Number(formData.get("amount")));
    const reason = String(formData.get("reason") ?? "").trim();
    const methodValue = String(formData.get("method") ?? "BANK_TRANSFER");
    const method = ["CASH", "BANK_TRANSFER", "OTHER"].includes(methodValue) ? methodValue as "CASH" | "BANK_TRANSFER" | "OTHER" : "OTHER";
    const refundedAt = new Date(String(formData.get("refundedAt") ?? ""));
    const evidenceId = String(formData.get("evidenceId") ?? "") || null;
    const evidenceStorageKey = String(formData.get("evidenceStorageKey") ?? "") || null;
    const evidenceName = String(formData.get("evidenceName") ?? "");
    const evidenceMime = String(formData.get("evidenceMime") ?? "");
    const evidenceSize = Number(formData.get("evidenceSize"));
    if (!!paymentAllocationId === !!balanceSourceEntryId) return { success: false, error: "Pilih satu sumber refund." };
    if (amount <= 0 || !Number.isFinite(amount) || !reason || Number.isNaN(refundedAt.getTime())) return { success: false, error: "Nominal, alasan, dan tanggal refund wajib valid." };
    if (Boolean(evidenceId) !== Boolean(evidenceStorageKey)) return { success: false, error: "Metadata bukti refund tidak lengkap." };
    let verifiedEvidenceSha256: string | null = null;
    if (evidenceId && evidenceStorageKey) {
      if (!isValidEvidenceStorageKey(evidenceStorageKey, evidenceId, evidenceMime)) return { success: false, error: "Metadata bukti refund tidak valid." };
      verifiedEvidenceSha256 = await verifyEvidenceObject(evidenceStorageKey, evidenceMime, evidenceSize);
      storageKeyToCleanup = evidenceStorageKey;
    }

    const refundId = randomUUID();
    let eventId: string | null = null;
    let kordaScopeId: string | null = null;
    await prisma.$transaction(async (tx) => {
      await assertEventWritable(tx, selectedEventId);
      if (paymentAllocationId) {
        const source = await tx.paymentAllocation.findUnique({ where: { id: paymentAllocationId }, include: { journey: { include: { registration: { select: { eventId: true } } } }, refunds: { select: { amount: true } }, corrections: { select: { amount: true } } } });
        if (!source || source.type !== "JOURNEY" || !source.journey) throw new Error("Alokasi pembayaran tidak ditemukan.");
        await ensureKordaInScope(scope, source.journey.destinationKordaId, "Refund berada di luar cakupan Korda Anda.");
        const alreadyReduced = source.refunds.reduce((sum, row) => sum + row.amount, 0) + source.corrections.reduce((sum, row) => sum + row.amount, 0);
        if (amount > source.amount - alreadyReduced) throw new Error(`Nominal refund melebihi dana tersisa (${source.amount - alreadyReduced}).`);
        eventId = source.journey.registration.eventId; kordaScopeId = source.journey.destinationKordaId;
        if (eventId !== selectedEventId) throw new Error("Sumber refund tidak sesuai dengan event yang dipilih.");
        await tx.refund.create({ data: { id: refundId, paymentAllocationId, amount, reason, method, refundedAt, createdByUserId: scope.userId } });
      } else {
        const source = await tx.kordaBalanceEntry.findUnique({ where: { id: balanceSourceEntryId! }, include: { sourcePaymentAllocation: true, refundsFromSource: { select: { amount: true } }, correctionsFromSource: { select: { amount: true } } } });
        if (!source || source.entryType !== "CREDIT") throw new Error("Sumber Saldo Lain tidak ditemukan atau tidak dapat direfund.");
        await ensureKordaInScope(scope, source.ownerKordaId, "Refund saldo berada di luar cakupan Korda Anda.");
        const remaining = source.amount - source.refundsFromSource.reduce((sum, row) => sum + row.amount, 0) - source.correctionsFromSource.reduce((sum, row) => sum + row.amount, 0);
        if (amount > remaining) throw new Error(`Nominal refund melebihi saldo tersisa (${remaining}).`);
        const allocation = source.sourcePaymentAllocationId ? await tx.paymentAllocation.findUnique({ where: { id: source.sourcePaymentAllocationId }, include: { payment: { select: { eventId: true } } } }) : null;
        eventId = allocation?.payment.eventId ?? null; kordaScopeId = source.ownerKordaId;
        if (eventId !== selectedEventId) throw new Error("Sumber Saldo Lain tidak sesuai dengan event yang dipilih.");
        await tx.refund.create({ data: { id: refundId, balanceSourceEntryId, amount, reason, method, refundedAt, createdByUserId: scope.userId } });
        await tx.kordaBalanceEntry.create({ data: { ownerKordaId: source.ownerKordaId, originKordaNameSnapshot: source.originKordaNameSnapshot, destinationKordaNameSnapshot: source.destinationKordaNameSnapshot, participantNameSnapshot: source.participantNameSnapshot, payerNameSnapshot: source.payerNameSnapshot, sourceRefundId: refundId, entryType: "REFUND", amount, reason, createdByUserId: scope.userId } });
      }
      if (evidenceId && evidenceStorageKey && verifiedEvidenceSha256) await tx.evidenceFile.create({ data: { id: evidenceId, storageKey: evidenceStorageKey, originalName: evidenceName.slice(0, 255), mimeType: evidenceMime, sizeBytes: evidenceSize, sha256: verifiedEvidenceSha256, uploadedByUserId: scope.userId, refundId } });
      await tx.financialAuditEntry.create({ data: { action: "REFUND_RECORDED", entityType: "Refund", entityId: refundId, eventId, kordaScopeId, actorUserId: scope.userId, actorRoleSnapshot: scope.role, amount, reason, refundId } });
    }, { isolationLevel: "Serializable" });
    storageKeyToCleanup = null;
    revalidatePath("/pembayaran"); revalidatePath("/daftar-peserta");
    return { success: true };
  } catch (error) {
    if (storageKeyToCleanup) await deleteEvidenceObject(storageKeyToCleanup).catch(() => undefined);
    return { success: false, error: error instanceof Error ? error.message : "Gagal mencatat refund." };
  }
}

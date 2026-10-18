"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cleanupRefundEvidenceUploadAction, createRefundEvidenceUploadAction, recordRefundAction } from "../actions/refund.actions";

type RefundOption = { id: string; sourceType: "journey" | "balance"; label: string; remaining: number };

export function RefundForm({ options }: { options: RefundOption[] }) {
  const [pending, startTransition] = useTransition();
  if (!options.length) return <p className="text-sm text-muted-foreground">Belum ada dana yang tersedia untuk direfund.</p>;
  function submit(formData: FormData) {
    startTransition(async () => {
      const evidence = formData.get("evidence");
      formData.delete("evidence");
      let cleanupToken = "";
      if (evidence instanceof File && evidence.size > 0) {
        const upload = await createRefundEvidenceUploadAction({ name: evidence.name, mimeType: evidence.type, sizeBytes: evidence.size });
        if (!upload.success) { toast.error(upload.error); return; }
        cleanupToken = upload.cleanupToken;
        const uploaded = await fetch(upload.signedUrl, { method: "PUT", headers: { "Content-Type": evidence.type }, body: evidence });
        if (!uploaded.ok) { await cleanupRefundEvidenceUploadAction(upload.storageKey, cleanupToken); toast.error("Upload bukti refund ke Supabase gagal. Coba unggah kembali."); return; }
        formData.set("evidenceId", upload.id); formData.set("evidenceStorageKey", upload.storageKey); formData.set("evidenceName", evidence.name); formData.set("evidenceMime", evidence.type); formData.set("evidenceSize", String(evidence.size));
      }
      const result = await recordRefundAction(formData);
      if (!result.success) { const storageKey = String(formData.get("evidenceStorageKey") ?? ""); if (storageKey && cleanupToken) await cleanupRefundEvidenceUploadAction(storageKey, cleanupToken); toast.error(result.error); return; }
      toast.success("Refund tercatat. Riwayat pembayaran asal tetap tersimpan.");
      const form = document.getElementById("refund-form") as HTMLFormElement | null; form?.reset();
    });
  }
  return <form id="refund-form" action={submit} className="grid min-w-0 gap-3 sm:grid-cols-2">
    <p className="text-sm text-muted-foreground sm:col-span-2">Refund menjadi transaksi baru dan tidak menghapus pembayaran asal.</p>
    <label className="min-w-0 text-sm">Sumber dana<select name="sourceId" required className="mt-1 w-full min-w-0 rounded border bg-background px-3 py-2" onChange={(event) => { const option = options.find((row) => row.id === event.target.value); const journey = document.getElementById("refund-allocation-id") as HTMLInputElement; const balance = document.getElementById("refund-balance-id") as HTMLInputElement; journey.value = option?.sourceType === "journey" ? option.id : ""; balance.value = option?.sourceType === "balance" ? option.id : ""; const amount = document.getElementById("refund-amount") as HTMLInputElement; amount.max = String(option?.remaining ?? 0); }}><option value="">Pilih sumber</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label} · maks. Rp{option.remaining.toLocaleString("id-ID")}</option>)}</select></label>
    <input id="refund-allocation-id" type="hidden" name="paymentAllocationId" /><input id="refund-balance-id" type="hidden" name="balanceSourceEntryId" />
    <label className="min-w-0 text-sm">Nominal<input id="refund-amount" name="amount" type="number" min="1" required className="mt-1 w-full min-w-0 rounded border bg-background px-3 py-2" /></label>
    <label className="min-w-0 text-sm">Alasan<input name="reason" required maxLength={500} className="mt-1 w-full min-w-0 rounded border bg-background px-3 py-2" /></label>
    <label className="min-w-0 text-sm">Metode<select name="method" className="mt-1 w-full min-w-0 rounded border bg-background px-3 py-2"><option value="BANK_TRANSFER">Transfer</option><option value="CASH">Tunai</option><option value="OTHER">Lainnya</option></select></label>
    <label className="min-w-0 text-sm">Tanggal refund<input name="refundedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className="mt-1 w-full min-w-0 rounded border bg-background px-3 py-2" /></label>
    <label className="min-w-0 break-words text-sm sm:col-span-2">Bukti refund (opsional, PDF/JPG/PNG/WebP, maksimal 10 MB)<input name="evidence" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="mt-1 block w-full min-w-0 text-sm file:mr-2 file:max-w-full file:rounded file:border-0 file:bg-muted file:px-3 file:py-2" /></label>
    <div className="sm:col-span-2"><button disabled={pending} className="w-full rounded bg-primary px-4 py-2.5 text-primary-foreground disabled:opacity-50 sm:w-auto">{pending ? "Menyimpan…" : "Simpan refund"}</button></div>
  </form>;
}

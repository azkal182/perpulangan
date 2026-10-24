"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordFinancialCorrectionAction } from "../actions/correction.actions";

type CorrectionOption = { id: string; sourceType: "journey" | "balance"; label: string; remaining: number };

export function FinancialCorrectionForm({ options }: { options: CorrectionOption[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  if (!options.length) return <p className="text-sm text-muted-foreground">Tidak ada transaksi yang memiliki sisa nominal untuk dikoreksi.</p>;
  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await recordFinancialCorrectionAction(formData);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Koreksi tercatat sebagai transaksi pembalik. Riwayat sumber tetap utuh.");
      const form = document.getElementById("financial-correction-form") as HTMLFormElement | null;
      form?.reset();
      router.refresh();
    });
  }
  return <form id="financial-correction-form" action={submit} className="grid min-w-0 gap-3 sm:grid-cols-2">
    <label className="min-w-0 text-sm sm:col-span-2">Pencatatan yang salah<select name="sourceId" required className="mt-1 w-full min-w-0 rounded border bg-background px-3 py-2" onChange={(event) => { const option = options.find((row) => row.id === event.target.value); (document.getElementById("correction-allocation-id") as HTMLInputElement).value = option?.sourceType === "journey" ? option.id : ""; (document.getElementById("correction-balance-id") as HTMLInputElement).value = option?.sourceType === "balance" ? option.id : ""; (document.getElementById("correction-amount") as HTMLInputElement).max = String(option?.remaining ?? 0); }}><option value="">Pilih pencatatan</option>{options.map((option) => <option key={`${option.sourceType}:${option.id}`} value={option.id}>{option.label} · sisa Rp{option.remaining.toLocaleString("id-ID")}</option>)}</select><span className="mt-1 block text-xs text-muted-foreground">Sisa nominal adalah batas maksimal yang dapat dikoreksi.</span></label>
    <input id="correction-allocation-id" type="hidden" name="paymentAllocationId"/><input id="correction-balance-id" type="hidden" name="balanceSourceEntryId"/>
    <label className="min-w-0 text-sm">Nominal yang dikoreksi<input id="correction-amount" name="amount" type="number" min="1" required className="mt-1 w-full min-w-0 rounded border bg-background px-3 py-2"/></label>
    <label className="min-w-0 text-sm">Tanggal koreksi<input name="correctedAt" type="date" defaultValue={new Date().toISOString().slice(0,10)} required className="mt-1 w-full min-w-0 rounded border bg-background px-3 py-2"/></label>
    <label className="min-w-0 text-sm sm:col-span-2">Alasan koreksi<input name="reason" required maxLength={500} placeholder="Jelaskan kesalahan input yang dikoreksi" className="mt-1 w-full min-w-0 rounded border bg-background px-3 py-2"/></label>
    <p className="text-xs text-muted-foreground sm:col-span-2">Koreksi membalik catatan yang salah; gunakan halaman Refund hanya jika uang benar-benar dikembalikan. Koreksi tidak menghapus transaksi sumber.</p>
    <div className="sm:col-span-2"><button disabled={pending} className="w-full rounded bg-primary px-4 py-2.5 text-primary-foreground disabled:opacity-50 sm:w-auto">{pending ? "Menyimpan…" : "Catat koreksi"}</button></div>
  </form>;
}

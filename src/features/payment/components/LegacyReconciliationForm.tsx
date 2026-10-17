"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reconcileLegacyPaymentAction } from "../actions/legacy-reconciliation.actions";

type LegacyOption = { id: string; participant: string; direction: string; destination: string };

export function LegacyReconciliationForm({ item }: { item: LegacyOption }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await reconcileLegacyPaymentAction(formData);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Pembayaran historis direkonsiliasi dan dicatat.");
      setAmount(""); router.refresh();
    });
  }
  return <form action={submit} className="mt-3 grid gap-2 rounded bg-muted/30 p-3 sm:grid-cols-2">
    <input type="hidden" name="legacyId" value={item.id} />
    <label>Nominal aktual terkonfirmasi<input name="amount" type="number" min="1" required value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded border bg-background px-3 py-2" /></label>
    <label>Tanggal pembayaran<input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className="mt-1 w-full rounded border bg-background px-3 py-2" /></label>
    <label className="sm:col-span-2">Catatan verifikasi petugas<input name="note" required maxLength={500} placeholder="Contoh: dicocokkan dengan buku kas tanggal ..." className="mt-1 w-full rounded border bg-background px-3 py-2" /></label>
    <p className="text-xs text-muted-foreground sm:col-span-2">Nominal tidak diambil dari tarif saat ini. Bagian yang melebihi sisa tagihan akan masuk ke Saldo Lain {item.destination}.</p>
    <div className="sm:col-span-2"><button disabled={pending} className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">{pending ? "Menyimpan…" : "Simpan rekonsiliasi"}</button></div>
  </form>;
}

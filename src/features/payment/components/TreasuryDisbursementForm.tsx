"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordTreasuryDisbursementAction } from "../actions/treasury-disbursement.actions";

type KordaOption = { id: string; name: string; available: number };

export function TreasuryDisbursementForm({ kordas }: { kordas: KordaOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState(kordas[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  const selected = kordas.find((korda) => korda.id === selectedId);

  function submit(formData: FormData) {
    setMessage("");
    startTransition(async () => {
      const result = await recordTreasuryDisbursementAction(formData);
      if (!result.success) return setMessage(result.error ?? "Pencairan gagal dicatat.");
      setMessage("Pencairan ke Korda berhasil dicatat.");
      setAmount("");
      router.refresh();
    });
  }

  return <form action={submit} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.5fr_auto] lg:items-end">
    <label className="grid gap-1 text-sm font-medium">Korda penerima<select name="kordaId" required value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="rounded-md border bg-background px-3 py-2"><option value="">Pilih Korda</option>{kordas.map((korda) => <option key={korda.id} value={korda.id}>{korda.name} · tersedia {`Rp${korda.available.toLocaleString("id-ID")}`}</option>)}</select></label>
    <label className="grid gap-1 text-sm font-medium">Nominal dicairkan<input name="amount" inputMode="numeric" type="number" min="1" max={selected?.available ?? 0} required value={amount} onChange={(event) => setAmount(event.target.value)} className="rounded-md border bg-background px-3 py-2" placeholder="Rp"/><span className="text-xs font-normal text-muted-foreground">Maksimal Rp{(selected?.available ?? 0).toLocaleString("id-ID")}</span></label>
    <label className="grid gap-1 text-sm font-medium">Tanggal pencairan<input name="disbursedAt" type="date" defaultValue={today} required className="rounded-md border bg-background px-3 py-2"/></label>
    <label className="grid gap-1 text-sm font-medium">Catatan <span className="font-normal text-muted-foreground">(opsional)</span><input name="note" maxLength={500} className="rounded-md border bg-background px-3 py-2" placeholder="Keterangan pencairan"/></label>
    <button disabled={pending || !selected || !amount || Number(amount) > selected.available} className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">{pending ? "Menyimpan…" : "Catat pencairan"}</button>
    {message && <p role="status" className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-5">{message}</p>}
    <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-5">Catat setelah dana benar-benar diserahkan ke Korda. Ini bukan formulir permintaan penarikan atau instruksi transfer.</p>
  </form>;
}

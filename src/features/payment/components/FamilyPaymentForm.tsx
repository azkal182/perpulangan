"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createEvidenceUploadAction, recordFamilyPaymentAction, type PaymentAllocationInput } from "../actions/payment.actions";

type JourneyOption = { id: string; label: string; destination: string; tariff: number | null; previouslyPaid: number };
type PaymentPreview = { journeyId: string; journeyAmount: number; balanceAmount: number; remainingAmount: number };
const money = (amount: number) => `Rp${amount.toLocaleString("id-ID")}`;

export function FamilyPaymentForm({ eventId, journeys, onSaved }: { eventId: string; journeys: JourneyOption[]; onSaved?: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [amountText, setAmountText] = useState("");
  const [amountEdited, setAmountEdited] = useState(false);
  const [balanceOwnerJourneyId, setBalanceOwnerJourneyId] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const selectedJourneys = journeys.filter((journey) => selected.includes(journey.id) && journey.tariff !== null);
  const dueByJourney = new Map(selectedJourneys.map((journey) => [journey.id, Math.max(0, (journey.tariff ?? 0) - journey.previouslyPaid)]));
  const totalDue = selectedJourneys.reduce((sum, journey) => sum + (dueByJourney.get(journey.id) ?? 0), 0);
  const amount = Number(amountText);
  const totalSent = Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
  const surplus = Math.max(0, totalSent - totalDue);
  const previews: PaymentPreview[] = selectedJourneys.reduce<{ remaining: number; rows: PaymentPreview[] }>((state, journey) => {
      const due = dueByJourney.get(journey.id) ?? 0;
      const allocated = Math.min(due, state.remaining);
      return { remaining: state.remaining - allocated, rows: [...state.rows, { journeyId: journey.id, journeyAmount: allocated, balanceAmount: 0, remainingAmount: due - allocated }] };
    }, { remaining: Math.min(totalSent, totalDue), rows: [] }).rows;
  const balanceOwner = selectedJourneys.length === 1 ? selectedJourneys[0]?.id : balanceOwnerJourneyId;
  const allocations: PaymentAllocationInput[] = previews.map((row) => ({ ...row, balanceAmount: surplus > 0 && row.journeyId === balanceOwner ? surplus : 0 })).filter((row) => row.journeyAmount > 0 || row.balanceAmount > 0);

  function updateSelected(next: string[]) {
    setSelected(next);
    const nextDue = journeys.filter((journey) => next.includes(journey.id) && journey.tariff !== null).reduce((sum, journey) => sum + Math.max(0, (journey.tariff ?? 0) - journey.previouslyPaid), 0);
    if (!amountEdited || next.length === 0) { setAmountText(String(nextDue)); setAmountEdited(false); }
    if (!next.includes(balanceOwnerJourneyId)) setBalanceOwnerJourneyId("");
  }

  function submit() {
    if (!allocations.length || totalSent <= 0) return toast.error("Pilih perjalanan dan masukkan nominal transfer.");
    if (surplus > 0 && selectedJourneys.length > 1 && !balanceOwner) return toast.error("Pilih peserta/perjalanan pemilik Saldo Lain untuk kelebihan transfer.");
    startTransition(async () => {
      const form = new FormData();
      form.set("eventId", eventId); form.set("amount", String(totalSent)); form.set("paidAt", new Date().toISOString()); form.set("allocations", JSON.stringify(allocations));
      if (evidence) {
        const upload = await createEvidenceUploadAction({ name: evidence.name, mimeType: evidence.type, sizeBytes: evidence.size });
        if (!upload.success) { toast.error(upload.error); return; }
        const body = new FormData(); body.append("", evidence);
        const uploaded = await fetch(upload.signedUrl, { method: "PUT", body });
        if (!uploaded.ok) { toast.error("Upload bukti ke Supabase gagal. Coba unggah kembali."); return; }
        form.set("evidenceId", upload.id); form.set("evidenceStorageKey", upload.storageKey); form.set("evidenceName", evidence.name); form.set("evidenceMime", evidence.type); form.set("evidenceSize", String(evidence.size));
      }
      const result = await recordFamilyPaymentAction(form);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Pembayaran berhasil dicatat.");
      setSelected([]); setAmountText(""); setAmountEdited(false); setBalanceOwnerJourneyId(""); setEvidence(null);
      onSaved?.();
    });
  }

  if (!journeys.length) return <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Catat pembayaran</h2><p className="mt-2 text-sm text-muted-foreground">Belum ada perjalanan dengan tarif yang dapat dibayar.</p></section>;

  return <section className="space-y-5 bg-card py-2">
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0"><h2 className="text-lg font-semibold sm:text-xl">Rincian pembayaran</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Pilih tagihan yang dibayar. Nominal transfer otomatis mengikuti total sisa tagihan dan masih bisa disesuaikan.</p></div>
      <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Pengirim tidak dicatat</span>
    </div>

    <div className="space-y-2">
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Pilih tagihan</h3><button type="button" className="text-sm text-primary underline-offset-4 hover:underline" onClick={() => updateSelected(selected.length === journeys.filter((journey) => journey.tariff !== null && journey.tariff > journey.previouslyPaid).length ? [] : journeys.filter((journey) => journey.tariff !== null && journey.tariff > journey.previouslyPaid).map((journey) => journey.id))}>{selected.length === journeys.filter((journey) => journey.tariff !== null && journey.tariff > journey.previouslyPaid).length ? "Batal pilih semua" : "Pilih semua"}</button></div>
      <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {journeys.map((journey) => {
          const isSelected = selected.includes(journey.id);
          const due = journey.tariff === null ? null : Math.max(0, journey.tariff - journey.previouslyPaid);
          const status = journey.tariff === null ? "Tarif belum tersedia" : due === 0 ? "Sudah lunas" : journey.previouslyPaid > 0 ? "Partial" : "Belum bayar";
          return <label key={journey.id} className={`flex min-w-0 cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors sm:gap-3 sm:p-3 ${isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/40"} ${due === null || due === 0 ? "opacity-60" : ""}`}>
            <input type="checkbox" disabled={due === null || due === 0} checked={isSelected} onChange={(event) => updateSelected(event.target.checked ? [...selected, journey.id] : selected.filter((id) => id !== journey.id))} className="mt-1 size-4 shrink-0 accent-primary" />
            <span className="min-w-0 flex-1"><span className="block break-words font-medium leading-snug">{journey.label}</span><span className="mt-1 flex min-w-0 flex-wrap gap-x-1 text-xs text-muted-foreground"><span className="break-words">{journey.destination}</span><span>·</span><span>{status}</span></span></span>
            <span className="max-w-24 shrink-0 break-words text-right text-sm font-semibold sm:max-w-none">{due === null ? "—" : money(due)}<span className="block text-xs font-normal text-muted-foreground">sisa tagihan</span></span>
          </label>;
        })}
      </div>
    </div>

    <div className="grid gap-4 rounded-lg bg-muted/40 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <label className="text-sm font-medium">Nominal transfer<input type="number" min="1" step="1" value={amountText} onChange={(event) => { setAmountText(event.target.value); setAmountEdited(true); }} disabled={!selectedJourneys.length} className="mt-1.5 w-full rounded-md border bg-background px-3 py-2.5 text-base" placeholder="Pilih tagihan terlebih dahulu" /><span className="mt-1 block text-xs font-normal text-muted-foreground">Default: total sisa tagihan yang dipilih ({money(totalDue)}).</span></label>
      <div className="min-w-0 space-y-2 text-sm"><div className="flex items-start justify-between gap-3"><span className="text-muted-foreground">Tagihan terpilih</span><strong className="shrink-0">{money(totalDue)}</strong></div><div className="flex items-start justify-between gap-3"><span className="text-muted-foreground">Dibayarkan ke tagihan</span><strong className="shrink-0">{money(Math.min(totalSent, totalDue))}</strong></div><div className="flex items-start justify-between gap-3"><span className="text-muted-foreground">Sisa tagihan</span><strong className="shrink-0">{money(Math.max(0, totalDue - totalSent))}</strong></div><div className="flex items-start justify-between gap-3 border-t pt-2"><span className="font-medium">Kelebihan ke Saldo Lain</span><strong className={`shrink-0 ${surplus > 0 ? "text-primary" : ""}`}>{money(surplus)}</strong></div><p className="pt-1 text-xs text-muted-foreground">Jika transfer kurang dari total tagihan, sistem mengalokasikannya berurutan mengikuti daftar di atas.</p></div>
    </div>

    {surplus > 0 && selectedJourneys.length > 1 && <label className="block text-sm font-medium">Kelebihan dicatat atas nama<select value={balanceOwnerJourneyId} onChange={(event) => setBalanceOwnerJourneyId(event.target.value)} className="mt-1.5 w-full rounded-md border bg-background px-3 py-2.5"><option value="">Pilih peserta/perjalanan</option>{selectedJourneys.map((journey) => <option key={journey.id} value={journey.id}>{journey.label} · {journey.destination}</option>)}</select><span className="mt-1 block text-xs font-normal text-muted-foreground">Saldo masuk ke Korda tujuan pada pilihan ini. Pilihan ini menjaga kepemilikan kelebihan tetap jelas bila pembayaran mencakup beberapa peserta/Korda.</span></label>}
    {selectedJourneys.length > 0 && <div className="min-w-0 rounded-lg border p-3"><h3 className="text-sm font-semibold">Rincian otomatis</h3><ul className="mt-2 space-y-2 text-sm">{previews.map((row) => { const journey = selectedJourneys.find((item) => item.id === row.journeyId)!; return <li key={row.journeyId} className="flex min-w-0 items-start justify-between gap-2"><span className="min-w-0 break-words text-muted-foreground">{journey.label} · {journey.destination}</span><span className="shrink-0 text-right"><strong>{money(row.journeyAmount)}</strong><span className="block text-xs text-muted-foreground">sisa {money(row.remainingAmount)}</span></span></li>; })}{surplus > 0 && <li className="flex min-w-0 items-start justify-between gap-2 border-t pt-1.5"><span className="min-w-0 break-words text-muted-foreground">Saldo Lain · {selectedJourneys.find((journey) => journey.id === balanceOwner)?.label ?? "pilih pemilik"}</span><strong className="shrink-0">{money(surplus)}</strong></li>}</ul></div>}

    <label className="block text-sm">Bukti transfer <span className="font-normal text-muted-foreground">(opsional · PDF/JPG/PNG/WebP · maks. 10 MB)</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setEvidence(event.target.files?.[0] ?? null)} className="mt-1.5 block w-full rounded-md border bg-background p-2 text-sm" /></label>
    <div className="flex flex-col-reverse justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center"><p className="text-xs text-muted-foreground">Pengirim tidak dicatat. Jika nominal melebihi tagihan, selisih otomatis masuk ke Saldo Lain Korda tujuan.</p><button type="button" disabled={pending || !selected.length || totalSent <= 0 || (surplus > 0 && selectedJourneys.length > 1 && !balanceOwner)} onClick={submit} className="w-full rounded-md bg-primary px-5 py-2.5 font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{pending ? "Menyimpan…" : "Simpan pembayaran"}</button></div>
  </section>;
}

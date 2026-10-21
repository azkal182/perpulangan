"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { previewRegistrationPurgeAction, purgeRegistrationGroupAction } from "../actions/registration-purge.actions";
import type { RegistrationWithDetails } from "../repositories/registrations.repository";

const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;

type PurgePreview = {
  eventId: string;
  eventName: string;
  rootParticipantName: string;
  participants: Array<{ registrationId: string; name: string; nis: string | null; originKorda: string | null; journeys: Array<{ direction: string; destination: string; dropPoint: string | null; tariff: number | null; status: string; bus: string | null }> }>;
  payments: Array<{ id: string; amount: number; paidAt: Date; note: string; allocationCount: number; evidenceName: string | null; allocations: Array<{ participant: string; type: string; amount: number; destination: string }> }>;
  paymentAmount: number;
  evidence: string[];
  financial: { safe: boolean; reason: string | null; centralCashBefore: number; centralCashAfter: number; affectedKordas: Array<{ id: string; name: string; disbursed: number; registrationEntitlementBefore: number; registrationEntitlementAfter: number; registrationReceivedBefore: number; registrationReceivedAfter: number; balanceBefore: number; balanceAfter: number; remainingSupportBefore: number; remainingSupportAfter: number }> };
  refundsOrCorrections: number;
  fingerprint: string;
};

export function DeleteRegistrationDialog({ open, onOpenChange, registration }: { open: boolean; onOpenChange: (open: boolean) => void; registration: RegistrationWithDetails | null }) {
  const router = useRouter();
  const [previewState, setPreviewState] = useState<{ registrationId: string; plan?: PurgePreview; error?: string } | null>(null);
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const registrationId = registration?.id;

  useEffect(() => {
    let cancelled = false;
    if (!open || !registrationId) return;
    previewRegistrationPurgeAction(registrationId).then((result) => {
      if (cancelled) return;
      if (result.success) setPreviewState({ registrationId, plan: result.plan as PurgePreview });
      else setPreviewState({ registrationId, error: result.error });
    }).catch(() => { if (!cancelled) setPreviewState({ registrationId, error: "Gagal memuat pratinjau penghapusan." }); });
    return () => { cancelled = true; };
  }, [open, registrationId]);

  const currentPreviewState = registration && previewState?.registrationId === registration.id ? previewState : null;
  const preview = currentPreviewState?.plan ?? null;
  const loadError = currentPreviewState?.error ?? null;
  const loading = open && !!registration && !preview && !loadError;

  const expectedConfirmation = preview ? `HAPUS PERMANEN ${preview.participants.length}` : "";
  const canSubmit = !!preview && preview.financial.safe && preview.refundsOrCorrections === 0 && reason.trim().length >= 8 && password.length > 0 && confirmation === expectedConfirmation && !submitting;

  async function handleSubmit() {
    if (!registration || !preview || !canSubmit) return;
    setSubmitting(true);
    const result = await purgeRegistrationGroupAction({ registrationId: registration.id, reason, password, confirmation, fingerprint: preview.fingerprint });
    if (result.success) {
      if (result.cleanupFailed > 0) toast.warning(`Data berhasil dipurge, tetapi ${result.cleanupFailed} bukti belum terhapus. Coba ulang dari Riwayat Hapus Permanen.`);
      else toast.success(`Purge selesai. Riwayat #${result.purgeId.slice(0, 8)} tersimpan.`);
      onOpenChange(false); router.refresh();
    } else toast.error(result.error);
    setSubmitting(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setPreviewState(null); setReason(""); setPassword(""); setConfirmation("");
    }
    onOpenChange(nextOpen);
  }

  return <Dialog open={open} onOpenChange={handleOpenChange}><DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
    <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><ShieldAlert className="size-5"/>Hapus permanen grup registrasi</DialogTitle><DialogDescription>Admin saja. Data yang dihapus tidak dapat dipulihkan. Cakupan transaksi keluarga ditelusuri sampai seluruh peserta dan pembayaran yang terhubung ditemukan.</DialogDescription></DialogHeader>
    {loading && <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin"/>Memeriksa peserta, pembayaran, dan posisi keuangan…</div>}
    {loadError && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">{loadError}</div>}
    {preview && <div className="space-y-4">
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"><p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4"/>Seluruh peserta dalam transaksi terkait akan ikut dihapus.</p><p className="mt-1 text-muted-foreground">Registrasi, perjalanan, penempatan bus, pembayaran, alokasi, dan bukti yang tercantum akan dihapus. Profil santri/peserta eksternal dan data bus tetap ada.</p></div>
      <section className="space-y-2"><h3 className="font-semibold">Peserta dan perjalanan · {preview.participants.length}</h3><div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">{preview.participants.map((person) => <article key={person.registrationId} className="text-sm"><p className="font-medium">{person.name}{person.nis ? <span className="ml-2 font-normal text-muted-foreground">NIS {person.nis}</span> : null}</p><p className="text-xs text-muted-foreground">Asal {person.originKorda ?? "tidak tercatat"} · {person.journeys.map((journey) => `${journey.direction === "OUTBOUND" ? "Pulang" : "Kembali"}: ${journey.destination}${journey.dropPoint ? ` · ${journey.dropPoint}` : ""} · tarif ${journey.tariff === null ? "tidak diketahui" : money(journey.tariff)} · bus ${journey.bus ?? "belum dialokasikan"}`).join("; ") || "Tidak ada perjalanan"}</p></article>)}</div></section>
      <section className="space-y-2"><h3 className="font-semibold">Pembayaran keluarga · {preview.payments.length} transaksi · total {money(preview.paymentAmount)}</h3>{preview.payments.length ? <div className="space-y-2 rounded-md border p-3">{preview.payments.map((payment) => <div key={payment.id} className="text-sm"><div className="flex flex-wrap justify-between gap-2"><span>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(payment.paidAt))}{payment.evidenceName ? ` · bukti ${payment.evidenceName}` : ""}</span><strong>{money(payment.amount)}</strong></div><ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">{payment.allocations.map((allocation, index) => <li key={`${payment.id}-${index}`}>{allocation.participant} · {allocation.type === "BALANCE" ? "Saldo Lain" : "Tagihan"} {money(allocation.amount)} · {allocation.destination}</li>)}</ul></div>)}</div> : <p className="text-sm text-muted-foreground">Tidak ada pembayaran yang tertaut.</p>}</section>
      <section className="space-y-2"><h3 className="font-semibold">Proyeksi dana setelah purge</h3><div className="rounded-md border p-3 text-sm"><p>Kas pusat: {money(preview.financial.centralCashBefore)} → {money(preview.financial.centralCashAfter)}</p>{preview.financial.affectedKordas.map((korda) => <div key={korda.id} className="mt-2 border-t pt-2"><p className="font-medium">{korda.name}</p><p className="text-muted-foreground">Dana tersedia setelah pencairan: {money(korda.remainingSupportBefore)} → {money(korda.remainingSupportAfter)} · sudah dicairkan {money(korda.disbursed)}</p><p className="text-xs text-muted-foreground">Hak bersih: {money(korda.registrationEntitlementBefore)} → {money(korda.registrationEntitlementAfter)} · penerimaan tagihan: {money(korda.registrationReceivedBefore)} → {money(korda.registrationReceivedAfter)} · Saldo Lain: {money(korda.balanceBefore)} → {money(korda.balanceAfter)}</p></div>)}</div>{!preview.financial.safe && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">Penghapusan diblokir: {preview.financial.reason}</p>}{preview.refundsOrCorrections > 0 && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">Penghapusan diblokir: ditemukan {preview.refundsOrCorrections} refund/koreksi. Rekonsiliasi transaksi tersebut terlebih dahulu.</p>}</section>
      <div className="space-y-2"><Label htmlFor="purge-reason">Alasan penghapusan</Label><Textarea id="purge-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Jelaskan alasan koreksi data ini (minimal 8 karakter)." /></div>
      <div className="space-y-2"><Label htmlFor="purge-confirm">Ketik <span className="font-mono text-destructive">{expectedConfirmation}</span></Label><Input id="purge-confirm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></div>
      <div className="space-y-2"><Label htmlFor="purge-password">Password akun Admin</Label><Input id="purge-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></div>
    </div>}
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Tutup</Button><Button variant="destructive" onClick={handleSubmit} disabled={!canSubmit}>{submitting ? "Menghapus…" : "Konfirmasi hapus permanen"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, UserRoundX, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cancelOutboundDisposition, createOutboundDisposition, updateOutboundDisposition } from "../actions/outbound-roster.actions";
import type { OutboundDispositionReason } from "@/generated/prisma/client";

type StudentSummary = { id: string; name: string; nis: string | null; dormitory: string | null; regency: { name: string; korda: { name: string } | null } | null };
type RosterData = {
  event: { id: string; name: string; status: string };
  reasons: Array<{ value: string; label: string }>;
  counts: { candidates: number; excluded: number; registered: number; history: number };
  pagination: { page: number; pageSize: number };
  candidates: StudentSummary[];
  excluded: Array<{ id: string; reason: OutboundDispositionReason; createdAt: Date; updatedAt: Date; student: StudentSummary; history: Array<{ fromReason: OutboundDispositionReason | null; toReason: OutboundDispositionReason; fromStatus: string | null; toStatus: string; actorUserId: string; actorName: string; createdAt: Date }> }>;
  historyRows: Array<{ id: string; reason: OutboundDispositionReason; status: "ACTIVE" | "COMPLETED" | "CANCELLED"; createdAt: Date; updatedAt: Date; student: StudentSummary; history: Array<{ fromReason: OutboundDispositionReason | null; toReason: OutboundDispositionReason; fromStatus: string | null; toStatus: string; actorUserId: string; actorName: string; createdAt: Date }> }>;
  registered: Array<StudentSummary & { journeyId: string; destinationKordaName: string; dropPointName: string }>;
};

const reasonText: Record<OutboundDispositionReason, string> = {
  WISUDA: "Wisuda",
  PARTISIPAN: "Partisipan",
  SEDANG_PULANG: "Sedang Pulang",
};
const statusText: Record<RosterData["historyRows"][number]["status"], string> = { ACTIVE: "Aktif", COMPLETED: "Selesai · terdaftar Pulang", CANCELLED: "Dibatalkan" };

type DialogState = { mode: "create" | "edit"; student?: StudentSummary; dispositionId?: string; reason?: OutboundDispositionReason } | null;

function StudentTable({ rows, action }: { rows: StudentSummary[]; action?: (student: StudentSummary) => React.ReactNode }) {
  if (!rows.length) return <p className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Tidak ada data pada daftar ini.</p>;
  return <Table>
    <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>NIS</TableHead><TableHead>Asrama</TableHead><TableHead>Kabupaten/Kota asal</TableHead><TableHead>Korda asal</TableHead>{action && <TableHead className="text-right">Aksi</TableHead>}</TableRow></TableHeader>
    <TableBody>{rows.map((student) => <TableRow key={student.id}>
      <TableCell className="font-medium">{student.name}</TableCell><TableCell>{student.nis || "—"}</TableCell><TableCell>{student.dormitory || "—"}</TableCell><TableCell>{student.regency?.name || "Belum terhubung"}</TableCell><TableCell>{student.regency?.korda?.name || "—"}</TableCell>{action && <TableCell className="text-right">{action(student)}</TableCell>}
    </TableRow>)}</TableBody>
  </Table>;
}

export function OutboundRosterManager({ data, canManage, search, page, pageSize, view }: { data: RosterData; canManage: boolean; search: string; page: number; pageSize: number; view: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [historyRow, setHistoryRow] = useState<RosterData["excluded"][number] | null>(null);
  const [activeView, setActiveView] = useState(["candidates", "excluded", "registered", "history"].includes(view) ? view : "candidates");
  const [reason, setReason] = useState<string>("");

  function openDialog(next: NonNullable<DialogState>) {
    setReason(next.reason ?? "");
    setDialog(next);
  }

  async function saveDisposition() {
    if (!dialog || !reason) return;
    startTransition(async () => {
      const result = dialog.mode === "create"
        ? await createOutboundDisposition({ eventId: data.event.id, studentId: dialog.student!.id, reason: reason as OutboundDispositionReason })
        : await updateOutboundDisposition({ dispositionId: dialog.dispositionId!, reason: reason as OutboundDispositionReason });
      if (!result.success) { toast.error(result.error); return; }
      toast.success(dialog.mode === "create" ? "Pengecualian Pulang dicatat." : "Alasan pengecualian diperbarui.");
      setDialog(null);
      router.refresh();
    });
  }

  async function cancelDisposition(dispositionId: string) {
    startTransition(async () => {
      const result = await cancelOutboundDisposition(dispositionId);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Pengecualian dibatalkan. Santri kembali ke daftar calon Pulang.");
      router.refresh();
    });
  }

  const regionText = search ? `Hasil pencarian “${search}”` : "Semua santri dalam cakupan data Anda";
  const activeCount = activeView === "excluded" ? data.counts.excluded : activeView === "registered" ? data.counts.registered : activeView === "history" ? data.counts.history : data.counts.candidates;
  const pageCount = Math.max(1, Math.ceil(activeCount / pageSize));
  const pageHref = (nextPage: number) => `/data-pulang?${new URLSearchParams({ eventId: data.event.id, ...(search ? { q: search } : {}), view: activeView, page: String(nextPage) }).toString()}`;
  return <>
    <div className="grid gap-3 sm:grid-cols-3">
      <Card><CardContent className="flex items-center gap-3 p-4"><UserRoundX className="size-5 text-amber-600"/><div><p className="text-sm text-muted-foreground">Belum terdaftar Pulang</p><p className="text-2xl font-semibold">{data.counts.candidates}</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 p-4"><UserRoundX className="size-5 text-muted-foreground"/><div><p className="text-sm text-muted-foreground">Tidak ikut Pulang</p><p className="text-2xl font-semibold">{data.counts.excluded}</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 p-4"><UserRoundCheck className="size-5 text-emerald-600"/><div><p className="text-sm text-muted-foreground">Sudah terdaftar Pulang</p><p className="text-2xl font-semibold">{data.counts.registered}</p></div></CardContent></Card>
    </div>
    <Card>
      <CardHeader className="gap-1"><CardTitle className="text-lg">Roster Pulang · {data.event.name}</CardTitle><p className="text-sm text-muted-foreground">{regionText}. Daftar mencakup santri aktif. Peserta yang hanya terdaftar untuk Kembali tetap muncul sebagai calon Pulang.</p></CardHeader>
      <CardContent>
        <Tabs value={activeView} onValueChange={(value) => { setActiveView(value); const params = new URLSearchParams(window.location.search); params.set("view", value); params.set("page", "1"); router.replace(`/data-pulang?${params.toString()}`); }} className="space-y-4">
          <TabsList className="h-auto flex-wrap"><TabsTrigger value="candidates">Belum terdaftar <Badge variant="secondary" className="ml-2">{data.counts.candidates}</Badge></TabsTrigger><TabsTrigger value="excluded">Tidak ikut <Badge variant="secondary" className="ml-2">{data.counts.excluded}</Badge></TabsTrigger><TabsTrigger value="registered">Sudah terdaftar <Badge variant="secondary" className="ml-2">{data.counts.registered}</Badge></TabsTrigger><TabsTrigger value="history">Riwayat pengecualian <Badge variant="secondary" className="ml-2">{data.counts.history}</Badge></TabsTrigger></TabsList>
          <TabsContent value="candidates"><StudentTable rows={data.candidates} action={canManage ? (student) => <Button size="sm" variant="outline" disabled={pending} onClick={() => openDialog({ mode: "create", student })}>Catat tidak ikut</Button> : undefined}/></TabsContent>
          <TabsContent value="excluded">
            {data.excluded.length ? <Table><TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>NIS</TableHead><TableHead>Alasan</TableHead><TableHead className="text-right">Riwayat</TableHead>{canManage && <TableHead className="text-right">Aksi</TableHead>}</TableRow></TableHeader><TableBody>{data.excluded.map((row) => <TableRow key={row.id}><TableCell className="font-medium">{row.student.name}</TableCell><TableCell>{row.student.nis || "—"}</TableCell><TableCell><Badge variant="outline">{reasonText[row.reason]}</Badge></TableCell><TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setHistoryRow(row)}>Lihat ({row.history.length})</Button></TableCell>{canManage && <TableCell className="space-x-2 text-right"><Button size="sm" variant="outline" disabled={pending} onClick={() => openDialog({ mode: "edit", dispositionId: row.id, reason: row.reason })}><Pencil className="mr-1 size-3.5"/>Ubah alasan</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => cancelDisposition(row.id)}>Batalkan</Button></TableCell>}</TableRow>)}</TableBody></Table> : <p className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Belum ada pengecualian Pulang untuk event ini.</p>}
          </TabsContent>
          <TabsContent value="registered"><StudentTable rows={data.registered} action={(student) => { const item = data.registered.find((row) => row.id === student.id); return <span className="text-sm text-muted-foreground">{item?.destinationKordaName} · {item?.dropPointName}</span>; }}/></TabsContent>
          <TabsContent value="history">{data.historyRows.length ? <Table><TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Alasan</TableHead><TableHead>Status catatan</TableHead><TableHead className="text-right">Audit</TableHead></TableRow></TableHeader><TableBody>{data.historyRows.map((row) => <TableRow key={row.id}><TableCell className="font-medium">{row.student.name}</TableCell><TableCell>{reasonText[row.reason]}</TableCell><TableCell><Badge variant={row.status === "ACTIVE" ? "outline" : "secondary"}>{statusText[row.status]}</Badge></TableCell><TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setHistoryRow(row)}>Lihat ({row.history.length})</Button></TableCell></TableRow>)}</TableBody></Table> : <p className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Belum ada riwayat pengecualian Pulang untuk event ini.</p>}</TabsContent>
        </Tabs>
        <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Menampilkan halaman {page} dari {pageCount} · {activeCount.toLocaleString("id-ID")} santri</p>
          <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => router.push(pageHref(Math.max(1, page - 1)))}>Sebelumnya</Button><Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => router.push(pageHref(Math.min(pageCount, page + 1)))}>Berikutnya</Button></div>
        </div>
      </CardContent>
    </Card>
    <Dialog open={!!dialog} onOpenChange={(open) => { if (!open && !pending) setDialog(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{dialog?.mode === "create" ? "Catat tidak ikut Pulang" : "Ubah alasan pengecualian"}</DialogTitle><DialogDescription>{dialog?.mode === "create" ? <>{dialog.student?.name} tidak akan ditampilkan sebagai calon Pulang untuk event {data.event.name}. Catatan ini tidak membuat pendaftaran atau tagihan, dan tidak memengaruhi perjalanan Kembali.</> : "Perubahan alasan disimpan dalam riwayat audit."}</DialogDescription></DialogHeader>
        <label className="grid gap-2 text-sm font-medium">Alasan wajib dipilih
          <Select value={reason} onValueChange={setReason}><SelectTrigger><SelectValue placeholder="Pilih alasan"/></SelectTrigger><SelectContent>{data.reasons.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
        </label>
        <DialogFooter><Button variant="outline" onClick={() => setDialog(null)} disabled={pending}>Batal</Button><Button onClick={saveDisposition} disabled={!reason || pending}>{pending ? <><Loader2 className="mr-2 size-4 animate-spin"/>Menyimpan...</> : <><Check className="mr-2 size-4"/>Simpan</>}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={!!historyRow} onOpenChange={(open) => { if (!open) setHistoryRow(null); }}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Riwayat pengecualian</DialogTitle><DialogDescription>{historyRow?.student.name} · {data.event.name}</DialogDescription></DialogHeader>
        <ol className="space-y-3">{historyRow?.history.map((item, index) => <li key={`${item.actorUserId}-${item.createdAt.toISOString()}-${index}`} className="rounded-md border p-3 text-sm"><p className="font-medium">{item.fromStatus ? `${item.fromStatus} → ${item.toStatus}` : "Pengecualian dicatat"}</p><p className="text-muted-foreground">Alasan: {item.fromReason && item.fromReason !== item.toReason ? `${reasonText[item.fromReason]} → ` : ""}{reasonText[item.toReason]}</p><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))} · {item.actorName}</p></li>)}</ol>
      </DialogContent>
    </Dialog>
  </>;
}

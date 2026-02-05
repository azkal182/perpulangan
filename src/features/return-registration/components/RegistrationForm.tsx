"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // pastikan ada, jika belum: ganti <textarea className=...>
import { Separator } from "@/components/ui/separator";

import { TripSelectors } from "./TripSelectors";
import { GroupMembersEditor } from "./GroupMembersEditor";
import { SummaryCard } from "./SummaryCard";
import type { DropPoint, Korda, Korwil, Kota, RegistrationDraft } from "../types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  korwils: Korwil[];
  kordas: Korda[];
  kotas: Kota[];
  dropPoints: DropPoint[];

  draft: RegistrationDraft;

  errors: Record<string, string>;
  canSubmit: boolean;

  onKorwil: (id: string | null) => void;
  onKorda: (id: string | null) => void;
  onKota: (id: string | null) => void;
  onDropPoint: (id: string | null) => void;

  onDepartDate: (v: string) => void;

  onBookerName: (v: string) => void;
  onBookerPhone: (v: string) => void;
  onNotes: (v: string) => void;

  onAddMember: () => void;
  onUpdateMember: (id: string, patch: any) => void;
  onRemoveMember: (id: string) => void;

  memberCount: number;
  pricePerPerson: number;
  total: number;

  onReset: () => void;
  onSubmit: () => Promise<{ ok: boolean; message: string }>;
};

export function RegistrationForm(props: Props) {
  const {
    korwils,
    kordas,
    kotas,
    dropPoints,
    draft,
    errors,
    canSubmit,
    onKorwil,
    onKorda,
    onKota,
    onDropPoint,
    onDepartDate,
    onBookerName,
    onBookerPhone,
    onNotes,
    onAddMember,
    onUpdateMember,
    onRemoveMember,
    memberCount,
    pricePerPerson,
    total,
    onReset,
    onSubmit,
  } = props;

  const [submitting, setSubmitting] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  // State untuk menyimpan data
const [bookers, setBookers] = React.useState<any[]>([
  {
    id: "1",
    name: "Budi Santoso",
    address: "Jl. Merdeka No. 123, Jakarta Pusat"
  },
  {
    id: "2",
    name: "Siti Aminah",
    address: "Jl. Sudirman No. 456, Bandung"
  },
  {
    id: "3",
    name: "Ahmad Fauzi",
    address: "Jl. Gatot Subroto No. 789, Surabaya"
  },
  {
    id: "4",
    name: "Dewi Lestari",
    address: "Jl. Diponegoro No. 321, Yogyakarta"
  },
  {
    id: "5",
    name: "Eko Prasetyo",
    address: "Jl. Ahmad Yani No. 654, Semarang"
  }
]); // Array pemesan
const [selectedBooker, setSelectedBooker] = React.useState<any>(null);

// Handler untuk select
const onBookerSelect = (bookerId: string) => {
  const booker = bookers.find(b => b.id === bookerId);
  setSelectedBooker(booker);
  // Update draft dengan bookerId
//   setDraft({ ...draft, bookerId });
};

// Handler untuk tombol registrasi
const onRegisterBooker = () => {
  // Buka modal/form registrasi pemesan baru
};

  async function submit() {
    setSubmitting(true);
    setToast(null);
    try {
      const res = await onSubmit();
      setToast(res.message);
      if (res.ok) onReset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Rute & Titik Turun</CardTitle>
            <CardDescription>Pilih Korwil/Korda, kemudian pilih titik turun beserta harga.</CardDescription>
          </CardHeader>
          <CardContent>
            <TripSelectors
              korwils={korwils}
              kordas={kordas}
              kotas={kotas}
              dropPoints={dropPoints}
              korwilId={draft.korwilId}
              kordaId={draft.kordaId}
              kotaId={draft.kotaId}
              dropPointId={draft.dropPointId}
              departDate={draft.departDate}
              onKorwil={onKorwil}
              onKorda={onKorda}
              onKota={onKota}
              onDropPoint={onDropPoint}
              onDepartDate={onDepartDate}
              pricePerPerson={pricePerPerson}
              errorKorwil={errors.korwilId}
              errorKorda={errors.kordaId}
              errorDropPoint={errors.dropPointId}
              errorDepartDate={errors.departDate}
            />
          </CardContent>
        </Card>

<Card>
  <CardHeader>
    <CardTitle>Data Pemesan</CardTitle>
    <CardDescription>Kontak utama untuk rombongan.</CardDescription>
  </CardHeader>
  <CardContent className="space-y-3">
    {/* Select fullwidth */}
    <div className="space-y-1">
      <div className="text-sm font-medium">Nama</div>
      <Select value={draft.bookerId} onValueChange={(value) => onBookerSelect(value)}>
        <SelectTrigger>
          <SelectValue placeholder="Pilih pemesan" />
        </SelectTrigger>
        <SelectContent>
          {bookers.map((booker) => (
            <SelectItem key={booker.id} value={booker.id}>
              {booker.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {errors.bookerId ? <div className="text-xs text-destructive">{errors.bookerId}</div> : null}
    </div>

    {/* Informasi pemesan yang dipilih */}
    {selectedBooker && (
      <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
        <div className="text-sm">
          <span className="font-medium">Nama:</span> {selectedBooker.name}
        </div>
        <div className="text-sm">
          <span className="font-medium">Alamat:</span> {selectedBooker.address}
        </div>
      </div>
    )}

    <div className="space-y-1">
      <div className="text-sm font-medium">Catatan (opsional)</div>
      <Textarea value={draft.notes} onChange={(e) => onNotes(e.target.value)} placeholder="Catatan tambahan..." />
    </div>

    {/* Tombol di kanan bawah */}
    <div className="flex justify-end">
      <Button variant="outline" onClick={onRegisterBooker}>
        Registrasi Pemesan Baru
      </Button>
    </div>
  </CardContent>
</Card>


        <Card>
          <CardHeader>
            <CardTitle>Aksi</CardTitle>
            <CardDescription>Simpan registrasi atau reset form.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {toast ? <div className="text-sm">{toast}</div> : null}
            <Separator />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={onReset} disabled={submitting}>
                Reset
              </Button>
              <Button type="button" onClick={submit} disabled={!canSubmit || submitting}>
                {submitting ? "Menyimpan..." : "Simpan Registrasi"}
              </Button>
            </div>
            {!canSubmit ? (
              <div className="text-xs text-muted-foreground">
                Lengkapi field wajib: Korwil, Korda, Titik Turun, Tanggal, Data Pemesan, dan minimal 1 anggota.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SummaryCard memberCount={memberCount} pricePerPerson={pricePerPerson} total={total} />
      </div>
    </div>
  );
}

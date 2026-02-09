"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useDropPoints } from "./hooks/useDropPoints";
import { FiltersBar } from "./components/FiltersBar";
import { DropPointDialog } from "./components/DropPointDialog";
import { DropPointRow } from "./components/DropPointRow";

export default function DropPointsPageView() {
  const dp = useDropPoints();

  const lockedKordaId = dp.kordaId === "all" ? null : dp.kordaId;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">Master Titik Turun</div>
            <div className="text-sm text-muted-foreground">Korda → Titik Turun (dengan harga)</div>
          </div>

          <DropPointDialog
            mode="create"
            open={dp.openCreate}
            onOpenChange={dp.setOpenCreate}
            triggerLabel="+ Tambah Titik Turun"
            kordas={dp.kordasFilteredByKorwil}
            lockedKordaId={lockedKordaId}
            initial={null}
            onSubmit={(payload) => dp.create(payload)}
          />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Filter</CardTitle>
            <CardDescription>Batasi data berdasarkan Korwil/Korda dan lakukan pencarian.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FiltersBar
              korwils={dp.korwils}
              kordas={dp.kordasFilteredByKorwil}
              selectedKorwilId={dp.korwilId}
              onSelectKorwilId={dp.setKorwilId}
              selectedKordaId={dp.kordaId}
              onSelectKordaId={dp.setKordaId}
              search={dp.q}
              onSearch={dp.setQ}
              onReset={dp.resetFilters}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Daftar Titik Turun</CardTitle>
                <CardDescription>Hasil sesuai filter.</CardDescription>
              </div>
              <div className="text-sm text-muted-foreground">{dp.dropPoints.length} item</div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <Separator />

            {dp.dropPoints.length === 0 ? (
              <div className="text-sm text-muted-foreground">Tidak ada data untuk filter saat ini.</div>
            ) : (
              <div className="space-y-2">
                {dp.dropPoints.map((item) => {
                  const korda = dp.getKordaById(item.kordaId);
                  const korwil = korda ? dp.getKorwilById(korda.korwilId ?? "") : undefined;

                  return (
                    <DropPointRow
                      key={item.id}
                      item={item}
                      korda={korda}
                      korwil={korwil}
                      onEdit={(x) => dp.startEdit(x)}
                      onDelete={(id) => dp.remove(id)}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit dialog */}
        <DropPointDialog
          mode="edit"
          open={dp.openEdit}
          onOpenChange={(v) => {
            dp.setOpenEdit(v);
            if (!v) {
              // optional: cleanup editing
              // dp.setEditing(null) -> saat ini editing di-reset saat update
            }
          }}
          triggerLabel="Edit"
          kordas={dp.kordasFilteredByKorwil.length ? dp.kordasFilteredByKorwil : dp.kordas}
          lockedKordaId={null} // edit jangan dikunci filter
          initial={dp.editing}
          onSubmit={(payload) => dp.update(payload)}
        />
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useDropPoints } from "./hooks/useDropPoints";
import { FiltersBar } from "./components/FiltersBar";
import { DropPointDialog } from "./components/DropPointDialog";
import { DropPointRow } from "./components/DropPointRow";

const PAGE_SIZE = 10;

export default function DropPointsPageView() {
  const dp = useDropPoints();
  const [page, setPage] = React.useState(1);

  const lockedKordaId = dp.kordaId === "all" ? null : dp.kordaId;
  const totalItems = dp.dropPoints.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  React.useEffect(() => {
    setPage(1);
  }, [dp.korwilId, dp.kordaId, dp.q]);

  React.useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedDropPoints = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return dp.dropPoints.slice(start, start + PAGE_SIZE);
  }, [dp.dropPoints, page]);

  const startItem = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, totalItems);

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

            {totalItems === 0 ? (
              <div className="text-sm text-muted-foreground">Tidak ada data untuk filter saat ini.</div>
            ) : (
              <>
                <div className="space-y-2">
                  {paginatedDropPoints.map((item) => {
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

                <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-muted-foreground">
                    Menampilkan {startItem}-{endItem} dari {totalItems} item
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label="Sebelumnya"
                      className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                      disabled={page <= 1}
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Sebelumnya</span>
                    </Button>
                    <div className="min-w-24 text-center text-sm text-muted-foreground">
                      Halaman {page} / {totalPages}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label="Berikutnya"
                      className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((prev) => Math.min(totalPages, prev + 1))
                      }
                    >
                      <span className="hidden sm:inline">Berikutnya</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
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

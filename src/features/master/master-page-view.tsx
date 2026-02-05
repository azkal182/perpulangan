"use client";

import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

import { useMaster } from "./hooks/use-master";
import { TopBar } from "./components/TopBar";
import { ColumnCard } from "./components/ColumnCard";
import { AddEntityDialog } from "./components/AddEntityDialog";
import { ListRow } from "./components/ListRow";
import { ConfirmDeleteButton } from "./components/ConfirmDeleteButton";

export default function MasterPageView() {
  const h = useMaster();

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        currentStep={h.currentStep}
        selectedKorwilName={h.selectedKorwil?.name ?? null}
        selectedKordaName={h.selectedKorda?.name ?? null}
        onReset={h.resetSelection}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-4">


        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* KORWIL */}
          <ColumnCard
            title="Korwil"
            description="Step 1 — pilih Korwil"
            headerRight={
              <AddEntityDialog
                open={h.openAddKorwil}
                onOpenChange={h.setOpenAddKorwil}
                triggerLabel="+ Tambah"
                title="Tambah Korwil"
                description="Masukkan nama Korwil baru."
                inputLabel="Nama Korwil"
                placeholder="Contoh: Jawa Barat"
                value={h.korwilName}
                onChange={h.setKorwilName}
                onSubmit={h.addKorwil}
              />
            }
            top={
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">{h.state.korwils.length} item</div>
              </div>
            }
          >
            <>
              <Input value={h.qKorwil} onChange={(e) => h.setQKorwil(e.target.value)} placeholder="Search korwil…" />

              <ScrollArea className="h-[360px] pr-2">
                <div className="mt-3 space-y-2">
                  {h.korwilsFiltered.map((k) => {
                    const active = h.state.selectedKorwilId === k.id;
                    const childCount = (h.state.kordasByKorwil[k.id] ?? []).length;

                    return (
                      <ListRow
                        key={k.id}
                        active={active}
                        title={k.name}
                        meta={`${childCount} korda`}
                        onSelect={() => h.selectKorwil(k.id)}
                        right={
                          <ConfirmDeleteButton
                            title="Hapus Korwil?"
                            description={
                              <>
                                Korwil <b>{k.name}</b> akan dihapus. Perilaku delete tetap simple (tanpa blok). Data anak di-cleanup dari
                                UI state.
                              </>
                            }
                            onConfirm={() => h.deleteKorwil(k.id)}
                          />
                        }
                      />
                    );
                  })}

                  {h.korwilsFiltered.length === 0 && (
                    <div className="text-sm text-muted-foreground">Tidak ada hasil.</div>
                  )}
                </div>
              </ScrollArea>
            </>
          </ColumnCard>

          {/* KORDA */}
          <ColumnCard
            title="Korda"
            description="Step 2 — tergantung Korwil"
            headerRight={
              <AddEntityDialog
                open={h.openAddKorda}
                onOpenChange={(v) => {
                  if (!h.state.selectedKorwilId) return;
                  h.setOpenAddKorda(v);
                }}
                triggerLabel="+ Tambah"
                title="Tambah Korda"
                description={h.selectedKorwil ? `Korwil: ${h.selectedKorwil.name}` : ""}
                inputLabel="Nama Korda"
                placeholder="Contoh: Bandung Raya"
                value={h.kordaName}
                onChange={h.setKordaName}
                onSubmit={h.addKorda}
                disabled={!h.state.selectedKorwilId}
              />
            }
            top={
              !h.state.selectedKorwilId ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Pilih <b>Korwil</b> untuk melihat dan menambahkan <b>Korda</b>.
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary">Korwil: {h.selectedKorwil?.name}</Badge>
                  <div className="text-sm text-muted-foreground">{h.kordas.length} item</div>
                </div>
              )
            }
          >
            {!h.state.selectedKorwilId ? null : (
              <>
                <Input value={h.qKorda} onChange={(e) => h.setQKorda(e.target.value)} placeholder="Search korda…" />

                <ScrollArea className="h-[360px] pr-2">
                  <div className="mt-3 space-y-2">
                    {h.kordasFiltered.map((kd) => {
                      const active = h.state.selectedKordaId === kd.id;
                      const cityCount = (h.state.kotasByKorda[kd.id] ?? []).length;

                      return (
                        <ListRow
                          key={kd.id}
                          active={active}
                          title={kd.name}
                          meta={`${cityCount} kota`}
                          onSelect={() => h.selectKorda(kd.id)}
                          right={
                            <ConfirmDeleteButton
                              title="Hapus Korda?"
                              description={
                                <>
                                  Korda <b>{kd.name}</b> akan dihapus. Perilaku delete tetap (tidak memblok walau punya kota).
                                </>
                              }
                              onConfirm={() => h.deleteKorda(kd.id)}
                            />
                          }
                        />
                      );
                    })}

                    {h.kordasFiltered.length === 0 && (
                      <div className="text-sm text-muted-foreground">Tidak ada hasil.</div>
                    )}
                    {h.kordas.length === 0 && (
                      <div className="text-sm text-muted-foreground">Belum ada korda untuk korwil ini.</div>
                    )}
                  </div>
                </ScrollArea>
              </>
            )}
          </ColumnCard>

          {/* KOTA */}
          <ColumnCard
            title="Cakupan Kota"
            description="Step 3 — tergantung Korda"
            headerRight={
              <AddEntityDialog
                open={h.openAddKota}
                onOpenChange={(v) => {
                  if (!h.state.selectedKordaId) return;
                  h.setOpenAddKota(v);
                }}
                triggerLabel="+ Tambah"
                title="Tambah Kota"
                description={h.selectedKorda ? `Korda: ${h.selectedKorda.name}` : ""}
                inputLabel="Nama Kota"
                placeholder="Contoh: Kota Bandung"
                value={h.kotaName}
                onChange={h.setKotaName}
                onSubmit={h.addKota}
                disabled={!h.state.selectedKordaId}
              />
            }
            top={
              !h.state.selectedKordaId ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Pilih <b>Korda</b> untuk melihat dan menambahkan <b>Kota</b>.
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary">Korda: {h.selectedKorda?.name}</Badge>
                  <div className="text-sm text-muted-foreground">{h.kotas.length} item</div>
                </div>
              )
            }
          >
            {!h.state.selectedKordaId ? null : (
              <>
                <Input value={h.qKota} onChange={(e) => h.setQKota(e.target.value)} placeholder="Search kota…" />

                <ScrollArea className="h-[360px] pr-2">
                  <div className="mt-3 space-y-2">
                    {h.kotasFiltered.map((kt) => (
                      <ListRow
                        key={kt.id}
                        title={kt.name}
                        meta={kt.id} // kalau mau sembunyikan id, hapus meta ini
                        disabled
                        right={
                          <ConfirmDeleteButton
                            title="Hapus Kota?"
                            description={
                              <>
                                Kota <b>{kt.name}</b> akan dihapus.
                              </>
                            }
                            onConfirm={() => h.deleteKota(kt.id)}
                          />
                        }
                      />
                    ))}

                    {h.kotasFiltered.length === 0 && (
                      <div className="text-sm text-muted-foreground">Tidak ada hasil.</div>
                    )}
                    {h.kotas.length === 0 && (
                      <div className="text-sm text-muted-foreground">Belum ada kota untuk korda ini.</div>
                    )}
                  </div>
                </ScrollArea>
              </>
            )}
          </ColumnCard>
        </div>
      </div>
    </div>
  );
}

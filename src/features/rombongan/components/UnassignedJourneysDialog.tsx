"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownRight, Bus, ChevronsUpDown, Loader2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getUnassignedJourneys,
  getEligibleBusesForJourney,
  assignJourneyToBus,
  type UnassignedJourneyRow,
  type EligibleBusOption,
} from "../actions/passenger.actions";

type Props = {
  eventId: string;
  eventName: string;
  direction: "OUTBOUND" | "RETURN";
  korwilId?: string;
  kordaId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChooseKorda: (kordaId: string, direction: "OUTBOUND" | "RETURN") => void;
  onAssigned?: () => void;
};

const PAGE_SIZE = 25;

export function UnassignedJourneysDialog({
  eventId,
  eventName,
  direction,
  korwilId,
  kordaId,
  open,
  onOpenChange,
  onChooseKorda,
  onAssigned,
}: Props) {
  const [journeys, setJourneys] = useState<UnassignedJourneyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick-assign state per journey row
  const [busPopoverOpen, setBusPopoverOpen] = useState<string | null>(null);
  const [busOptions, setBusOptions] = useState<EligibleBusOption[]>([]);
  const [busOptionsLoading, setBusOptionsLoading] = useState(false);
  const [assigningJourneyId, setAssigningJourneyId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  const loadJourneys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getUnassignedJourneys({ eventId, direction, korwilId, kordaId, page });
      setJourneys(result.journeys);
      setTotal(result.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat daftar perjalanan.");
    } finally {
      setLoading(false);
    }
  }, [eventId, direction, korwilId, kordaId, page]);

  useEffect(() => {
    if (!open) return;
    void loadJourneys();
  }, [open, loadJourneys]);

  const directionLabel = direction === "OUTBOUND" ? "Pulang" : "Kembali";
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleOpenBusPopover(journeyId: string) {
    setBusPopoverOpen(journeyId);
    setBusOptionsLoading(true);
    setBusOptions([]);
    setAssignError(null);
    try {
      const options = await getEligibleBusesForJourney(journeyId);
      setBusOptions(options);
    } catch (cause) {
      setAssignError(cause instanceof Error ? cause.message : "Gagal memuat bus.");
    } finally {
      setBusOptionsLoading(false);
    }
  }

  async function handleQuickAssign(journeyId: string, busId: string) {
    setAssigningJourneyId(journeyId);
    setAssignError(null);
    try {
      await assignJourneyToBus(journeyId, busId);
      // Remove from list optimistically
      setJourneys((prev) => prev.filter((j) => j.journeyId !== journeyId));
      setTotal((prev) => Math.max(0, prev - 1));
      setBusPopoverOpen(null);
      onAssigned?.();
    } catch (cause) {
      setAssignError(cause instanceof Error ? cause.message : "Gagal menempatkan.");
    } finally {
      setAssigningJourneyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Belum ditempatkan · {directionLabel}</DialogTitle>
          <DialogDescription>
            Perjalanan terdaftar pada event {eventName} yang belum masuk bus. Pilih bus langsung atau lihat armada Korda.
          </DialogDescription>
        </DialogHeader>

        {assignError && (
          <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">{assignError}</div>
        )}

        {error ? (
          <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : journeys.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Tidak ada perjalanan {directionLabel.toLowerCase()} yang belum ditempatkan pada filter ini.</div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />{total} perjalanan perlu ditempatkan</div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {journeys.map((journey) => (
                <div key={journey.journeyId} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{journey.participantName}</span>
                      {journey.participantNis && <Badge variant="outline">{journey.participantNis}</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <span>Korda tujuan: {journey.destinationKordaName}</span>
                      <span className="mx-2">·</span>
                      <span>Titik: {journey.dropPointName}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {/* Quick-assign bus popover */}
                    <Popover
                      open={busPopoverOpen === journey.journeyId}
                      onOpenChange={(isOpen) => {
                        if (isOpen) {
                          void handleOpenBusPopover(journey.journeyId);
                        } else {
                          setBusPopoverOpen(null);
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-1.5"
                          disabled={assigningJourneyId === journey.journeyId}
                        >
                          {assigningJourneyId === journey.journeyId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Bus className="h-3.5 w-3.5" />
                          )}
                          Tempatkan
                          <ChevronsUpDown className="h-3 w-3 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-0" align="end">
                        <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                          Pilih bus untuk {journey.participantName}
                        </div>
                        {busOptionsLoading ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : busOptions.length === 0 ? (
                          <div className="p-3 text-center text-xs text-muted-foreground">
                            Tidak ada bus tersedia untuk Korda ini.
                          </div>
                        ) : (
                          <div className="max-h-48 overflow-y-auto">
                            {busOptions.map((bus) => {
                              const pct = Math.round((bus.assigned / bus.capacity) * 100);
                              const isFull = bus.assigned >= bus.capacity;
                              return (
                                <button
                                  key={bus.id}
                                  disabled={isFull || assigningJourneyId !== null}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                                  onClick={() => void handleQuickAssign(journey.journeyId, bus.id)}
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">{bus.label}</p>
                                    <div className="mt-1 flex items-center gap-2">
                                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                        <div
                                          className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                                        {bus.assigned}/{bus.capacity}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>

                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => onChooseKorda(journey.destinationKordaId, direction)}>
                      <ArrowDownRight className="mr-1.5 h-3.5 w-3.5" />
                      Armada Korda
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
              <span>Halaman {page} dari {pageCount}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Sebelumnya</Button>
                <Button variant="outline" size="sm" disabled={page >= pageCount || loading} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Berikutnya</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

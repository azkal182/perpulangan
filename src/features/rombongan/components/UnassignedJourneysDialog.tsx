"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, Loader2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getUnassignedJourneys, type UnassignedJourneyRow } from "../actions/passenger.actions";

type Props = {
  eventId: string;
  eventName: string;
  direction: "OUTBOUND" | "RETURN";
  korwilId?: string;
  kordaId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChooseKorda: (kordaId: string, direction: "OUTBOUND" | "RETURN") => void;
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
}: Props) {
  const [journeys, setJourneys] = useState<UnassignedJourneyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let current = true;
    void Promise.resolve().then(async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getUnassignedJourneys({ eventId, direction, korwilId, kordaId, page });
        if (!current) return;
        setJourneys(result.journeys);
        setTotal(result.total);
      } catch (cause) {
        if (current) setError(cause instanceof Error ? cause.message : "Gagal memuat daftar perjalanan.");
      } finally {
        if (current) setLoading(false);
      }
    });
    return () => { current = false; };
  }, [open, eventId, direction, korwilId, kordaId, page]);

  const directionLabel = direction === "OUTBOUND" ? "Pulang" : "Kembali";
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Belum ditempatkan · {directionLabel}</DialogTitle>
          <DialogDescription>
            Perjalanan terdaftar pada event {eventName} yang belum masuk bus. Pilih Korda tujuan untuk melihat armada yang dapat menerima peserta.
          </DialogDescription>
        </DialogHeader>

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
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => onChooseKorda(journey.destinationKordaId, direction)}>
                    <ArrowDownRight className="mr-2 h-4 w-4" />
                    Lihat armada Korda
                  </Button>
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

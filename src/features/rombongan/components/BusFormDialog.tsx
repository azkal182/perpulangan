"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createBus, updateBus, type BusWithDetails } from "../actions/bus.actions";
import { getAllKordas, getAllKorwils } from "../actions/helpers.actions";

interface BusFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: BusWithDetails | null;
  eventId?: string;
  eventName: string;
  onSuccess: () => void;
}

export function BusFormDialog({ open, onOpenChange, initialData, eventId, eventName, onSuccess }: BusFormDialogProps) {
  const [kordas, setKordas] = useState<Array<{ id: string; name: string; korwil: { name: string } | null }>>([]);
  const [korwils, setKorwils] = useState<Array<{ id: string; name: string }>>([]);
  
  const [selectedEventId, setSelectedEventId] = useState(eventId || "");
  const [selectedKorwilId, setSelectedKorwilId] = useState("");
  const [selectedKordaIds, setSelectedKordaIds] = useState<string[]>([]);
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState(1);
  
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  useEffect(() => {
    if (initialData) {
      setSelectedEventId(initialData.event.id);
      setSelectedKorwilId(initialData.korwil?.id || "");
      setSelectedKordaIds(initialData.kordas.map(bk => bk.kordaId));
      setLabel(initialData.label);
      setCapacity(initialData.capacity);
    } else {
      setSelectedEventId(eventId || "");
      setSelectedKorwilId("");
      setSelectedKordaIds([]);
      setLabel("");
      setCapacity(1);
    }
  }, [initialData, eventId, open]);

  async function loadData() {
    try {
      const [kordasData, korwilsData] = await Promise.all([
        getAllKordas(),
        getAllKorwils(),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setKordas(kordasData as any);
      setKorwils(korwilsData);
    } catch (error) {
      console.error("Failed to load form data:", error);
    } finally {
      setLoading(false);
    }
  }

  function toggleKorda(kordaId: string) {
    setSelectedKordaIds(prev =>
      prev.includes(kordaId)
        ? prev.filter(id => id !== kordaId)
        : [...prev, kordaId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    
    if (!selectedEventId || selectedKordaIds.length === 0 || !label.trim()) {
      setFormError("Mohon lengkapi semua field wajib");
      return;
    }

    setSubmitting(true);
    try {
      if (initialData) {
        await updateBus(initialData.id, {
          label: label.trim(),
          korwilId: selectedKorwilId || null,
          kordaIds: selectedKordaIds,
          capacity,
        });
      } else {
        await createBus({
          eventId: selectedEventId,
          korwilId: selectedKorwilId || null,
          kordaIds: selectedKordaIds,
          label: label.trim(),
          capacity,
        });
      }
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Gagal menyimpan bus");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Bus" : "Tambah Bus"}</DialogTitle>
          <DialogDescription>
            {initialData ? "Perbarui data bus dan penempatan kordanya" : "Buat armada untuk perjalanan event"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label>Event</Label>
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{eventName || "Belum dipilih"}</p>
            </div>

            {/* Korwil */}
            <div className="space-y-2">
              <Label>Korwil (opsional)</Label>
              <Select value={selectedKorwilId || "none"} onValueChange={(value) => setSelectedKorwilId(value === "none" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih korwil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada</SelectItem>
                  {korwils.map((korwil) => (
                    <SelectItem key={korwil.id} value={korwil.id}>
                      {korwil.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Kordas (multi-select) */}
            <div className="space-y-2">
              <Label>Kordas * (pilih minimal 1)</Label>
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
                {kordas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada korda tersedia</p>
                ) : (
                  kordas.map((korda) => (
                    <div key={korda.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`korda-${korda.id}`}
                        checked={selectedKordaIds.includes(korda.id)}
                        onCheckedChange={() => toggleKorda(korda.id)}
                      />
                      <label
                        htmlFor={`korda-${korda.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                      >
                        {korda.name}
                        {korda.korwil && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({korda.korwil.name})
                          </span>
                        )}
                      </label>
                    </div>
                  ))
                )}
              </div>
              {selectedKordaIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedKordaIds.map(id => {
                    const korda = kordas.find(k => k.id === id);
                    return korda ? (
                      <Badge key={id} variant="secondary">
                        {korda.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="label">Label Bus *</Label>
              <Input
                id="label"
                placeholder="Contoh: Bus 01 - Agra Mas + Kumaci"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Nama armada yang tampil pada daftar operasional dan manifest.</p>
            </div>

            {/* Kapasitas */}
            <div className="space-y-2">
              <Label htmlFor="capacity">Kapasitas</Label>
              <Input
                id="capacity"
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Jumlah kursi tersedia. Kapasitas adalah batas maksimal penumpang.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : initialData ? (
                  "Simpan Perubahan"
                ) : (
                  "Tambah Bus"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  getAssignableRegistrations,
  assignToBus,
  type AssignableRegistration,
} from "../actions/passenger.actions";

interface AddPassengerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busId: string;
  busLabel: string;
  journey: "outbound" | "return";
  onSuccess: () => void;
}

export function AddPassengerSheet({
  open,
  onOpenChange,
  busId,
  busLabel,
  journey,
  onSuccess,
}: AddPassengerSheetProps) {
  const [search, setSearch] = useState("");
  const [registrations, setRegistrations] = useState<AssignableRegistration[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  const journeyLabel = journey === "outbound" ? "Keberangkatan" : "Kepulangan";

  const loadRegistrations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAssignableRegistrations(busId, journey, search);
      setRegistrations(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [busId, journey, search]);

  useEffect(() => {
    if (open) {
      loadRegistrations();
    }
  }, [open, loadRegistrations]);

  // Debounce search
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      loadRegistrations();
    }, 400);
    return () => clearTimeout(timer);
  }, [search, open, loadRegistrations]);

  async function handleAssign(registrationId: string) {
    setAssigning(registrationId);
    try {
      await assignToBus(registrationId, busId, journey);
      // Remove from list immediately
      setRegistrations((prev) => prev.filter((r) => r.registrationId !== registrationId));
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal assign peserta");
    } finally {
      setAssigning(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Tambah Peserta — {journeyLabel}</SheetTitle>
          <SheetDescription>
            Pilih peserta untuk ditambahkan ke <strong>{busLabel}</strong>.
            Hanya peserta yang belum di-assign ke bus lain yang ditampilkan.
          </SheetDescription>
        </SheetHeader>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau NIS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : registrations.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {search
                ? "Tidak ada peserta yang cocok dengan pencarian."
                : "Tidak ada peserta yang bisa di-assign. Pastikan korda bus sesuai dengan korda registrasi."}
            </div>
          ) : (
            registrations.map((reg) => (
              <div
                key={reg.registrationId}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{reg.studentName}</span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {reg.studentNis}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="text-xs shrink-0"
                    >
                      {reg.studentGender === "L" ? "L" : "P"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {reg.kordaName && <div>Korda: {reg.kordaName}</div>}
                    {reg.dropPointName && <div>Titik turun: {reg.dropPointName}</div>}
                    {reg.journeyDate && (
                      <div>
                        Tanggal:{" "}
                        {format(new Date(reg.journeyDate), "dd MMM yyyy", { locale: localeId })}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAssign(reg.registrationId)}
                  disabled={assigning === reg.registrationId}
                  className="shrink-0"
                >
                  {assigning === reg.registrationId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="pt-4 border-t text-xs text-muted-foreground">
          {registrations.length} peserta tersedia
        </div>
      </SheetContent>
    </Sheet>
  );
}

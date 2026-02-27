"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  getBusPassengers,
  unassignFromBus,
  type BusPassenger,
} from "../actions/passenger.actions";
import { AddPassengerSheet } from "./AddPassengerSheet";
import type { BusWithDetails } from "../actions/bus.actions";

interface BusPassengersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bus: BusWithDetails;
  onPassengerChange: () => void;
}

function PassengerList({
  busId,
  busLabel,
  journey,
  capacity,
  onPassengerChange,
}: {
  busId: string;
  busLabel: string;
  journey: "outbound" | "return";
  capacity: number;
  onPassengerChange: () => void;
}) {
  const [passengers, setPassengers] = useState<BusPassenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const loadPassengers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBusPassengers(busId, journey);
      setPassengers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [busId, journey]);

  useEffect(() => {
    loadPassengers();
  }, [loadPassengers]);

  async function handleRemove(registrationId: string) {
    if (!confirm("Hapus peserta ini dari bus?")) return;
    setRemoving(registrationId);
    try {
      await unassignFromBus(registrationId, journey);
      setPassengers((prev) =>
        prev.filter((p) => p.registrationId !== registrationId),
      );
      onPassengerChange();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal menghapus peserta");
    } finally {
      setRemoving(null);
    }
  }

  const count = passengers.length;
  const isFull = capacity > 0 && count >= capacity;

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {count} peserta
            {capacity > 0 && (
              <span className={isFull ? "text-destructive font-medium" : ""}>
                {" "}
                / {capacity} kapasitas
              </span>
            )}
          </span>
          {isFull && (
            <Badge variant="destructive" className="text-xs">
              Penuh
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => setAddSheetOpen(true)}
          disabled={isFull}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Tambah Peserta
        </Button>
      </div>

      {/* Passenger list */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : passengers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Belum ada peserta. Klik &ldquo;Tambah Peserta&rdquo; untuk
          menambahkan.
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {passengers.map((p, idx) => (
            <div
              key={p.registrationId}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{p.studentName}</span>
                  <Badge variant="outline" className="text-xs">
                    {p.studentNis}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {p.studentGender === "L" ? "L" : "P"}
                  </Badge>
                  {p.paid && (
                    <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                      Lunas
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                  {p.kordaName && <span>Korda: {p.kordaName}</span>}
                  {p.dropPointName && (
                    <span>Titik turun: {p.dropPointName}</span>
                  )}
                  {p.journeyDate && (
                    <span>
                      {format(new Date(p.journeyDate), "dd MMM yyyy", {
                        locale: localeId,
                      })}
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleRemove(p.registrationId)}
                disabled={removing === p.registrationId}
              >
                {removing === p.registrationId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      <AddPassengerSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        busId={busId}
        busLabel={busLabel}
        journey={journey}
        onSuccess={() => {
          loadPassengers();
          onPassengerChange();
        }}
      />
    </div>
  );
}

export function BusPassengersDialog({
  open,
  onOpenChange,
  bus,
  onPassengerChange,
}: BusPassengersDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kelola Peserta — {bus.label}</DialogTitle>
          <DialogDescription>
            Assign peserta ke bus ini secara manual. Kapasitas:{" "}
            <strong>
              {bus.capacity > 0 ? bus.capacity : "Tidak dibatasi"}
            </strong>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="return" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="return" className="flex-1">
              Kepulangan
              <Badge variant="secondary" className="ml-2 text-xs">
                {bus._count.returnRegistrations}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="outbound" className="flex-1">
              Keberangkatan
              <Badge variant="secondary" className="ml-2 text-xs">
                {bus._count.outboundRegistrations}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="outbound" className="mt-4">
            <PassengerList
              busId={bus.id}
              busLabel={bus.label}
              journey="outbound"
              capacity={bus.capacity}
              onPassengerChange={onPassengerChange}
            />
          </TabsContent>

          <TabsContent value="return" className="mt-4">
            <PassengerList
              busId={bus.id}
              busLabel={bus.label}
              journey="return"
              capacity={bus.capacity}
              onPassengerChange={onPassengerChange}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

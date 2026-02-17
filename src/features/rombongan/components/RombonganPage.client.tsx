"use client";

import { useState, useEffect } from "react";
import { Plus, Bus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getBuses, deleteBus, toggleBusActive, type BusWithDetails } from "../actions/bus.actions";
import { getAllEvents, getAllKordas, getAllKorwils } from "../actions/helpers.actions";
import { BusFormDialog } from "./BusFormDialog";

export default function RombonganPage() {
  const [buses, setBuses] = useState<BusWithDetails[]>([]);
  const [events, setEvents] = useState<Array<{ id: string; name: string }>>([]);
  const [kordas, setKordas] = useState<Array<{ id: string; name: string }>>([]);
  const [korwils, setKorwils] = useState<Array<{ id: string; name: string }>>([]);
  
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedKorwilId, setSelectedKorwilId] = useState<string | undefined>(undefined);
  const [selectedKordaId, setSelectedKordaId] = useState<string | undefined>(undefined);
  
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBus, setEditingBus] = useState<BusWithDetails | null>(null);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  // Reload buses when filters change
  useEffect(() => {
    loadBuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, selectedKorwilId, selectedKordaId]);

  async function loadData() {
    try {
      const [eventsData, kordasData, korwilsData] = await Promise.all([
        getAllEvents(),
        getAllKordas(),
        getAllKorwils(),
      ]);
      setEvents(eventsData);
      setKordas(kordasData);
      setKorwils(korwilsData);
      
      // Auto-select first event
      if (eventsData.length > 0) {
        setSelectedEventId(eventsData[0].id);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadBuses() {
    if (!selectedEventId) return;
    
    try {
      const data = await getBuses({
        eventId: selectedEventId,
        korwilId: selectedKorwilId,
        kordaId: selectedKordaId,
      });
      setBuses(data);
    } catch (error) {
      console.error("Failed to load buses:", error);
    }
  }

  async function handleToggleActive(id: string) {
    try {
      await toggleBusActive(id);
      await loadBuses();
    } catch {
      alert("Gagal mengubah status bus");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Yakin ingin menghapus bus ini?")) return;
    
    try {
      await deleteBus(id);
      await loadBuses();
    } catch {
      alert("Gagal menghapus bus");
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bus className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Manajemen Rombongan Bus</h1>
        </div>
        <Button onClick={() => {
          setEditingBus(null);
          setIsFormOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Bus
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="w-64">
          <label className="text-sm font-medium mb-2 block">Event</label>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih event" />
            </SelectTrigger>
            <SelectContent>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-64">
          <label className="text-sm font-medium mb-2 block">Korwil (Opsional)</label>
          <Select value={selectedKorwilId} onValueChange={(value) => setSelectedKorwilId(value === "all" ? undefined : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Semua korwil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Korwil</SelectItem>
              {korwils.map((korwil) => (
                <SelectItem key={korwil.id} value={korwil.id}>
                  {korwil.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-64">
          <label className="text-sm font-medium mb-2 block">Korda (Opsional)</label>
          <Select value={selectedKordaId} onValueChange={(value) => setSelectedKordaId(value === "all" ? undefined : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Semua korda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Korda</SelectItem>
              {kordas.map((korda) => (
                <SelectItem key={korda.id} value={korda.id}>
                  {korda.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label Bus</TableHead>
              <TableHead>Korwil</TableHead>
              <TableHead>Kordas</TableHead>
              <TableHead>Tracker ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Belum ada bus. Klik &ldquo;Tambah Bus&rdquo; untuk menambahkan.
                </TableCell>
              </TableRow>
            ) : (
              buses.map((bus) => (
                <TableRow key={bus.id}>
                  <TableCell className="font-medium">{bus.label}</TableCell>
                  <TableCell>{bus.korwil?.name || "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {bus.kordas.map((bk) => (
                        <Badge key={bk.id} variant="outline" className="text-xs">
                          {bk.korda.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {bus.trackerId ? (
                      <code className="rounded bg-muted px-2 py-1">{bus.trackerId}</code>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={bus.isActive ? "default" : "secondary"}>
                      {bus.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleActive(bus.id)}
                      >
                        {bus.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingBus(bus);
                          setIsFormOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(bus.id)}
                      >
                        Hapus
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <BusFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        initialData={editingBus}
        eventId={selectedEventId}
        onSuccess={loadBuses}
      />
    </div>
  );
}

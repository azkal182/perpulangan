"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Bus,
  Loader2,
  MoreVertical,
  FileDown,
  Printer,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getBuses,
  deleteBus,
  toggleBusActive,
  type BusWithDetails,
} from "../actions/bus.actions";
import {
  getAllEvents,
  getAllKordas,
  getAllKorwils,
} from "../actions/helpers.actions";
import { getBusAttendanceManifest } from "../actions/passenger.actions";
import {
  buildBusAttendancePdf,
  openBusAttendancePdfInNewTab,
} from "../utils/bus-attendance-pdf";
import { BusFormDialog } from "./BusFormDialog";
import { BusPassengersDialog } from "./BusPassengersDialog";

function assignedCount(bus: BusWithDetails, direction: "OUTBOUND" | "RETURN") {
  return bus.journeyAssignments.filter((item) => item.journey.status === "REGISTERED" && item.journey.direction === direction).length;
}

function assignmentsNeedingReview(bus: BusWithDetails) {
  const busKordaIds = new Set(bus.kordas.map((item) => item.kordaId));
  return bus.journeyAssignments.filter((item) =>
    item.journey.status !== "REGISTERED" || !busKordaIds.has(item.journey.destinationKordaId),
  ).length;
}

export default function RombonganPage({ canManageBuses }: { canManageBuses: boolean }) {
  const [buses, setBuses] = useState<BusWithDetails[]>([]);
  const [events, setEvents] = useState<Array<{ id: string; name: string }>>([]);
  const [kordas, setKordas] = useState<Array<{ id: string; name: string }>>([]);
  const [korwils, setKorwils] = useState<Array<{ id: string; name: string }>>(
    [],
  );

  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedKorwilId, setSelectedKorwilId] = useState<string | undefined>(
    undefined,
  );
  const [selectedKordaId, setSelectedKordaId] = useState<string | undefined>(
    undefined,
  );

  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBus, setEditingBus] = useState<BusWithDetails | null>(null);
  const [managingBus, setManagingBus] = useState<BusWithDetails | null>(null);
  const [busPendingDelete, setBusPendingDelete] = useState<BusWithDetails | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingBus, setDeletingBus] = useState(false);
  const [attendanceLoadingKey, setAttendanceLoadingKey] = useState<
    string | null
  >(null);

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

  async function handleDelete() {
    if (!busPendingDelete) return;
    setDeletingBus(true);
    setDeleteError(null);
    try {
      await deleteBus(busPendingDelete.id);
      setBusPendingDelete(null);
      await loadBuses();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Gagal menghapus bus");
    } finally {
      setDeletingBus(false);
    }
  }

  async function handleAttendancePdf(
    journey: "outbound" | "return",
    mode: "preview" | "download",
  ) {
    if (!selectedEventId) {
      alert("Pilih event terlebih dahulu.");
      return;
    }

    const loadingKey = `${journey}-${mode}`;
    const previewWindow = mode === "preview" ? window.open("", "_blank") : null;
    if (mode === "preview" && !previewWindow) {
      alert("Popup diblokir browser. Izinkan popup untuk membuka preview PDF.");
      return;
    }

    setAttendanceLoadingKey(loadingKey);
    try {
      const manifest = await getBusAttendanceManifest({
        eventId: selectedEventId,
        journey,
        korwilId: selectedKorwilId,
        kordaId: selectedKordaId,
      });

      if (manifest.length === 0) {
        previewWindow?.close();
        alert("Tidak ada data bus untuk filter yang dipilih.");
        return;
      }

      const eventName =
        events.find((eventItem) => eventItem.id === selectedEventId)?.name ??
        "Event";

      const pdf = buildBusAttendancePdf({
        eventName,
        journey,
        buses: manifest,
      });

      if (mode === "preview") {
        openBusAttendancePdfInNewTab(pdf, previewWindow);
        return;
      }

      const journeyKey =
        journey === "outbound" ? "keberangkatan" : "kepulangan";
      const dateKey = new Date().toISOString().slice(0, 10);
      pdf.save(`absensi-bus-${journeyKey}-${dateKey}.pdf`);
    } catch (error) {
      previewWindow?.close();
      console.error("Failed to generate attendance PDF:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Gagal membuat dokumen absensi bus",
      );
    } finally {
      setAttendanceLoadingKey(null);
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
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Bus className="h-6 w-6 shrink-0" />
          <h1 className="truncate text-xl font-bold sm:text-2xl">
            Manajemen Rombongan Bus
          </h1>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={!!attendanceLoadingKey}
                className="w-full justify-start sm:w-auto sm:justify-center"
              >
                {attendanceLoadingKey ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                {attendanceLoadingKey ? "Menyiapkan PDF..." : "Absensi Bus"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem
                disabled={!!attendanceLoadingKey}
                onSelect={(event) => {
                  event.preventDefault();
                  handleAttendancePdf("outbound", "preview");
                }}
              >
                <Printer className="mr-2 h-4 w-4" />
                Preview/Cetak Keberangkatan
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!attendanceLoadingKey}
                onSelect={(event) => {
                  event.preventDefault();
                  handleAttendancePdf("outbound", "download");
                }}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Download PDF Keberangkatan
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!!attendanceLoadingKey}
                onSelect={(event) => {
                  event.preventDefault();
                  handleAttendancePdf("return", "preview");
                }}
              >
                <Printer className="mr-2 h-4 w-4" />
                Preview/Cetak Kepulangan
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!attendanceLoadingKey}
                onSelect={(event) => {
                  event.preventDefault();
                  handleAttendancePdf("return", "download");
                }}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Download PDF Kepulangan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {canManageBuses && <Button
            onClick={() => {
              setEditingBus(null);
              setIsFormOpen(true);
            }}
            className="w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Tambah Bus
          </Button>}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-card p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0 space-y-2">
            <label className="block text-sm font-medium">Event</label>
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger className="w-full">
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

          <div className="min-w-0 space-y-2">
            <label className="block text-sm font-medium">
              Korwil (Opsional)
            </label>
            <Select
              value={selectedKorwilId}
              onValueChange={(value) =>
                setSelectedKorwilId(value === "all" ? undefined : value)
              }
            >
              <SelectTrigger className="w-full">
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

          <div className="min-w-0 space-y-2">
            <label className="block text-sm font-medium">
              Korda (Opsional)
            </label>
            <Select
              value={selectedKordaId}
              onValueChange={(value) =>
                setSelectedKordaId(value === "all" ? undefined : value)
              }
            >
              <SelectTrigger className="w-full">
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
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {buses.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
            Belum ada bus. Klik &ldquo;Tambah Bus&rdquo; untuk menambahkan.
          </div>
        ) : (
          buses.map((bus) => {
            const outboundAssigned = assignedCount(bus, "OUTBOUND");
            const returnAssigned = assignedCount(bus, "RETURN");
            const reviewCount = assignmentsNeedingReview(bus);
            return (
              <div
                key={bus.id}
                className="rounded-lg border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {bus.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Korwil: {bus.korwil?.name || "-"}
                    </p>
                  </div>
                  <Badge variant={bus.isActive ? "default" : "secondary"}>
                    {bus.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>
                {reviewCount > 0 && <div className="mt-2"><Badge variant="outline" className="border-amber-300 text-amber-800">{reviewCount} penempatan perlu ditinjau</Badge></div>}

                <div className="mt-3 space-y-3 text-xs">
                  <div>
                    <p className="mb-1 font-medium text-muted-foreground">
                      Korda
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {bus.kordas.map((bk) => (
                        <Badge
                          key={bk.id}
                          variant="outline"
                          className="text-[11px]"
                        >
                          {bk.korda.name}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-muted/40 p-2">
                      <p className="text-[11px] text-muted-foreground">
                        Kapasitas
                      </p>
                      <p className="text-sm font-medium">
                        {outboundAssigned} pulang · {returnAssigned} kembali
                      </p>
                      <p className="text-[11px] text-muted-foreground">Kapasitas tiap perjalanan: {bus.capacity} kursi</p>
                    </div>
                    <div className="rounded-md bg-muted/40 p-2">
                      <p className="text-[11px] text-muted-foreground">
                        Tracker ID
                      </p>
                      {bus.trackerId ? (
                        <code className="block truncate rounded bg-background px-2 py-1 font-mono text-[11px]">
                          {bus.trackerId}
                        </code>
                      ) : (
                        <p className="text-sm text-muted-foreground">-</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setManagingBus(bus)}
                  >
                    Peserta
                  </Button>
                  {canManageBuses && <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleActive(bus.id)}
                  >
                    {bus.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </Button>}
                  {canManageBuses && <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingBus(bus);
                      setIsFormOpen(true);
                    }}
                  >
                    Edit
                  </Button>}
                  {canManageBuses && <Button
                    size="sm"
                    variant="destructive"
                                  onClick={() => {
                                    setDeleteError(null);
                                    setBusPendingDelete(bus);
                                  }}
                  >
                    Hapus
                  </Button>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden w-full max-w-full overflow-hidden rounded-lg border md:block">
        <Table className="min-w-[1080px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-44">Label Bus</TableHead>
              <TableHead className="min-w-36">Korwil</TableHead>
              <TableHead className="min-w-60">Kordas</TableHead>
              <TableHead className="min-w-20">Kapasitas</TableHead>
              <TableHead className="min-w-32">Tracker ID</TableHead>
              <TableHead className="">Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buses.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  {canManageBuses ? <>Belum ada bus. Klik &ldquo;Tambah Bus&rdquo; untuk menambahkan.</> : "Belum ada bus dalam cakupan Anda."}
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
                        <Badge
                          key={bk.id}
                          variant="outline"
                          className="text-xs"
                        >
                          {bk.korda.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="font-medium">{assignedCount(bus, "OUTBOUND")} pulang · {assignedCount(bus, "RETURN")} kembali</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Kapasitas tiap perjalanan: {bus.capacity} kursi
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {bus.trackerId ? (
                      <code className="rounded bg-muted px-2 py-1">
                        {bus.trackerId}
                      </code>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={bus.isActive ? "default" : "secondary"}>
                      {bus.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                    {assignmentsNeedingReview(bus) > 0 && (
                      <Badge variant="outline" className="ml-2 border-amber-300 text-amber-800">
                        {assignmentsNeedingReview(bus)} perlu ditinjau
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      {!canManageBuses ? <Button variant="outline" size="sm" onClick={() => setManagingBus(bus)}>Peserta</Button> :
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Aksi ${bus.label}`}
                            className="h-8 w-8"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={(event) => {
                              event.preventDefault();
                              setManagingBus(bus);
                            }}
                          >
                            Peserta
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(event) => {
                              event.preventDefault();
                              handleToggleActive(bus.id);
                            }}
                          >
                            {bus.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(event) => {
                              event.preventDefault();
                              setEditingBus(bus);
                              setIsFormOpen(true);
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={(event) => {
                              event.preventDefault();
                              setDeleteError(null);
                              setBusPendingDelete(bus);
                            }}
                          >
                            Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>}
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

      {managingBus && <BusPassengersDialog
          open={!!managingBus}
          onOpenChange={(open) => {
            if (!open) setManagingBus(null);
          }}
          bus={managingBus}
          onPassengerChange={loadBuses}
      />}
      <AlertDialog
        open={busPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingBus) {
            setBusPendingDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus armada ini?</AlertDialogTitle>
            <AlertDialogDescription>
              {busPendingDelete?.label} akan dihapus. Armada yang masih memiliki
              peserta tidak dapat dihapus.
              {deleteError && <span className="mt-2 block text-destructive">{deleteError}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBus}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void handleDelete(); }} disabled={deletingBus}>
              {deletingBus ? "Menghapus..." : "Hapus armada"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

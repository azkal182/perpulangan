"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Autocomplete } from "@/components/AutoComplete";
import { Trash2, UserPlus } from "lucide-react";
import type { Korda } from "../types";
import type { DropPoint } from "@/features/drop-points/types";
import {
  checkStudentAlreadyRegistered,
  createRegistration,
} from "../actions/registration.action";
import {
  searchStudents,
  type StudentBasic,
} from "@/features/santri/actions/students.action";
import { createExternalParticipantFromRegistration, searchCompleteExternalParticipants } from "@/features/santri/actions/external-participant.actions";
import { toast } from "sonner";

type Props = {
  eventId: string;
  eventName: string;
  kordas: Korda[];
  dropPoints: DropPoint[];
  defaultMode?: "both" | "outbound_only" | "return_only"; // Initial mode
  lockMode?: boolean; // If true, hide mode selector
  enableUnsavedGuard?: boolean; // Prevent accidental navigation while draft exists
};

type ParticipantDraft = {
  student: StudentBasic;
  externalParticipantId?: string;
  outboundDropPoint: DropPoint | null; // Nullable for return-only
  returnDropPoint: DropPoint | null;
  paymentStatus: "unpaid" | "outbound_only" | "paid_both" | "paid_return";
};

const UNSAVED_WARNING_MESSAGE =
  "Perubahan belum disimpan. Yakin ingin meninggalkan halaman ini?";

function useUnsavedChangesGuard(params: {
  enabled: boolean;
  shouldBlock: boolean;
  message: string;
}) {
  const { enabled, shouldBlock, message } = params;
  const shouldBlockRef = React.useRef(shouldBlock);
  const bypassRef = React.useRef(false);

  React.useEffect(() => {
    shouldBlockRef.current = shouldBlock;
  }, [shouldBlock]);

  const allowNextNavigation = React.useCallback(() => {
    bypassRef.current = true;
    shouldBlockRef.current = false;
  }, []);

  React.useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const STATE_KEY = "__registration_unsaved_guard";
    const state = (window.history.state as Record<string, unknown> | null) ?? {};

    if (!state[STATE_KEY]) {
      window.history.pushState(
        {
          ...state,
          [STATE_KEY]: true,
        },
        "",
        window.location.href,
      );
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (bypassRef.current || !shouldBlockRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };

    const onClickCapture = (event: MouseEvent) => {
      if (
        bypassRef.current ||
        !shouldBlockRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;

      if (!anchor) {
        return;
      }

      if (
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.getAttribute("rel")?.includes("external")
      ) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
        return;
      }

      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      const current = new URL(window.location.href);
      const isSameDestination =
        destination.pathname === current.pathname &&
        destination.search === current.search &&
        destination.hash === current.hash;

      if (isSameDestination) {
        return;
      }

      const confirmed = window.confirm(message);
      if (!confirmed) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      bypassRef.current = true;
      shouldBlockRef.current = false;
    };

    const onPopState = () => {
      if (bypassRef.current || !shouldBlockRef.current) {
        window.removeEventListener("beforeunload", onBeforeUnload);
        document.removeEventListener("click", onClickCapture, true);
        window.removeEventListener("popstate", onPopState);
        window.history.back();
        return;
      }

      const confirmed = window.confirm(message);
      if (!confirmed) {
        window.history.pushState(
          {
            ...((window.history.state as Record<string, unknown> | null) ?? {}),
            [STATE_KEY]: true,
          },
          "",
          window.location.href,
        );
        return;
      }

      bypassRef.current = true;
      shouldBlockRef.current = false;
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("popstate", onPopState);
      window.history.back();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [enabled, message]);

  return { allowNextNavigation };
}

export function MultiParticipantRegistrationForm({
  eventId,
  kordas,
  dropPoints,
  defaultMode = "both",
  lockMode = false,
  enableUnsavedGuard = false,
}: Props) {
  // Registration mode: 'both' or 'return_only'
  const [registrationMode, setRegistrationMode] = React.useState<
    "both" | "outbound_only" | "return_only"
  >(defaultMode);

  const [selectedKordaId, setSelectedKordaId] = React.useState<string | null>(
    null,
  );
  const [selectedStudentId, setSelectedStudentId] = React.useState<
    string | null
  >(null);
  const [selectedStudent, setSelectedStudent] =
    React.useState<StudentBasic | null>(null);
  const [participantType, setParticipantType] = React.useState<"student" | "external">("student");
  const [showExternalDraft, setShowExternalDraft] = React.useState(false);
  const [externalDraftName, setExternalDraftName] = React.useState("");
  const [externalDraftGender, setExternalDraftGender] = React.useState("");
  const [externalDraftAddress, setExternalDraftAddress] = React.useState("");

  // Separate korda for outbound and return
  const [selectedOutboundKordaId, setSelectedOutboundKordaId] = React.useState<
    string | null
  >(null);
  const [selectedReturnKordaId, setSelectedReturnKordaId] = React.useState<
    string | null
  >(null);

  const [selectedOutboundDropPointId, setSelectedOutboundDropPointId] =
    React.useState<string | null>(null);
  const [selectedReturnDropPointId, setSelectedReturnDropPointId] =
    React.useState<string | null>(null);
  const [participants, setParticipants] = React.useState<ParticipantDraft[]>(
    [],
  );
  const [submitting, setSubmitting] = React.useState(false);
  const studentSelectionRequestRef = React.useRef(0);

  const hasDraftInput = React.useMemo(() => {
    const hasSelectionDraft =
      !!selectedKordaId ||
      !!selectedStudentId ||
      !!selectedStudent ||
      !!selectedOutboundKordaId ||
      !!selectedReturnKordaId ||
      !!selectedOutboundDropPointId ||
      !!selectedReturnDropPointId;

    const hasModeChange = registrationMode !== defaultMode;

    return participants.length > 0 || hasSelectionDraft || hasModeChange;
  }, [
    defaultMode,
    participants.length,
    registrationMode,
    selectedKordaId,
    selectedOutboundDropPointId,
    selectedOutboundKordaId,
    selectedReturnDropPointId,
    selectedReturnKordaId,
    selectedStudent,
    selectedStudentId,
  ]);

  const { allowNextNavigation } = useUnsavedChangesGuard({
    enabled: enableUnsavedGuard,
    shouldBlock: hasDraftInput && !submitting,
    message: UNSAVED_WARNING_MESSAGE,
  });

  // Reset student selection when Korda changes
  React.useEffect(() => {
    setSelectedStudentId(null);
    setSelectedStudent(null);
  }, [selectedKordaId]);

  // Reset outbound drop point when outbound korda changes
  React.useEffect(() => {
    if (registrationMode === "both" || registrationMode === "outbound_only") {
      setSelectedOutboundDropPointId(null);
    }
  }, [selectedOutboundKordaId, registrationMode]);

  // Reset return drop point when return korda changes
  React.useEffect(() => {
    setSelectedReturnDropPointId(null);
  }, [selectedReturnKordaId]);


  // Filter drop points for outbound journey
  const outboundDropPoints = React.useMemo(() => {
    if (!selectedOutboundKordaId) return dropPoints;
    return dropPoints.filter((dp) => dp.kordaId === selectedOutboundKordaId);
  }, [dropPoints, selectedOutboundKordaId]);

  // Filter drop points for return journey
  const returnDropPoints = React.useMemo(() => {
    if (!selectedReturnKordaId) return dropPoints;
    return dropPoints.filter((dp) => dp.kordaId === selectedReturnKordaId);
  }, [dropPoints, selectedReturnKordaId]);

  const selectedOutboundDropPoint = React.useMemo(
    () =>
      dropPoints.find((dp) => dp.id === selectedOutboundDropPointId) || null,
    [dropPoints, selectedOutboundDropPointId],
  );

  const selectedReturnDropPoint = React.useMemo(
    () => dropPoints.find((dp) => dp.id === selectedReturnDropPointId) || null,
    [dropPoints, selectedReturnDropPointId],
  );

  const selectDestinationKorda = (kordaId: string | null) => {
    setSelectedKordaId(kordaId || null);
    setSelectedOutboundKordaId(kordaId || null);
    setSelectedReturnKordaId(kordaId || null);
  };

  const handleStudentSelection = React.useCallback(
    async (student: StudentBasic | null) => {
      if (!student) {
        setSelectedStudent(null);
        return;
      }

      if (student.externalParticipantId) {
        setSelectedStudent(student);
        return;
      }

      const requestId = ++studentSelectionRequestRef.current;
      const checkResult = await checkStudentAlreadyRegistered({
        eventId,
        studentId: student.id,
      });

      if (requestId !== studentSelectionRequestRef.current) {
        return;
      }

      if (!checkResult.success) {
        setSelectedStudent(student);
        toast.error(
          checkResult.error || "Gagal memeriksa status registrasi santri",
        );
        return;
      }

      const alreadyHasRequestedJourney = registrationMode === "both"
        ? checkResult.registered
        : registrationMode === "outbound_only"
          ? checkResult.hasOutbound
          : checkResult.hasReturn;
      if (alreadyHasRequestedJourney) {
        setSelectedStudentId(null);
        setSelectedStudent(null);
        toast.error(
          `${student.name} sudah terdaftar pada perjalanan ini untuk event tersebut.`,
        );
        return;
      }

      setSelectedStudent(student);
    },
    [eventId, registrationMode],
  );

  const handleAddParticipant = () => {
    // Validation based on mode
    if (!selectedStudent) return;
    if (
      registrationMode === "both" &&
      (!selectedOutboundDropPoint || !selectedReturnDropPoint)
    )
      return;
    if (registrationMode === "outbound_only" && !selectedOutboundDropPoint) return;
    if (registrationMode === "return_only" && !selectedReturnDropPoint) return;

    // Check if student already added
    if (participants.some((p) => p.externalParticipantId
      ? p.externalParticipantId === selectedStudent.externalParticipantId
      : !selectedStudent.externalParticipantId && p.student.id === selectedStudent.id)) {
      alert("Siswa sudah ditambahkan");
      return;
    }

    setParticipants([
      ...participants,
      {
        student: selectedStudent,
        ...(selectedStudent.externalParticipantId ? { externalParticipantId: selectedStudent.externalParticipantId } : {}),
        outboundDropPoint:
          registrationMode !== "return_only" ? selectedOutboundDropPoint! : null,
        returnDropPoint: registrationMode === "outbound_only" ? null : selectedReturnDropPoint!,
        paymentStatus: "unpaid",
      },
    ]);

    toast.success("Berhasil ditambahkan");
    // Reset selections
    setSelectedStudentId(null);
    setSelectedStudent(null);
    setSelectedOutboundKordaId(null);
    setSelectedReturnKordaId(null);
    setSelectedOutboundDropPointId(null);
    setSelectedReturnDropPointId(null);
  };

  const handleCreateExternalDraft = async () => {
    if (!selectedKordaId) {
      toast.error("Pilih Korda tujuan terlebih dahulu.");
      return;
    }
    const result = await createExternalParticipantFromRegistration({
      intendedKordaId: selectedKordaId,
      name: externalDraftName,
      gender: externalDraftGender,
      address: externalDraftAddress,
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setShowExternalDraft(false);
    setExternalDraftName("");
    setExternalDraftGender("");
    setExternalDraftAddress("");
    const item: StudentBasic = {
      id: `external:${result.data.id}`,
      externalParticipantId: result.data.id,
      name: result.data.name,
      nis: null,
      gender: result.data.gender ?? undefined,
      address: result.data.address,
      regencyId: null,
      regency: null,
    };
    setParticipantType("external");
    setSelectedStudent(item);
    setSelectedStudentId(item.id);
    toast.success("Profil eksternal lengkap dan siap ditambahkan ke registrasi.");
  };

  const handleRemoveParticipant = (studentId: string) => {
    setParticipants(participants.filter((p) => p.student.id !== studentId));
    toast.info("Santri berhasil dihapus dari pendaftaran");
  };

  const totalPrice = React.useMemo(() => {
    // Sum of outbound (if exists) and return drop point prices
    return participants.reduce((sum, p) => {
      const outboundPrice = p.outboundDropPoint?.price || 0;
      const returnPrice = p.returnDropPoint?.price || 0;
      return sum + outboundPrice + returnPrice;
    }, 0);
  }, [participants]);

  const handleSubmit = async () => {
    if (participants.length === 0) {
      alert("Belum ada peserta yang ditambahkan");
      return;
    }

    setSubmitting(true);
    try {
      // Submit each participant
      const results = await Promise.all(
        participants.map((p) => {
          return createRegistration({
            eventId,
            studentId: p.externalParticipantId ? null : p.student.id,
            externalParticipantId: p.externalParticipantId ?? null,
            outboundKordaId: p.outboundDropPoint?.kordaId || null,
            outboundDropPointId: p.outboundDropPoint?.id || null,
            returnKordaId: p.returnDropPoint?.kordaId || null,
            returnDropPointId: p.returnDropPoint?.id || null,
            registrarName: "",
            registrarPhone: "",
            kordaChanged: false,
            kordaChangeConfirmed: true,
            outboundPaid: false,
            returnPaid: false,
          });
        }),
      );

      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        alert(
          `Gagal mendaftarkan ${failed.length} peserta:\n${failed.map((r) => r.error).join("\n")}`,
        );
      } else {
        alert(`Berhasil mendaftarkan ${participants.length} peserta!`);
        setParticipants([]);
        allowNextNavigation();
        window.location.reload();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Validation based on registration mode
  const canAddParticipant =
    selectedStudent &&
    (registrationMode === "both"
      ? selectedOutboundDropPoint && selectedReturnDropPoint // Both required
      : registrationMode === "outbound_only" ? selectedOutboundDropPoint : selectedReturnDropPoint);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Daftar Peserta Baru</CardTitle>
          <CardDescription>
            Pilih Korda, cari siswa, pilih titik turun, lalu tambahkan ke daftar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Selector */}
          {!lockMode && (
            <div className="border-b pb-4">
              <Label className="mb-2 block">Mode Registrasi</Label>
              <RadioGroup
                value={registrationMode}
                  onValueChange={(value) =>
                  setRegistrationMode(value as "both" | "outbound_only" | "return_only")
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="both" id="mode-both" />
                  <label htmlFor="mode-both" className="text-sm cursor-pointer">
                    Pulang & Kembali (Normal)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="outbound_only" id="mode-outbound" />
                  <label htmlFor="mode-outbound" className="text-sm cursor-pointer">
                    Perjalanan Pulang saja
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="return_only" id="mode-return" />
                  <label
                    htmlFor="mode-return"
                    className="text-sm cursor-pointer"
                  >
                    Kembali Saja (Anak dijemput ortu, hanya ikut bus kembali)
                  </label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Step 1: Select Korda (Optional) */}
          <div>
            <Label className="mb-1">1. Korda tujuan</Label>
            <Autocomplete
              items={kordas}
              value={selectedKordaId}
              onValueChange={selectDestinationKorda}
              keyField="id"
              getLabel={(korda) => korda.name}
              placeholder="Pilih Korda tujuan"
              searchPlaceholder="Cari korda..."
              emptyText="Tidak ada korda"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Pilih Korda tujuan untuk mencari peserta. Tujuan ini otomatis dipilih pada bagian perjalanan dan dapat diubah dari sana. Pencarian santri lintas Korda hanya menampilkan identitas minimum dan Korda asal.
            </p>
          </div>

          {/* Step 2: Search Student (Async) */}
          <div>
            <Label className="mb-1">2. Jenis peserta</Label>
            <RadioGroup value={participantType} onValueChange={(value) => {
              setParticipantType(value as "student" | "external");
              setSelectedStudent(null);
              setSelectedStudentId(null);
            }} className="mb-2 flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="student" id="participant-student" /><label htmlFor="participant-student" className="text-sm">Santri</label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="external" id="participant-external" /><label htmlFor="participant-external" className="text-sm">Peserta eksternal</label></div>
            </RadioGroup>
            <Label className="mb-1">Cari & Pilih {participantType === "student" ? "Santri" : "Peserta eksternal"} *</Label>
            <Autocomplete
              key={`${participantType}:${selectedKordaId || "all"}`} // Reset cache when destination or type changes
              async={{
                loadOptions: (query) => participantType === "student"
                  ? searchStudents(query, selectedKordaId || undefined)
                  : selectedKordaId
                    ? searchCompleteExternalParticipants(query, selectedKordaId)
                    : Promise.resolve([]),
                debounceMs: 300,
                cache: {
                  enabled: true,
                  staleTimeMs: 60_000,
                },
              }}
              value={selectedStudentId}
              onValueChange={setSelectedStudentId}
              onSelectRaw={(student) => {
                void handleStudentSelection(student as StudentBasic | null);
              }}
              keyField="id"
              getLabel={(student) => `${student.name}${student.nis ? ` (${student.nis})` : ""}${student.regency?.korda?.name ? ` · Asal ${student.regency.korda.name}` : ""}`}
              placeholder={participantType === "student" ? "Cari santri..." : "Cari peserta eksternal yang sudah lengkap..."}
              searchPlaceholder={participantType === "student" ? "Ketik nama atau NIS..." : "Ketik nama atau alamat..."}
              emptyText={participantType === "external" && !selectedKordaId ? "Pilih Korda tujuan terlebih dahulu" : "Tidak ada hasil"}
              virtualized={{ enabled: true }}
            />
            {participantType === "external" && (
              <div className="mt-3 space-y-2">
                {!showExternalDraft ? (
                  <div className="space-y-1">
                    <Button type="button" variant="outline" size="sm" disabled={!selectedKordaId} onClick={() => setShowExternalDraft(true)}>
                      Buat profil peserta eksternal
                    </Button>
                    {!selectedKordaId && (
                      <p className="text-xs text-muted-foreground" role="status">
                        Pilih Korda tujuan terlebih dahulu. Profil eksternal akan disimpan untuk Korda tujuan tersebut.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 rounded-md border p-3">
                    <p className="text-sm font-medium">Profil baru untuk Korda tujuan</p>
                    <Input required value={externalDraftName} onChange={(event) => setExternalDraftName(event.target.value)} placeholder="Nama peserta *" />
                    <Select value={externalDraftGender || "none"} onValueChange={(value) => setExternalDraftGender(value === "none" ? "" : value)}>
                      <SelectTrigger><SelectValue placeholder="Jenis kelamin *" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Belum diisi</SelectItem>
                        <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                        <SelectItem value="Perempuan">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input required value={externalDraftAddress} onChange={(event) => setExternalDraftAddress(event.target.value)} placeholder="Alamat *" />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" disabled={!externalDraftName.trim() || !externalDraftGender || !externalDraftAddress.trim()} onClick={() => void handleCreateExternalDraft()}>Simpan profil lengkap</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setShowExternalDraft(false)}>Batal</Button>
                    </div>
                    {selectedKordaId && <p className="text-xs text-muted-foreground">Nama, jenis kelamin, dan alamat wajib diisi. Setelah disimpan, profil langsung berstatus Lengkap dan siap diregistrasikan oleh role yang berwenang pada Korda tujuan.</p>}
                  </div>
                )}
              </div>
            )}
              {selectedKordaId && participantType === "student" && (
                <p className="text-sm text-muted-foreground mt-1">
                Pencarian dibatasi pada Korda tujuan ini; santri dari Korda asal lain dapat ditemukan.
                </p>
              )}
              {selectedKordaId && participantType === "external" && (
                <p className="text-sm text-muted-foreground mt-1">
                  Hanya profil Lengkap pada Korda tujuan ini yang dapat dipilih. Profil lama yang masih Draf perlu dilengkapi melalui halaman Peserta eksternal sebelum registrasi.
                </p>
              )}
          </div>

          {/* Step 3: Perjalanan Pulang (Outbound) - Only for 'both' mode */}
          {(registrationMode === "both" || registrationMode === "outbound_only") && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
              <h3 className="font-semibold text-sm">
                3. Perjalanan Pulang (Outbound)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1">Pilih Korda *</Label>
                  <Select
                  value={selectedOutboundKordaId || ""}
                  onValueChange={selectDestinationKorda}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih korda pulang" />
                    </SelectTrigger>
                    <SelectContent>
                      {kordas.map((korda) => (
                        <SelectItem key={korda.id} value={korda.id}>
                          {korda.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-1">Pilih Titik Turun *</Label>
                  <Select
                    value={selectedOutboundDropPointId || ""}
                    onValueChange={(value) => {
                      setSelectedOutboundDropPointId(value);
                      setSelectedReturnDropPointId(value);
                    }}
                    disabled={!selectedOutboundKordaId}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          selectedOutboundKordaId
                            ? "Pilih titik turun"
                            : "Pilih korda terlebih dahulu"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {outboundDropPoints.map((dp) => (
                        <SelectItem key={dp.id} value={dp.id}>
                          {dp.name} - Rp {dp.price.toLocaleString("id-ID")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedOutboundDropPoint && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Harga: Rp{" "}
                      {selectedOutboundDropPoint.price.toLocaleString("id-ID")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Perjalanan Kembali (Return) */}
          {registrationMode !== "outbound_only" && <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
            <h3 className="font-semibold text-sm">
              4. Perjalanan Kembali (Return)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1">Korda tujuan *</Label>
                  {registrationMode === "return_only" ? (
                    <Select value={selectedReturnKordaId || ""} onValueChange={selectDestinationKorda}>
                      <SelectTrigger><SelectValue placeholder="Pilih Korda tujuan" /></SelectTrigger>
                      <SelectContent>
                        {kordas.map((korda) => <SelectItem key={korda.id} value={korda.id}>{korda.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="rounded-md border bg-background px-3 py-2 text-sm">
                      {kordas.find((korda) => korda.id === selectedReturnKordaId)?.name || "Pilih Korda tujuan"}
                    </div>
                  )}
                    <p className="mt-1 text-xs text-muted-foreground">Pulang-pergi hanya dapat memakai satu Korda tujuan.</p>
                </div>

              <div>
                <Label className="mb-1">Pilih Titik Penjemputan *</Label>
                <Select
                  value={selectedReturnDropPointId || ""}
                  onValueChange={setSelectedReturnDropPointId}
                  disabled={!selectedReturnKordaId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedReturnKordaId
                          ? "Pilih titik penjemputan"
                          : "Pilih korda terlebih dahulu"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {returnDropPoints.map((dp) => (
                      <SelectItem key={dp.id} value={dp.id}>
                        {dp.name} - Rp {dp.price.toLocaleString("id-ID")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedReturnDropPoint && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Harga: Rp{" "}
                    {selectedReturnDropPoint.price.toLocaleString("id-ID")}
                  </p>
                )}
              </div>
            </div>
          </div>}

          <p className="rounded bg-muted p-3 text-sm text-muted-foreground">Pembayaran dicatat sebagai transaksi di menu Pembayaran setelah perjalanan berhasil didaftarkan.</p>

          {/* Add Button */}
          <Button
            type="button"
            onClick={handleAddParticipant}
            disabled={!canAddParticipant || submitting}
            className="w-full"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Tambah ke Daftar
          </Button>
        </CardContent>
      </Card>

      {/* Participant Preview */}
      {participants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Peserta ({participants.length})</CardTitle>
            <CardDescription>
              Daftar peserta yang akan didaftarkan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Titik Pulang</TableHead>
                    <TableHead>Titik Kembali</TableHead>
                    <TableHead>Status Bayar</TableHead>
                    <TableHead className="text-right">Harga Total</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((p) => {
                    const outboundPrice = p.outboundDropPoint?.price || 0;
                    const returnPrice = p.returnDropPoint?.price ?? 0;
                    const totalPrice = outboundPrice + returnPrice;

                    return (
                      <TableRow key={p.student.id}>
                        <TableCell className="font-medium">
                          {p.student.name}
                          {p.student.regency?.korda?.name && (() => {
                            const destinationId = p.outboundDropPoint?.kordaId ?? p.returnDropPoint?.kordaId;
                            const destinationName = kordas.find((korda) => korda.id === destinationId)?.name;
                            return destinationId && destinationId !== p.student.regency.kordaId ? (
                              <div className="text-xs font-normal text-muted-foreground">
                                Lintas Korda · Asal: {p.student.regency.korda.name} · Tujuan: {destinationName ?? "Korda terpilih"}
                              </div>
                            ) : null;
                          })()}
                        </TableCell>
                        <TableCell>{p.student.nis}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {p.outboundDropPoint ? (
                              <>
                                {p.outboundDropPoint.name}
                                <div className="text-xs text-muted-foreground">
                                  Rp{" "}
                                  {p.outboundDropPoint.price.toLocaleString(
                                    "id-ID",
                                  )}
                                </div>
                              </>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                -
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {p.returnDropPoint ? <>
                              {p.returnDropPoint.name}
                              <div className="text-xs text-muted-foreground">
                                Rp {p.returnDropPoint.price.toLocaleString("id-ID")}
                              </div>
                            </> : <span className="text-muted-foreground text-xs">-</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">Belum bayar</span>
                        </TableCell>
                        <TableCell className="text-right">
                          Rp {totalPrice.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRemoveParticipant(p.student.id)
                            }
                            disabled={submitting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell colSpan={5} className="font-semibold">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      Rp {totalPrice.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full mt-4"
              size="lg"
            >
              {submitting
                ? "Mendaftarkan..."
                : `Daftar ${participants.length} Peserta`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

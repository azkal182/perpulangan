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
import { createRegistration } from "../actions/registration.action";
import {
  searchStudents,
  type StudentBasic,
} from "@/features/santri/actions/students.action";
import { toast } from "sonner";

type Props = {
  eventId: string;
  eventName: string;
  kordas: Korda[];
  dropPoints: DropPoint[];
  defaultMode?: "both" | "return_only"; // Initial mode
  lockMode?: boolean; // If true, hide mode selector
};

type ParticipantDraft = {
  student: StudentBasic;
  outboundDropPoint: DropPoint | null; // Nullable for return-only
  returnDropPoint: DropPoint;
  paymentStatus: "unpaid" | "outbound_only" | "paid_both" | "paid_return";
};

export function MultiParticipantRegistrationForm({
  eventId,
  kordas,
  dropPoints,
  defaultMode = "both",
  lockMode = false,
}: Props) {
  // Registration mode: 'both' or 'return_only'
  const [registrationMode, setRegistrationMode] = React.useState<
    "both" | "return_only"
  >(defaultMode);

  const [selectedKordaId, setSelectedKordaId] = React.useState<string | null>(
    null,
  );
  const [selectedStudentId, setSelectedStudentId] = React.useState<
    string | null
  >(null);
  const [selectedStudent, setSelectedStudent] =
    React.useState<StudentBasic | null>(null);

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
  const [selectedPaymentStatus, setSelectedPaymentStatus] =
    React.useState<string>("paid_both");
  const [participants, setParticipants] = React.useState<ParticipantDraft[]>(
    [],
  );
  const [submitting, setSubmitting] = React.useState(false);

  // When student is selected, auto-populate korda and drop points from their default korda
  React.useEffect(() => {
    if (selectedStudent?.regency?.kordaId) {
      const studentKordaId = selectedStudent.regency.kordaId;

      // Set both korda selectors to student's default korda
      setSelectedOutboundKordaId(studentKordaId);
      setSelectedReturnKordaId(studentKordaId);

      // Find the first drop point from student's korda for both outbound and return
      const studentDropPoints = dropPoints.filter(
        (dp) => dp.kordaId === studentKordaId,
      );
      if (studentDropPoints.length > 0) {
        setSelectedOutboundDropPointId(studentDropPoints[0].id);
        setSelectedReturnDropPointId(studentDropPoints[0].id);
      }
    }
  }, [selectedStudent, dropPoints]);

  // Reset student selection when Korda changes
  React.useEffect(() => {
    setSelectedStudentId(null);
    setSelectedStudent(null);
  }, [selectedKordaId]);

  // Reset outbound drop point when outbound korda changes
  React.useEffect(() => {
    if (registrationMode === "both") {
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

  const handleAddParticipant = () => {
    // Validation based on mode
    if (!selectedStudent) return;
    if (
      registrationMode === "both" &&
      (!selectedOutboundDropPoint || !selectedReturnDropPoint)
    )
      return;
    if (registrationMode === "return_only" && !selectedReturnDropPoint) return;

    // Validate payment status is selected
    if (!selectedPaymentStatus) {
      alert("Silakan pilih status pembayaran terlebih dahulu");
      return;
    }

    // Check if student already added
    if (participants.some((p) => p.student.id === selectedStudent.id)) {
      alert("Siswa sudah ditambahkan");
      return;
    }

    setParticipants([
      ...participants,
      {
        student: selectedStudent,
        outboundDropPoint:
          registrationMode === "both" ? selectedOutboundDropPoint! : null,
        returnDropPoint: selectedReturnDropPoint!,
        paymentStatus: selectedPaymentStatus as
          | "unpaid"
          | "outbound_only"
          | "paid_both"
          | "paid_return",
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
    // setSelectedPaymentStatus("");
  };

  const handleRemoveParticipant = (studentId: string) => {
    setParticipants(participants.filter((p) => p.student.id !== studentId));
    toast.info("Santri berhasil dihapus dari pendaftaran");
  };

  const totalPrice = React.useMemo(() => {
    // Sum of outbound (if exists) and return drop point prices
    return participants.reduce((sum, p) => {
      const outboundPrice = p.outboundDropPoint?.price || 0;
      const returnPrice = p.returnDropPoint.price;
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
          const outboundPaid =
            p.paymentStatus === "outbound_only" ||
            p.paymentStatus === "paid_both";
          const returnPaid =
            p.paymentStatus === "paid_both" ||
            p.paymentStatus === "paid_return";

          return createRegistration({
            eventId,
            studentId: p.student.id,
            outboundKordaId: p.outboundDropPoint?.kordaId || null,
            outboundDropPointId: p.outboundDropPoint?.id || null,
            returnKordaId: p.returnDropPoint.kordaId,
            returnDropPointId: p.returnDropPoint.id,
            registrarName: "Admin", // TODO: Get from authenticated user
            registrarPhone: "-", // TODO: Get from authenticated user
            kordaChanged: false,
            kordaChangeConfirmed: true,
            outboundPaid,
            returnPaid,
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
      : selectedReturnDropPoint) && // Only return required
    selectedPaymentStatus;

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
                  setRegistrationMode(value as "both" | "return_only")
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="both" id="mode-both" />
                  <label htmlFor="mode-both" className="text-sm cursor-pointer">
                    Pulang & Kembali (Normal)
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
            <Label className="mb-1">1. Pilih Korda (Opsional)</Label>
            <Autocomplete
              items={kordas}
              value={selectedKordaId}
              onValueChange={setSelectedKordaId}
              keyField="id"
              getLabel={(korda) => korda.name}
              placeholder="Pilih Korda (opsional)"
              searchPlaceholder="Cari korda..."
              emptyText="Tidak ada korda"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Pilih Korda untuk filter titik turun, atau kosongkan untuk lihat
              semua
            </p>
          </div>

          {/* Step 2: Search Student (Async) */}
          <div>
            <Label className="mb-1">2. Cari & Pilih Siswa *</Label>
            <Autocomplete
              key={selectedKordaId || "all"} // Reset cache when Korda changes
              async={{
                loadOptions: (query) =>
                  searchStudents(query, selectedKordaId || undefined),
                debounceMs: 300,
                cache: {
                  enabled: true,
                  staleTimeMs: 60_000,
                },
              }}
              value={selectedStudentId}
              onValueChange={setSelectedStudentId}
              onSelectRaw={(student) => setSelectedStudent(student)}
              keyField="id"
              getLabel={(student) => `${student.name} (${student.nis})`}
              placeholder="Cari siswa..."
              searchPlaceholder="Ketik nama atau NIS..."
              emptyText="Tidak ada hasil"
              virtualized={{ enabled: true }}
            />
            {selectedKordaId && (
              <p className="text-sm text-muted-foreground mt-1">
                Hanya menampilkan siswa dari Korda terpilih
              </p>
            )}
          </div>

          {/* Step 3: Perjalanan Pulang (Outbound) - Only for 'both' mode */}
          {registrationMode === "both" && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
              <h3 className="font-semibold text-sm">
                3. Perjalanan Pulang (Outbound)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1">Pilih Korda *</Label>
                  <Select
                    value={selectedOutboundKordaId || ""}
                    onValueChange={(value) => {
                      setSelectedOutboundKordaId(value);
                      setSelectedReturnKordaId(value);
                    }}
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
          <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
            <h3 className="font-semibold text-sm">
              4. Perjalanan Kembali (Return)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="mb-1">Pilih Korda *</Label>
                <Select
                  value={selectedReturnKordaId || ""}
                  onValueChange={setSelectedReturnKordaId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih korda kembali" />
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
                  value={selectedReturnDropPointId || ""}
                  onValueChange={setSelectedReturnDropPointId}
                  disabled={!selectedReturnKordaId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedReturnKordaId
                          ? "Pilih titik turun"
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
          </div>

          {/* Step 5: Payment Status */}
          <div>
            <Label className="mb-1">5. Status Pembayaran *</Label>
            <Select
              value={selectedPaymentStatus}
              onValueChange={setSelectedPaymentStatus}
            >
              <SelectTrigger
                className={
                  !selectedPaymentStatus ? "text-muted-foreground" : ""
                }
              >
                <SelectValue placeholder="Pilih status pembayaran" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">Belum Bayar</SelectItem>
                {registrationMode === "both" && (
                  <>
                    <SelectItem value="outbound_only">
                      Sudah Bayar Pulang Saja
                    </SelectItem>
                    <SelectItem value="paid_both">
                      Sudah Bayar Pulang-Pergi
                    </SelectItem>
                  </>
                )}
                {registrationMode === "return_only" && (
                  <SelectItem value="paid_return">
                    Sudah Bayar Kembali
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

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
                    const paymentLabel =
                      p.paymentStatus === "paid_both"
                        ? "Lunas PP"
                        : p.paymentStatus === "outbound_only"
                          ? "Pulang Saja"
                          : p.paymentStatus === "paid_return"
                            ? "Lunas Kembali"
                            : "Belum Bayar";

                    const outboundPrice = p.outboundDropPoint?.price || 0;
                    const returnPrice = p.returnDropPoint.price;
                    const totalPrice = outboundPrice + returnPrice;

                    return (
                      <TableRow key={p.student.id}>
                        <TableCell className="font-medium">
                          {p.student.name}
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
                            {p.returnDropPoint.name}
                            <div className="text-xs text-muted-foreground">
                              Rp{" "}
                              {p.returnDropPoint.price.toLocaleString("id-ID")}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{paymentLabel}</span>
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

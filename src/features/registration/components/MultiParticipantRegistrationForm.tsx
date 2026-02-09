"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Autocomplete } from "@/components/AutoComplete";
import { Trash2, UserPlus, Loader2 } from "lucide-react";
import type { Korda } from "../types";
import type { DropPoint } from "@/features/drop-points/types";
import { createRegistration } from "../actions/registration.action";
import { getStudentsByKorda, type StudentBasic } from "@/features/santri/actions/students.action";

type Props = {
  eventId: string;
  eventName: string;
  kordas: Korda[];
  dropPoints: DropPoint[];
};

type ParticipantDraft = {
  student: StudentBasic;
  dropPoint: DropPoint;
  paymentStatus: "unpaid" | "outbound_only" | "paid_both";
};

export function MultiParticipantRegistrationForm({
  eventId,
  eventName,
  kordas,
  dropPoints,
}: Props) {
  const [selectedKordaId, setSelectedKordaId] = React.useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = React.useState<string | null>(null);
  const [selectedDropPointId, setSelectedDropPointId] = React.useState<string | null>(null);
  const [selectedPaymentStatus, setSelectedPaymentStatus] = React.useState<string>("");
  const [participants, setParticipants] = React.useState<ParticipantDraft[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  
  const [students, setStudents] = React.useState<StudentBasic[]>([]);
  const [loadingStudents, setLoadingStudents] = React.useState(false);

  // Fetch students when Korda is selected
  React.useEffect(() => {
    if (!selectedKordaId) {
      setStudents([]);
      return;
    }

    setLoadingStudents(true);
    getStudentsByKorda(selectedKordaId)
      .then((result) => {
        if (result.success && result.students) {
          setStudents(result.students);
        } else {
          setStudents([]);
          console.error("Failed to fetch students:", result.error);
        }
      })
      .catch((error) => {
        console.error("Error fetching students:", error);
        setStudents([]);
      })
      .finally(() => {
        setLoadingStudents(false);
      });
  }, [selectedKordaId]);

  // Filter drop points by selected Korda
  const filteredDropPoints = React.useMemo(() => {
    if (!selectedKordaId) return [];
    return dropPoints.filter((dp) => dp.kordaId === selectedKordaId);
  }, [dropPoints, selectedKordaId]);

  const selectedStudent = React.useMemo(
    () => students.find((s) => s.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  const selectedDropPoint = React.useMemo(
    () => filteredDropPoints.find((dp) => dp.id === selectedDropPointId) || null,
    [filteredDropPoints, selectedDropPointId]
  );

  const handleAddParticipant = () => {
    if (!selectedStudent || !selectedDropPoint) return;

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
        dropPoint: selectedDropPoint,
        paymentStatus: selectedPaymentStatus as "unpaid" | "outbound_only" | "paid_both",
      },
    ]);

    // Reset selections
    setSelectedStudentId(null);
    setSelectedDropPointId(null);
    setSelectedPaymentStatus("");
  };

  const handleRemoveParticipant = (studentId: string) => {
    setParticipants(participants.filter((p) => p.student.id !== studentId));
  };

  const totalPrice = React.useMemo(() => {
    // Round trip = 2x drop point price
    return participants.reduce((sum, p) => sum + p.dropPoint.price * 2, 0);
  }, [participants]);

  const handleSubmit = async () => {
    if (participants.length === 0) {
      alert("Belum ada peserta yang ditambahkan");
      return;
    }

    setSubmitting(true);
    try {
      const selectedKorda = kordas.find((k) => k.id === selectedKordaId);
      if (!selectedKorda) return;

      // Submit each participant
      const results = await Promise.all(
        participants.map((p) => {
          const outboundPaid = p.paymentStatus === "outbound_only" || p.paymentStatus === "paid_both";
          const returnPaid = p.paymentStatus === "paid_both";
          
          return createRegistration({
            eventId,
            studentId: p.student.id,
            outboundKordaId: selectedKordaId,
            outboundDropPointId: p.dropPoint.id,
            returnKordaId: selectedKordaId,
            returnDropPointId: p.dropPoint.id,
            kordaChanged: false,
            kordaChangeConfirmed: true,
            outboundPaid,
            returnPaid,
          });
        })
      );

      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        alert(`Gagal  mendaftarkan ${failed.length} peserta:\n${failed.map((r) => r.error).join("\n")}`);
      } else {
        alert(`Berhasil mendaftarkan ${participants.length} peserta!`);
        setParticipants([]);
        window.location.reload();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canAddParticipant = selectedStudent && selectedDropPoint && selectedPaymentStatus;

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
          {/* Step 1: Select Korda */}
          <div>
            <Label>1. Pilih Korda *</Label>
            <Select value={selectedKordaId} onValueChange={setSelectedKordaId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih Korda" />
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

          {selectedKordaId && (
            <>
              {/* Step 2: Search Student */}
              <div>
                <Label>2. Cari & Pilih Siswa *</Label>
                {loadingStudents ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Memuat data siswa...
                  </div>
                ) : (
                  <>
                    <Autocomplete
                      items={students}
                      value={selectedStudentId}
                      onValueChange={setSelectedStudentId}
                      keyField="id"
                      getLabel={(student) => `${student.name} (${student.nis})`}
                      placeholder="Cari siswa..."
                      searchPlaceholder="Ketik nama atau NIS..."
                      emptyText="Tidak ada siswa di Korda ini"
                      virtualized={{ enabled: true }}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      {students.length} siswa tersedia
                    </p>
                  </>
                )}
              </div>

              {/* Step 3: Select Drop Point */}
              <div>
                <Label>3. Pilih Titik Turun *</Label>
                <Select value={selectedDropPointId || ""} onValueChange={setSelectedDropPointId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih titik turun" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDropPoints.map((dp) => (
                      <SelectItem key={dp.id} value={dp.id}>
                        {dp.name} - Rp {dp.price.toLocaleString("id-ID")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedDropPoint && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Harga pulang-pergi: Rp {(selectedDropPoint.price * 2).toLocaleString("id-ID")}
                  </p>
                )}
              </div>

              {/* Step 4: Payment Status */}
              <div>
                <Label>4. Status Pembayaran *</Label>
                <Select value={selectedPaymentStatus} onValueChange={setSelectedPaymentStatus}>
                  <SelectTrigger className={!selectedPaymentStatus ? "text-muted-foreground" : ""}>
                    <SelectValue placeholder="Pilih status pembayaran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Belum Bayar</SelectItem>
                    <SelectItem value="outbound_only">Sudah Bayar Pulang Saja</SelectItem>
                    <SelectItem value="paid_both">Sudah Bayar Pulang-Pergi</SelectItem>
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Participant Preview */}
      {participants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Peserta ({participants.length})</CardTitle>
            <CardDescription>Daftar peserta yang akan didaftarkan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Titik Turun</TableHead>
                    <TableHead>Status Bayar</TableHead>
                    <TableHead className="text-right">Harga (PP)</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((p) => {
                    const paymentLabel = 
                      p.paymentStatus === "paid_both" ? "Lunas PP" :
                      p.paymentStatus === "outbound_only" ? "Pulang Saja" :
                      "Belum Bayar";
                    
                    return (
                      <TableRow key={p.student.id}>
                        <TableCell className="font-medium">{p.student.name}</TableCell>
                        <TableCell>{p.student.nis}</TableCell>
                        <TableCell>{p.dropPoint.name}</TableCell>
                        <TableCell>
                          <span className="text-sm">{paymentLabel}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          Rp {(p.dropPoint.price * 2).toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveParticipant(p.student.id)}
                            disabled={submitting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">
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
              {submitting ? "Mendaftarkan..." : `Daftar ${participants.length} Peserta`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

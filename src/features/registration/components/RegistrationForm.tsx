"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RegistrationFormData, Student, Korda } from "../types";
import type { DropPoint } from "@/features/drop-points/types";

type Props = {
  eventId: string;
  students: Student[];
  kordas: Korda[];
  dropPoints: DropPoint[];
  onSubmit: (data: RegistrationFormData) => Promise<void>;
  loading?: boolean;
};

export function RegistrationForm({
  eventId,
  students,
  kordas,
  dropPoints,
  onSubmit,
  loading = false,
}: Props) {
  const [selectedStudent, setSelectedStudent] = React.useState<Student | null>(null);
  const [formData, setFormData] = React.useState<RegistrationFormData>({
    eventId,
    studentId: "",
    registrarName: "",
    registrarPhone: "",
    outboundKordaId: "",
    outboundDropPointId: "",
    outboundDate: "",
    returnKordaId: "",
    returnDropPointId: "",
    returnDate: "",
    notes: "",
  });

  const [showKordaChangeWarning, setShowKordaChangeWarning] = React.useState(false);
  const [kordaChangeConfirmed, setKordaChangeConfirmed] = React.useState(false);

  const studentOriginalKordaId = selectedStudent?.regency?.kordaId;

  // When student changes, update form
  React.useEffect(() => {
    if (selectedStudent) {
      setFormData((prev) => ({
        ...prev,
        studentId: selectedStudent.id,
        outboundKordaId: studentOriginalKordaId || "",
        returnKordaId: studentOriginalKordaId || "",
      }));
      setKordaChangeConfirmed(false);
      setShowKordaChangeWarning(false);
    }
  }, [selectedStudent, studentOriginalKordaId]);

  // Check if Korda changed
  const kordaChanged = React.useMemo(() => {
    if (!studentOriginalKordaId) return false;
    return (
      formData.outboundKordaId !== studentOriginalKordaId ||
      formData.returnKordaId !== studentOriginalKordaId
    );
  }, [studentOriginalKordaId, formData.outboundKordaId, formData.returnKordaId]);

  React.useEffect(() => {
    if (kordaChanged && !kordaChangeConfirmed) {
      setShowKordaChangeWarning(true);
    } else {
      setShowKordaChangeWarning(false);
    }
  }, [kordaChanged, kordaChangeConfirmed]);

  const outboundDropPointsFiltered = React.useMemo(() => {
    if (!formData.outboundKordaId) return [];
    return dropPoints.filter((dp) => dp.kordaId === formData.outboundKordaId);
  }, [dropPoints, formData.outboundKordaId]);

  const returnDropPointsFiltered = React.useMemo(() => {
    if (!formData.returnKordaId) return [];
    return dropPoints.filter((dp) => dp.kordaId === formData.returnKordaId);
  }, [dropPoints, formData.returnKordaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (kordaChanged && !kordaChangeConfirmed) {
      setShowKordaChangeWarning(true);
      return;
    }

    await onSubmit(formData);
  };

  const canSubmit =
    formData.studentId &&
    formData.registrarName.trim() &&
    formData.registrarPhone.trim() &&
    formData.outboundKordaId &&
    formData.outboundDropPointId &&
    formData.outboundDate &&
    formData.returnKordaId &&
    formData.returnDropPointId &&
    formData.returnDate &&
    (!kordaChanged || kordaChangeConfirmed);

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="student">Siswa *</Label>
            <Select
              value={selectedStudent?.id || ""}
              onValueChange={(id) => {
                const student = students.find((s) => s.id === id);
                setSelectedStudent(student || null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih siswa" />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.name} ({student.nis})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedStudent && studentOriginalKordaId && (
            <div className="text-sm text-muted-foreground">
              Korda asal:{" "}
              {kordas.find((k) => k.id === studentOriginalKordaId)?.name || "Unknown"}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="registrarName">Nama Pendaftar *</Label>
              <Input
                id="registrarName"
                value={formData.registrarName}
                onChange={(e) =>
                  setFormData({ ...formData, registrarName: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="registrarPhone">No HP Pendaftar *</Label>
              <Input
                id="registrarPhone"
                type="tel"
                value={formData.registrarPhone}
                onChange={(e) =>
                  setFormData({ ...formData, registrarPhone: e.target.value })
                }
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Perjalanan Pulang</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Korda *</Label>
                <Select
                  value={formData.outboundKordaId}
                  onValueChange={(val) =>
                    setFormData({ ...formData, outboundKordaId: val, outboundDropPointId: "" })
                  }
                >
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

              <div>
                <Label>Titik Turun *</Label>
                <Select
                  value={formData.outboundDropPointId}
                  onValueChange={(val) =>
                    setFormData({ ...formData, outboundDropPointId: val })
                  }
                  disabled={!formData.outboundKordaId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih titik turun" />
                  </SelectTrigger>
                  <SelectContent>
                    {outboundDropPointsFiltered.map((dp) => (
                      <SelectItem key={dp.id} value={dp.id}>
                        {dp.name} - Rp {dp.price.toLocaleString("id-ID")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="outboundDate">Tanggal Pulang *</Label>
                <Input
                  id="outboundDate"
                  type="date"
                  value={formData.outboundDate}
                  onChange={(e) =>
                    setFormData({ ...formData, outboundDate: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Perjalanan Kembali</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Korda *</Label>
                <Select
                  value={formData.returnKordaId}
                  onValueChange={(val) =>
                    setFormData({ ...formData, returnKordaId: val, returnDropPointId: "" })
                  }
                >
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

              <div>
                <Label>Titik Turun *</Label>
                <Select
                  value={formData.returnDropPointId}
                  onValueChange={(val) =>
                    setFormData({ ...formData, returnDropPointId: val })
                  }
                  disabled={!formData.returnKordaId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih titik turun" />
                  </SelectTrigger>
                  <SelectContent>
                    {returnDropPointsFiltered.map((dp) => (
                      <SelectItem key={dp.id} value={dp.id}>
                        {dp.name} - Rp {dp.price.toLocaleString("id-ID")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="returnDate">Tanggal Kembali *</Label>
                <Input
                  id="returnDate"
                  type="date"
                  value={formData.returnDate}
                  onChange={(e) =>
                    setFormData({ ...formData, returnDate: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Catatan</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <Button type="submit" disabled={!canSubmit || loading} className="w-full">
          {loading ? "Menyimpan..." : "Daftar"}
        </Button>
      </form>

      <Dialog open={showKordaChangeWarning} onOpenChange={setShowKordaChangeWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Perubahan Korda</DialogTitle>
            <DialogDescription>
              Korda yang dipilih berbeda dengan Korda asal siswa. Ini memerlukan konfirmasi.
              <br />
              <br />
              <strong>Korda Asal:</strong>{" "}
              {kordas.find((k) => k.id === studentOriginalKordaId)?.name}
              <br />
              <strong>Korda Pulang:</strong>{" "}
              {kordas.find((k) => k.id === formData.outboundKordaId)?.name}
              <br />
              <strong>Korda Kembali:</strong>{" "}
              {kordas.find((k) => k.id === formData.returnKordaId)?.name}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKordaChangeWarning(false)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                setKordaChangeConfirmed(true);
                setShowKordaChangeWarning(false);
              }}
            >
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

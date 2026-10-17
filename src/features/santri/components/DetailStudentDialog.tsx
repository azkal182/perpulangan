"use client";

import { useEffect, useState } from "react";
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
import { getStudentById } from "../actions/student-crud.action";
import { Badge } from "@/components/ui/badge";

interface DetailStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string | null;
}

export function DetailStudentDialog({
  open,
  onOpenChange,
  studentId,
}: DetailStudentDialogProps) {
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [student, setStudent] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && studentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true);
      setError(null);
      getStudentById(studentId)
        .then((result) => {
          if (result.success && result.student) {
            setStudent(result.student);
          } else {
            setError(result.error || "Gagal memuat data siswa");
          }
        })
        .catch(() => {
          setError("Terjadi kesalahan saat memuat data.");
        })
        .finally(() => {
          setLoading(false);
        });
    } else if (!open) {
      // Clear data when closed
      setStudent(null);
      setError(null);
    }
  }, [open, studentId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail Santri</DialogTitle>
          <DialogDescription>
            Informasi lengkap data santri.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
           <div className="p-4 text-center text-destructive">
               {error}
           </div>
        ) : student ? (
          <div className="grid gap-4 py-4 text-sm">
            <div className="grid grid-cols-[120px_auto] gap-2 items-center">
                <span className="font-medium text-muted-foreground">ID API / NIS</span>
                <span>{student.idApi} / {student.nis || "-"}</span>
            </div>
            <div className="grid grid-cols-[120px_auto] gap-2 items-center">
                <span className="font-medium text-muted-foreground">Nama Lengkap</span>
                <span className="font-medium">{student.name}</span>
            </div>
            <div className="grid grid-cols-[120px_auto] gap-2 items-center">
                <span className="font-medium text-muted-foreground">Gender</span>
                <span>{student.gender === "Laki-laki" ? "Laki-laki" : student.gender === "Perempuan" ? "Perempuan" : "-"}</span>
            </div>
            <div className="grid grid-cols-[120px_auto] gap-2 items-center">
                <span className="font-medium text-muted-foreground">TTL</span>
                <span>{student.ttl || "-"}</span>
            </div>
            <div className="grid grid-cols-[120px_auto] gap-2 items-center">
                <span className="font-medium text-muted-foreground">Asrama</span>
                <span>{student.dormitory || "-"}</span>
            </div>
            <div className="grid grid-cols-[120px_auto] gap-2 items-center">
                <span className="font-medium text-muted-foreground">Alamat</span>
                <span>{student.fullAddress || "-"}</span>
            </div>
            {student.sourceAddress && (
              <div className="grid gap-1 rounded-md border p-3">
                <span className="font-medium text-muted-foreground">Sumber alamat API</span>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(student.sourceAddress, null, 2)}</pre>
                <span className="text-xs text-muted-foreground">Status data wilayah: {student.regionalStatus === "VERIFIED" ? "Terverifikasi admin" : student.regionalStatus === "AUTO_MAPPED" ? "Terpetakan otomatis" : "Perlu ditinjau"}</span>
                {student.regionalReviewNote && <span className="text-xs text-muted-foreground">Catatan: {student.regionalReviewNote}</span>}
              </div>
            )}
            <div className="grid grid-cols-[120px_auto] gap-2 items-center">
                <span className="font-medium text-muted-foreground">No. HP Wali</span>
                <span>{student.parrentPhone || "-"}</span>
            </div>
            <div className="grid grid-cols-[120px_auto] gap-2 items-center">
                <span className="font-medium text-muted-foreground">Status</span>
                <span>
                     <Badge variant={student.status ? "secondary" : "destructive"}>
                        {student.status ? "Aktif" : "Non Aktif"}
                     </Badge>
                </span>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteStudent } from "../actions/student-crud.action";

interface DeleteStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string | null;
  studentName: string | null;
  onSuccess?: () => void;
}

export function DeleteStudentDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  onSuccess,
}: DeleteStudentDialogProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!studentId) return;

    setDeleting(true);
    try {
      const result = await deleteStudent(studentId);

      if (!result.success) {
        toast.error(result.error || "Gagal menghapus data santri");
        return;
      }

      toast.success("Data santri berhasil dihapus");
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error("Terjadi kesalahan sistem, coba lagi nanti");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Hapus Santri</DialogTitle>
          <DialogDescription>
            Apakah Anda yakin ingin menghapus data santri <strong>{studentName}</strong>?
            Tindakan ini tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Batal
          </Button>
          <Button 
            type="button" 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={deleting}
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Dihapus...
              </>
            ) : (
              "Ya, Hapus"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

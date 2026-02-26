"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteRegistrationAction } from "../actions/registration-actions";
import type { RegistrationWithDetails } from "../repositories/registrations.repository";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

interface DeleteRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration: RegistrationWithDetails | null;
}

export function DeleteRegistrationDialog({
  open,
  onOpenChange,
  registration,
}: DeleteRegistrationDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const confirmationConfig = useMemo(() => {
    if (!registration) {
      return {
        requires: "NIS",
        expectedRaw: "",
        expectedDisplay: "-",
      } as const;
    }

    const nis = registration.student.nis?.trim() ?? "";
    if (nis.length > 0) {
      return {
        requires: "NIS",
        expectedRaw: nis,
        expectedDisplay: nis,
      } as const;
    }

    const name = registration.student.name.trim();
    return {
      requires: "NAMA",
      expectedRaw: name,
      expectedDisplay: name,
    } as const;
  }, [registration]);

  const isConfirmValid = useMemo(() => {
    if (!registration) {
      return false;
    }

    const input = confirmText.trim();
    if (confirmationConfig.requires === "NIS") {
      return input === confirmationConfig.expectedRaw;
    }

    return (
      input.localeCompare(confirmationConfig.expectedRaw, "id", {
        sensitivity: "base",
      }) === 0
    );
  }, [confirmText, confirmationConfig, registration]);

  useEffect(() => {
    if (!open) {
      setConfirmText("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!registration) return;
    if (!isConfirmValid) {
      toast.error(
        `${confirmationConfig.requires} tidak cocok. Silakan cek kembali.`,
      );
      return;
    }

    setSubmitting(true);
    const result = await deleteRegistrationAction(registration.id);

    if (result.success) {
      toast.success("Registrasi berhasil dihapus");
      onOpenChange(false);
      setConfirmText("");
    } else {
      toast.error(result.error || "Gagal menghapus registrasi");
    }
    setSubmitting(false);
  };

  if (!registration) return null;
  const nisDisplay = registration.student.nis?.trim() || "-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Hapus Registrasi Permanen
          </DialogTitle>
          <DialogDescription>
            {registration.student.name} - {nisDisplay}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Strong Warning */}
          <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-red-900">
                  PERINGATAN: Tindakan ini tidak dapat dibatalkan!
                </p>
                <ul className="list-disc list-inside space-y-1 text-red-800">
                  <li>Data registrasi akan dihapus permanen dari database</li>
                  <li>Semua informasi perjalanan akan hilang</li>
                  <li>History pembayaran akan terhapus</li>
                  <li>Tidak ada cara untuk mengembalikan data ini</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Registration Info Summary */}
          <div className="rounded-lg border p-3 bg-muted/50 space-y-1 text-sm">
            <div className="font-semibold">Data yang akan dihapus:</div>
            <div>• Siswa: {registration.student.name}</div>
            <div>• NIS: {nisDisplay}</div>
            {registration.outboundDropPoint && (
              <div>• Pulang: {registration.outboundKorda?.name} → {registration.outboundDropPoint.name}</div>
            )}
            {registration.returnDropPoint && (
              <div>• Kembali: {registration.returnKorda?.name} → {registration.returnDropPoint.name}</div>
            )}
            <div>• Status: {registration.status}</div>
          </div>

          {/* Confirmation Input */}
          <div className="space-y-2">
            <Label htmlFor="confirm">
              Ketik {confirmationConfig.requires} siswa{" "}
              <strong className="text-destructive">
                {confirmationConfig.expectedDisplay}
              </strong>{" "}
              untuk konfirmasi
            </Label>
            {confirmationConfig.requires === "NAMA" && (
              <p className="text-xs text-muted-foreground">
                Data ini tidak memiliki NIS, gunakan nama siswa untuk konfirmasi.
              </p>
            )}
            <Input
              id="confirm"
              placeholder={`Ketik ${confirmationConfig.requires} di sini...`}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className={confirmationConfig.requires === "NIS" ? "font-mono" : undefined}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!isConfirmValid || submitting}
          >
            {submitting ? "Menghapus..." : "Ya, Hapus Permanen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

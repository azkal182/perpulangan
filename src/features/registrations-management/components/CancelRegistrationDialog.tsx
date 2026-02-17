"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cancelRegistrationAction } from "../actions/registration-actions";
import type { RegistrationWithDetails } from "../repositories/registrations.repository";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

interface CancelRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration: RegistrationWithDetails | null;
}

export function CancelRegistrationDialog({
  open,
  onOpenChange,
  registration,
}: CancelRegistrationDialogProps) {
  const [cancelType, setCancelType] = useState<"full" | "return_only">("full");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!registration) return;

    setSubmitting(true);
    const result = await cancelRegistrationAction({
      registrationId: registration.id,
      cancelType,
      reason: reason.trim() || undefined,
    });

    if (result.success) {
      toast.success("Registrasi berhasil dibatalkan");
      onOpenChange(false);
      setReason("");
      setCancelType("full");
    } else {
      toast.error(result.error || "Gagal membatalkan registrasi");
    }
    setSubmitting(false);
  };

  if (!registration) return null;

  // Check if registration has both journeys
  const hasBothJourneys = !!registration.outboundDropPoint && !!registration.returnDropPoint;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batalkan Registrasi</DialogTitle>
          <DialogDescription>
            {registration.student.name} - {registration.student.nis}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <div className="flex gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
            <div className="text-yellow-800">
              Pembatalan registrasi akan mengubah status menjadi{" "}
              <strong>{cancelType === "full" ? "CANCELLED" : "PARTIAL_CANCEL"}</strong>.
              {cancelType === "return_only" && " Perjalanan pulang tetap aktif."}
            </div>
          </div>

          {/* Cancel Type */}
          {hasBothJourneys && (
            <div className="space-y-3">
              <Label>Jenis Pembatalan</Label>
              <RadioGroup value={cancelType} onValueChange={(value) => setCancelType(value as "full" | "return_only")}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="full" id="full" />
                  <Label htmlFor="full" className="font-normal cursor-pointer">
                    Batalkan Semua (Pulang & Kembali)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="return_only" id="return_only" />
                  <Label htmlFor="return_only" className="font-normal cursor-pointer">
                    Batalkan Kembali Saja (Pulang tetap aktif)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Alasan Pembatalan (Opsional)</Label>
            <Textarea
              id="reason"
              placeholder="Masukkan alasan pembatalan..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Membatalkan..." : "Ya, Batalkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

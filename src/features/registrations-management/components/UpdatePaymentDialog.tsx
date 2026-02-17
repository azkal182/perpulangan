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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { updatePaymentStatusAction } from "../actions/registration-actions";
import type { RegistrationWithDetails } from "../repositories/registrations.repository";
import { toast } from "sonner";

interface UpdatePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration: RegistrationWithDetails | null;
}

export function UpdatePaymentDialog({
  open,
  onOpenChange,
  registration,
}: UpdatePaymentDialogProps) {
  const [outboundPaid, setOutboundPaid] = useState(false);
  const [returnPaid, setReturnPaid] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Initialize state when dialog opens
  useState(() => {
    if (registration && open) {
      setOutboundPaid(registration.outboundPaid);
      setReturnPaid(registration.returnPaid);
    }
  });

  const handleSubmit = async () => {
    if (!registration) return;

    setSubmitting(true);
    const result = await updatePaymentStatusAction({
      registrationId: registration.id,
      outboundPaid,
      returnPaid,
    });

    if (result.success) {
      toast.success("Status pembayaran berhasil diupdate");
      onOpenChange(false);
    } else {
      toast.error(result.error || "Gagal update pembayaran");
    }
    setSubmitting(false);
  };

  if (!registration) return null;

  const outboundPrice = registration.outboundDropPoint?.price || 0;
  const returnPrice = registration.returnDropPoint?.price || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Status Pembayaran</DialogTitle>
          <DialogDescription>
            {registration.student.name} - {registration.student.nis}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Outbound Payment */}
          {registration.outboundDropPoint && (
            <div className="flex items-start space-x-3 rounded-lg border p-4">
              <Checkbox
                id="outbound"
                checked={outboundPaid}
                onCheckedChange={(checked) => setOutboundPaid(checked as boolean)}
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="outbound"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Pulang - {registration.outboundDropPoint.name}
                </Label>
                <p className="text-sm text-muted-foreground">
                  Rp {outboundPrice.toLocaleString("id-ID")}
                </p>
              </div>
            </div>
          )}

          {/* Return Payment */}
          {registration.returnDropPoint && (
            <div className="flex items-start space-x-3 rounded-lg border p-4">
              <Checkbox
                id="return"
                checked={returnPaid}
                onCheckedChange={(checked) => setReturnPaid(checked as boolean)}
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="return"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Kembali - {registration.returnDropPoint.name}
                </Label>
                <p className="text-sm text-muted-foreground">
                  Rp {returnPrice.toLocaleString("id-ID")}
                </p>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total yang Dibayar</span>
              <span className="text-lg font-bold">
                Rp {(
                  (outboundPaid ? outboundPrice : 0) +
                  (returnPaid ? returnPrice : 0)
                ).toLocaleString("id-ID")}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

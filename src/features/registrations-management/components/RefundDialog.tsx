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
import { refundPaymentAction } from "../actions/registration-actions";
import type { RegistrationWithDetails } from "../repositories/registrations.repository";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration: RegistrationWithDetails | null;
}

export function RefundDialog({
  open,
  onOpenChange,
  registration,
}: RefundDialogProps) {
  const [refundOutbound, setRefundOutbound] = useState(false);
  const [refundReturn, setRefundReturn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!registration) return;
    if (!refundOutbound && !refundReturn) {
      toast.error("Pilih minimal satu perjalanan untuk di-refund");
      return;
    }

    setSubmitting(true);
    const result = await refundPaymentAction({
      registrationId: registration.id,
      refundOutbound,
      refundReturn,
    });

    if (result.success) {
      toast.success("Refund berhasil diproses");
      onOpenChange(false);
      setRefundOutbound(false);
      setRefundReturn(false);
    } else {
      toast.error(result.error || "Gagal melakukan refund");
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
          <DialogTitle>Refund Pembayaran</DialogTitle>
          <DialogDescription>
            {registration.student.name} - {registration.student.nis}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <div className="flex gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
            <div className="text-yellow-800">
              Refund akan mengubah status pembayaran menjadi <strong>Belum Bayar</strong>.
              Pastikan dana sudah dikembalikan ke peserta.
            </div>
          </div>

          {/* Outbound Refund */}
          {registration.outboundPaid && registration.outboundDropPoint && (
            <div className="flex items-start space-x-3 rounded-lg border p-4">
              <Checkbox
                id="refund-outbound"
                checked={refundOutbound}
                onCheckedChange={(checked) => setRefundOutbound(checked as boolean)}
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="refund-outbound"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Refund Pulang - {registration.outboundDropPoint.name}
                </Label>
                <p className="text-sm text-muted-foreground">
                  Rp {outboundPrice.toLocaleString("id-ID")}
                </p>
              </div>
            </div>
          )}

          {/* Return Refund */}
          {registration.returnPaid && registration.returnDropPoint && (
            <div className="flex items-start space-x-3 rounded-lg border p-4">
              <Checkbox
                id="refund-return"
                checked={refundReturn}
                onCheckedChange={(checked) => setRefundReturn(checked as boolean)}
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="refund-return"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Refund Kembali - {registration.returnDropPoint.name}
                </Label>
                <p className="text-sm text-muted-foreground">
                  Rp {returnPrice.toLocaleString("id-ID")}
                </p>
              </div>
            </div>
          )}

          {/* No paid journeys */}
          {!registration.outboundPaid && !registration.returnPaid && (
            <div className="text-center text-muted-foreground py-4">
              Tidak ada pembayaran yang bisa di-refund
            </div>
          )}

          {/* Total Refund */}
          {(refundOutbound || refundReturn) && (
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total Refund</span>
                <span className="text-lg font-bold text-red-600">
                  - Rp {(
                    (refundOutbound ? outboundPrice : 0) +
                    (refundReturn ? returnPrice : 0)
                  ).toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={submitting || (!refundOutbound && !refundReturn)}
          >
            {submitting ? "Memproses..." : "Proses Refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
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
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cancelRegistration } from "../actions/registration.action";
import type { Registration } from "../types";

type Props = {
  registration: Registration;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CancelRegistrationDialog({
  registration,
  open,
  onOpenChange,
}: Props) {
  const [reason, setReason] = React.useState("");
  const [refundAmount, setRefundAmount] = React.useState<number>(0);
  const [type, setType] = React.useState<"full" | "partial">("full");
  const [submitting, setSubmitting] = React.useState(false);

  // Determine if partial cancel is available
  // Partial means cancelling return only, keeping outbound active.
  const canPartialCancel = !!registration.outboundDropPointId;

  // Calculate default refund based on type selection
  React.useEffect(() => {
    if (type === "full") {
      let total = 0;
      if (registration.outboundPaid && registration.outboundDropPoint) {
        total += registration.outboundDropPoint.price;
      }
      if (registration.returnPaid && registration.returnDropPoint) {
        total += registration.returnDropPoint.price;
      }
      setRefundAmount(total);
    } else {
      // Partial = Return only
      if (registration.returnPaid && registration.returnDropPoint) {
        setRefundAmount(registration.returnDropPoint.price);
      } else {
        setRefundAmount(0);
      }
    }
  }, [type, registration]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;

    setSubmitting(true);
    try {
      const result = await cancelRegistration(
        registration.id,
        type,
        reason,
        refundAmount
      );

      if (result.success) {
        onOpenChange(false);
        setReason("");
        setRefundAmount(0);
        window.location.reload();
      } else {
        alert(result.error);
      }
    } catch {
      alert("Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batalkan Pendaftaran</DialogTitle>
          <DialogDescription>
            Tindakan ini tidak dapat dibatalkan. Data pembatalan akan dicatat.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {canPartialCancel && (
            <div className="space-y-2">
              <Label>Jenis Pembatalan</Label>
              <RadioGroup
                value={type}
                onValueChange={(v) => setType(v as "full" | "partial")}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="full" id="cancel-full" />
                  <Label htmlFor="cancel-full">Batalkan Semua (Pulang & Kembali)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="partial" id="cancel-partial" />
                  <Label htmlFor="cancel-partial">
                    Batalkan Kembali Saja (Outbound tetap aktif)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {!canPartialCancel && (
             <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                Pendaftaran ini adalah &quot;Kembali Saja&quot;, pembatalan akan membatalkan seluruh pendaftaran.
             </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Alasan Pembatalan</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Sakit, batal pulang, dll..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund">Nominal Refund (Pengembalian Dana)</Label>
            <Input
              id="refund"
              type="number"
              min="0"
              value={refundAmount}
              onChange={(e) => setRefundAmount(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              *Nominal default dihitung berdasarkan status pembayaran.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" variant="destructive" disabled={submitting}>
              {submitting ? "Memproses..." : "Konfirmasi Pembatalan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

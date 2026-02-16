"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Trash2, Ban } from "lucide-react";
import type { Registration } from "../types";
import { CancelRegistrationDialog } from "./CancelRegistrationDialog";

type Props = {
  registrations: Registration[];
  onDelete: (id: string) => void;
  onConfirmKordaChange: (id: string) => void;
  loading?: boolean;
};

export function RegistrationList({
  registrations,
  onDelete,
  onConfirmKordaChange,
  loading = false,
}: Props) {
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [selectedRegistration, setSelectedRegistration] = React.useState<Registration | null>(null);

  const getStatusVariant = (status: Registration["status"]) => {
    switch (status) {
      case "CONFIRMED":
        return "default";
      case "DRAFT":
        return "secondary";
      case "CANCELLED":
      case "PARTIAL_CANCEL":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (registrations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Belum ada pendaftaran
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Siswa</TableHead>
            <TableHead>Korda & Titik Turun</TableHead>
            <TableHead>Harga</TableHead>
            <TableHead>Pembayaran</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {registrations.map((reg) => {
            const kordaChanged = reg.kordaChanged;
            const kordaChangeNeedsConfirmation = kordaChanged && !reg.kordaChangeConfirmed;
            const outboundPrice = reg.outboundDropPoint?.price || 0;
            const returnPrice = reg.returnDropPoint?.price || 0;
            const totalPrice = outboundPrice + returnPrice;

            return (
              <TableRow key={reg.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{reg.student.name}</div>
                    <div className="text-sm text-muted-foreground">{reg.student.nis}</div>
                  </div>
                </TableCell>

                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {kordaChanged && (
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                      )}
                      <span className="font-medium">{reg.outboundKorda?.name || reg.returnKorda?.name || '-'}</span>
                    </div>
                    {reg.outboundDropPoint ? (
                      <div className="text-sm text-muted-foreground">
                        Pulang: {reg.outboundDropPoint.name}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Pulang: -
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground">
                      Kembali: {reg.returnDropPoint?.name || '-'}
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <div className="text-sm">
                    Rp {totalPrice.toLocaleString("id-ID")}
                  </div>
                </TableCell>

                <TableCell>
                  <div className="space-y-1">
                    <Badge variant={reg.outboundPaid ? "default" : "outline"} className="text-xs">
                      Pulang: {reg.outboundPaid ? "Lunas" : "Belum"}
                    </Badge>
                    <br />
                    <Badge variant={reg.returnPaid ? "default" : "outline"} className="text-xs">
                      Kembali: {reg.returnPaid ? "Lunas" : "Belum"}
                    </Badge>
                  </div>
                </TableCell>

                <TableCell>
                  <Badge variant={getStatusVariant(reg.status)}>
                    {reg.status}
                  </Badge>
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {kordaChangeNeedsConfirmation && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onConfirmKordaChange(reg.id)}
                        disabled={loading}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Konfirmasi Korda
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        setSelectedRegistration(reg);
                        setCancelDialogOpen(true);
                      }}
                      disabled={loading || reg.status === 'CANCELLED' || reg.status === 'PARTIAL_CANCEL'}
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Yakin hapus pendaftaran ini?")) {
                          onDelete(reg.id);
                        }
                      }}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {selectedRegistration && (
        <CancelRegistrationDialog
          registration={selectedRegistration}
          open={cancelDialogOpen}
          onOpenChange={(open) => {
            setCancelDialogOpen(open);
            if (!open) setSelectedRegistration(null);
          }}
        />
      )}
    </div>
  );
}

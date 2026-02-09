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
import { AlertCircle, CheckCircle, Trash2 } from "lucide-react";
import type { Registration } from "../types";

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
  const getPaymentStatus = (reg: Registration) => {
    if (reg.outboundPaid && reg.returnPaid) return "Lunas";
    if (reg.outboundPaid || reg.returnPaid) return "Sebagian";
    return "Belum Bayar";
  };

  const getPaymentVariant = (reg: Registration) => {
    if (reg.outboundPaid && reg.returnPaid) return "default";
    if (reg.outboundPaid || reg.returnPaid) return "secondary";
    return "outline";
  };

  const getStatusVariant = (status: Registration["status"]) => {
    switch (status) {
      case "CONFIRMED":
        return "default";
      case "DRAFT":
        return "secondary";
      case "CANCELLED":
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
            const totalPrice = reg.outboundDropPoint.price + reg.returnDropPoint.price;

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
                      <span className="font-medium">{reg.outboundKorda.name}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Pulang: {reg.outboundDropPoint.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Kembali: {reg.returnDropPoint.name}
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
    </div>
  );
}

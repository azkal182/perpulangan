"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { getStatusColor, formatDate } from "../lib/helpers";
import type { RegistrationWithDetails } from "../repositories/registrations.repository";

interface RegistrationDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration: RegistrationWithDetails | null;
}

export function RegistrationDetailDialog({
  open,
  onOpenChange,
  registration,
}: RegistrationDetailDialogProps) {
  if (!registration) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail Registrasi</DialogTitle>
          <DialogDescription>
            Informasi lengkap peserta {registration.student.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Student Info */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Data Siswa</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Nama</div>
                <div className="font-medium">{registration.student.name}</div>
              </div>
              <div>
                <div className="text-muted-foreground">NIS</div>
                <div className="font-medium">{registration.student.nis}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Jenis Kelamin</div>
                <div className="font-medium">{registration.student.gender}</div>
              </div>
              <div>
                <div className="text-muted-foreground">TTL</div>
                <div className="font-medium">{registration.student.ttl || "-"}</div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Status</h3>
            <div className="flex gap-2">
              <Badge
                variant="outline"
                className={`text-xs ${getStatusColor(registration.status)}`}
              >
                {registration.status}
              </Badge>
            </div>
          </div>

          {/* Outbound Journey */}
          {registration.outboundKorda && (
            <div className="space-y-2 border-l-4 border-blue-500 pl-4">
              <h3 className="font-semibold text-sm">Perjalanan Pulang</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Korda</div>
                  <div className="font-medium">{registration.outboundKorda.name}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Titik Turun</div>
                  <div className="font-medium">{registration.outboundDropPoint?.name || "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Harga</div>
                  <div className="font-medium">
                    Rp {(registration.outboundDropPoint?.price || 0).toLocaleString("id-ID")}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status Bayar</div>
                  <div className="flex items-center gap-1">
                    {registration.outboundPaid ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-green-600 font-medium">Lunas</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-red-600 font-medium">Belum Bayar</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Return Journey */}
          {registration.returnKorda && (
            <div className="space-y-2 border-l-4 border-green-500 pl-4">
              <h3 className="font-semibold text-sm">Perjalanan Kembali</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Korda</div>
                  <div className="font-medium">{registration.returnKorda.name}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Titik Turun</div>
                  <div className="font-medium">{registration.returnDropPoint?.name || "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Harga</div>
                  <div className="font-medium">
                    Rp {(registration.returnDropPoint?.price || 0).toLocaleString("id-ID")}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status Bayar</div>
                  <div className="flex items-center gap-1">
                    {registration.returnPaid ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-green-600 font-medium">Lunas</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-red-600 font-medium">Belum Bayar</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total Biaya</span>
              <span className="text-lg font-bold">
                Rp {(
                  (registration.outboundDropPoint?.price || 0) +
                  (registration.returnDropPoint?.price || 0)
                ).toLocaleString("id-ID")}
              </span>
            </div>
          </div>

          {/* Registration Info */}
          <div className="space-y-2 border-t pt-4">
            <h3 className="font-semibold text-sm">Info Pendaftaran</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Pendaftar</div>
                <div className="font-medium">{registration.registrarName}</div>
              </div>
              <div>
                <div className="text-muted-foreground">No. Telepon</div>
                <div className="font-medium">{registration.registrarPhone}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Tgl Daftar</div>
                <div className="font-medium">{formatDate(registration.createdAt)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Tgl Update</div>
                <div className="font-medium">{formatDate(registration.updatedAt)}</div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

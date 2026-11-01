"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle } from "lucide-react";
import { formatDate } from "../lib/helpers";
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
  const isExternal = Boolean(registration.externalParticipant);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail Registrasi</DialogTitle>
          <DialogDescription>
            Informasi peserta {registration.student.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Student Info */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">{isExternal ? "Data Peserta Eksternal" : "Data Siswa"}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Nama</div>
                <div className="font-medium">{registration.student.name}</div>
              </div>
              {!isExternal && (
                <div>
                  <div className="text-muted-foreground">NIS</div>
                  <div className="font-medium">{registration.student.nis}</div>
                </div>
              )}
              <div>
                <div className="text-muted-foreground">Jenis Kelamin</div>
                <div className="font-medium">{registration.student.gender}</div>
              </div>
              {!isExternal && (
                <div>
                  <div className="text-muted-foreground">TTL</div>
                  <div className="font-medium">{registration.student.ttl || "-"}</div>
                </div>
              )}
              {isExternal && (
                <div className="col-span-2">
                  <div className="text-muted-foreground">Alamat</div>
                  <div className="font-medium">{registration.externalParticipant?.address || "-"}</div>
                </div>
              )}
            </div>
          </div>

          {/* Outbound Journey */}
          {registration.outboundJourneyStatus && registration.outboundKorda && (
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
                    {registration.outboundTariffSnapshot == null ? "Tarif belum tersedia" : `Rp ${registration.outboundTariffSnapshot.toLocaleString("id-ID")}`}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status Bayar</div>
                  <div className="flex items-center gap-1">
                    {registration.outboundPaymentStatus === "PAID" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-green-600 font-medium">Lunas</span>
                      </>
                    ) : registration.outboundPaymentStatus === "CANCELLED" ? (
                      <span className="text-muted-foreground">Perjalanan dibatalkan</span>
                    ) : registration.outboundPaymentStatus === "PARTIAL" ? (
                      <span className="text-amber-700 font-medium">Bayar sebagian</span>
                    ) : registration.outboundPaymentStatus === "UNKNOWN" ? (
                      <span className="text-muted-foreground">Tarif belum tersedia</span>
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
          {registration.returnJourneyStatus && registration.returnKorda && (
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
                    {registration.returnTariffSnapshot == null ? "Tarif belum tersedia" : `Rp ${registration.returnTariffSnapshot.toLocaleString("id-ID")}`}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status Bayar</div>
                  <div className="flex items-center gap-1">
                    {registration.returnPaymentStatus === "PAID" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-green-600 font-medium">Lunas</span>
                      </>
                    ) : registration.returnPaymentStatus === "CANCELLED" ? (
                      <span className="text-muted-foreground">Perjalanan dibatalkan</span>
                    ) : registration.returnPaymentStatus === "PARTIAL" ? (
                      <span className="text-amber-700 font-medium">Bayar sebagian</span>
                    ) : registration.returnPaymentStatus === "UNKNOWN" ? (
                      <span className="text-muted-foreground">Tarif belum tersedia</span>
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
                {registration.outboundTariffSnapshot == null && registration.returnTariffSnapshot == null ? "Tarif belum tersedia" : `Rp ${((registration.outboundTariffSnapshot ?? 0) + (registration.returnTariffSnapshot ?? 0)).toLocaleString("id-ID")}`}
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

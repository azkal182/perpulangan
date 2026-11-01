"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import type { RegistrationWithDetails } from "../repositories/registrations.repository";
import { getJourneyType, getJourneyTypeLabel } from "../lib/helpers";
import { useRouter, useSearchParams } from "next/navigation";
import { RegistrationActionsMenu } from "./RegistrationActionsMenu";
import { RegistrationDetailDialog } from "./RegistrationDetailDialog";
import { UpdatePaymentDialog } from "./UpdatePaymentDialog";
import { CancelRegistrationDialog } from "./CancelRegistrationDialog";
import { RefundDialog } from "./RefundDialog";
import { DeleteRegistrationDialog } from "./DeleteRegistrationDialog";

interface RegistrationsTableProps {
  registrations: RegistrationWithDetails[];
  total: number;
  currentPage: number;
  pageSize: number;
  canWrite: boolean;
  canPurge?: boolean;
}

type DialogType = "detail" | "payment" | "cancel" | "refund" | "delete" | null;

function PaymentStatusBadge({ status }: { status: RegistrationWithDetails["outboundPaymentStatus"] }) {
  if (!status) return null;
  const labels = {
    PAID: "Lunas",
    PARTIAL: "Partial / bayar sebagian",
    UNPAID: "Belum bayar",
    UNKNOWN: "Tarif belum tersedia",
    CANCELLED: "Dibatalkan",
  };
  const classes = {
    PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
    PARTIAL: "border-amber-200 bg-amber-50 text-amber-800",
    UNPAID: "border-rose-200 bg-rose-50 text-rose-700",
    UNKNOWN: "border-sky-200 bg-sky-50 text-sky-800",
    CANCELLED: "border-slate-200 bg-slate-100 text-slate-700",
  };
  return (
    <Badge variant="outline" className={`mt-1 inline-flex w-fit items-center text-xs ${classes[status]}`}>
      {status === "PAID" && <CheckCircle2 aria-hidden="true" className="mr-1 h-3 w-3" />}
      {labels[status]}
    </Badge>
  );
}

export function RegistrationsTable({
  registrations,
  total,
  currentPage,
  pageSize,
  canWrite,
  canPurge = false,
}: RegistrationsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [selectedRegistration, setSelectedRegistration] = useState<RegistrationWithDetails | null>(null);

  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, total);

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const openDialog = (type: DialogType, registration: RegistrationWithDetails) => {
    setSelectedRegistration(registration);
    setActiveDialog(type);
  };

  const closeDialog = () => {
    setActiveDialog(null);
    setSelectedRegistration(null);
  };

  if (registrations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 py-12 text-center">
        <div className="font-medium">Tidak ada peserta yang cocok</div>
        <div className="mt-1 text-sm text-muted-foreground">Coba ubah atau hapus beberapa filter.</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Desktop Table */}
        <div className="hidden lg:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">No</TableHead>
                <TableHead>Peserta</TableHead>
                <TableHead>Pulang</TableHead>
                <TableHead>Kembali</TableHead>
                <TableHead className="w-32">Arah perjalanan</TableHead>
                <TableHead className="w-20">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((reg, idx) => {
                const journeyType = getJourneyType(reg);
                const rowNumber = startIndex + idx;

                return (
                  <TableRow key={reg.id}>
                    <TableCell className="font-medium">{rowNumber}</TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="font-medium">{reg.student.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {reg.externalParticipant ? "Peserta eksternal" : reg.student.nis ? `NIS ${reg.student.nis}` : "NIS tidak tersedia"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {reg.outboundKorda ? (
                        <div className="text-sm">
                          <div className="font-medium">{reg.outboundKorda.name}</div>
                          <div className="text-muted-foreground">
                            {reg.outboundDropPoint?.name}
                          </div>
                          {reg.outboundBus?.label && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Bus: {reg.outboundBus.label}
                            </div>
                          )}
                          <PaymentStatusBadge status={reg.outboundPaymentStatus} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {reg.returnKorda ? (
                        <div className="text-sm">
                          <div className="font-medium">{reg.returnKorda.name}</div>
                          <div className="text-muted-foreground">
                            {reg.returnDropPoint?.name}
                          </div>
                          {reg.returnBus?.label && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Bus: {reg.returnBus.label}
                            </div>
                          )}
                          <PaymentStatusBadge status={reg.returnPaymentStatus} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getJourneyTypeLabel(journeyType)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <RegistrationActionsMenu
                        registration={reg}
                        canWrite={canWrite}
                        canPurge={canPurge}
                        onViewDetail={() => openDialog("detail", reg)}
                        onUpdatePayment={() => openDialog("payment", reg)}
                        onCancel={() => openDialog("cancel", reg)}
                        onRefund={() => openDialog("refund", reg)}
                        onDelete={() => openDialog("delete", reg)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-4">
          {registrations.map((reg, idx) => {
            const journeyType = getJourneyType(reg);
            const rowNumber = startIndex + idx;

            return (
              <div key={reg.id} className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium leading-5">{reg.student.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {reg.externalParticipant ? "Peserta eksternal" : reg.student.nis ? `NIS ${reg.student.nis}` : "NIS tidak tersedia"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">#{rowNumber}</div>
                    <RegistrationActionsMenu
                      registration={reg}
                      canWrite={canWrite}
                      canPurge={canPurge}
                      onViewDetail={() => openDialog("detail", reg)}
                      onUpdatePayment={() => openDialog("payment", reg)}
                      onCancel={() => openDialog("cancel", reg)}
                      onRefund={() => openDialog("refund", reg)}
                      onDelete={() => openDialog("delete", reg)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div className="space-y-1 rounded-md border p-3">
                    <div className="mb-1 font-semibold">Pulang</div>
                    {reg.outboundKorda ? (
                      <div className="text-muted-foreground space-y-1">
                        <div>{reg.outboundKorda.name}</div>
                        <div className="text-xs">{reg.outboundDropPoint?.name}</div>
                        {reg.outboundBus?.label && (
                          <div className="text-xs">Bus: {reg.outboundBus.label}</div>
                        )}
                        <PaymentStatusBadge status={reg.outboundPaymentStatus} />
                      </div>
                    ) : (
                      <div className="text-muted-foreground">-</div>
                    )}
                  </div>

                  <div className="space-y-1 rounded-md border p-3">
                    <div className="mb-1 font-semibold">Kembali</div>
                    {reg.returnKorda ? (
                      <div className="text-muted-foreground space-y-1">
                        <div>{reg.returnKorda.name}</div>
                        <div className="text-xs">{reg.returnDropPoint?.name}</div>
                        {reg.returnBus?.label && (
                          <div className="text-xs">Bus: {reg.returnBus.label}</div>
                        )}
                        <PaymentStatusBadge status={reg.returnPaymentStatus} />
                      </div>
                    ) : (
                      <div className="text-muted-foreground">-</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Badge variant="outline" className="text-xs">
                    {getJourneyTypeLabel(journeyType)}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              Menampilkan {startIndex}–{endIndex} dari {total} peserta
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Sebelumnya
              </Button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <RegistrationDetailDialog
        open={activeDialog === "detail"}
        onOpenChange={(open) => !open && closeDialog()}
        registration={selectedRegistration}
      />

      <UpdatePaymentDialog
        open={activeDialog === "payment"}
        onOpenChange={(open) => !open && closeDialog()}
        registration={selectedRegistration}
      />

      <CancelRegistrationDialog
        open={activeDialog === "cancel"}
        onOpenChange={(open) => !open && closeDialog()}
        registration={selectedRegistration}
      />

      <RefundDialog
        open={activeDialog === "refund"}
        onOpenChange={(open) => !open && closeDialog()}
        registration={selectedRegistration}
      />

      <DeleteRegistrationDialog
        open={activeDialog === "delete"}
        onOpenChange={(open) => !open && closeDialog()}
        registration={selectedRegistration}
      />
    </>
  );
}

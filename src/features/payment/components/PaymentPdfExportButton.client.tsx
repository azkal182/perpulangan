"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { PaymentParticipantRow } from "./PaymentParticipantsTable";
import { generatePaymentsPDF, type PaymentPdfFilter } from "../lib/payment-pdf-generator";

export function PaymentPdfExportButton({
  rows,
  eventName,
  search,
}: {
  rows: PaymentParticipantRow[];
  eventName: string;
  search: string;
}) {
  const [loading, setLoading] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<PaymentPdfFilter>("ALL");

  function handleExport() {
    setLoading(true);
    try {
      generatePaymentsPDF(rows, eventName, search, paymentFilter);
      toast.success("Laporan pembayaran PDF berhasil dibuat.");
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan saat membuat laporan PDF pembayaran.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <select
        value={paymentFilter}
        onChange={(event) => setPaymentFilter(event.target.value as PaymentPdfFilter)}
        aria-label="Pilih status pembayaran untuk export PDF"
        className="w-full rounded-md border bg-background px-3 py-2 text-sm sm:w-[205px]"
        disabled={loading || !eventName}
      >
        <option value="ALL">Export semua status</option>
        <option value="PAID">Sudah bayar (termasuk sebagian)</option>
        <option value="UNPAID">Belum bayar</option>
      </select>
      <button
        type="button"
        onClick={handleExport}
        disabled={loading || !eventName}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
        {loading ? "Menyusun PDF…" : "Export PDF"}
      </button>
    </div>
  );
}

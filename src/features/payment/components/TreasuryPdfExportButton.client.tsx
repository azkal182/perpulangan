"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getTreasuryOfficialReportAction } from "../actions/treasury-report.actions";
import { downloadTreasuryOfficialPdf } from "../lib/treasury-report-pdf";

export function TreasuryPdfExportButton() {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const result = await getTreasuryOfficialReportAction();
      if (!result.success || !result.data) {
        toast.error(result.error ?? "Gagal menyiapkan laporan PDF.");
        return;
      }
      downloadTreasuryOfficialPdf(result.data);
      toast.success("Laporan PDF berhasil dibuat.");
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan saat membuat laporan PDF.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
      {loading ? "Menyusun PDF…" : "Export laporan PDF"}
    </button>
  );
}

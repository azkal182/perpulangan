"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getTreasuryExportDataAction, type TreasuryExportDirection } from "../actions/treasury-export.actions";
import { downloadTreasuryExcel } from "../lib/treasury-excel";

export function TreasuryExportButton({ direction }: { direction: TreasuryExportDirection }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const result = await getTreasuryExportDataAction(direction);
      if (!result.success || !result.data) {
        toast.error(result.error ?? "Gagal menyiapkan export keuangan.");
        return;
      }
      const date = new Date().toISOString().slice(0, 10);
      downloadTreasuryExcel(result.data, `laporan_keuangan_${direction}_${date}.xlsx`);
      toast.success("Export Excel berhasil dibuat.");
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan saat export Excel.");
    } finally {
      setLoading(false);
    }
  }

  return <button type="button" onClick={handleExport} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60">
    {loading ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
    {loading ? "Menyiapkan export…" : "Export Excel"}
  </button>;
}

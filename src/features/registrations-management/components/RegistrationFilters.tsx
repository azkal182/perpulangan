"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, FileDown, Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Korda } from "@/features/master/types";
import type { DropPoint } from "@/features/drop-points/types";
import { getRegistrationsForExcelExportAction } from "../actions/export-excel.action";
import { downloadRegistrationsExcel } from "../lib/registration-excel";
import { toast } from "sonner";

interface RegistrationFiltersProps {
  eventId: string;
  kordas: Korda[];
  dropPoints: DropPoint[];
}

type JourneyType = "all" | "return_only" | "outbound_only";
type StatusFilter = "all" | "REGISTERED" | "CANCELLED";
type PaymentStatusFilter = "all" | "PAID" | "PARTIAL" | "UNPAID" | "CANCELLED" | "UNKNOWN";
type GenderFilter = "all" | "Laki-laki" | "Perempuan";
type ExportDirection = "OUTBOUND" | "RETURN";

function normalizeGenderFilter(value: string | null): GenderFilter {
  if (value === "Laki-laki" || value === "Perempuan") {
    return value;
  }
  return "all";
}

function normalizeStatusFilter(value: string | null): StatusFilter {
  return value === "REGISTERED" || value === "CANCELLED" ? value : "all";
}

function normalizeJourneyType(value: string | null): JourneyType {
  return value === "outbound_only" || value === "return_only" ? value : "all";
}

function normalizePaymentStatusFilter(value: string | null): PaymentStatusFilter {
  return value === "PAID" || value === "PARTIAL" || value === "UNPAID" || value === "CANCELLED" || value === "UNKNOWN" ? value : "all";
}

export function RegistrationFilters({
  eventId,
  kordas,
  dropPoints,
}: RegistrationFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [journeyType, setJourneyType] = useState<JourneyType>(
    normalizeJourneyType(searchParams.get("journeyType"))
  );
  const [status, setStatus] = useState<StatusFilter>(
    normalizeStatusFilter(searchParams.get("status")),
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>(
    normalizePaymentStatusFilter(searchParams.get("paymentStatus")),
  );
  const [gender, setGender] = useState<GenderFilter>(
    normalizeGenderFilter(searchParams.get("gender")),
  );
  const [kordaId, setKordaId] = useState(
    searchParams.get("kordaId") || "all"
  );
  const [dropPointId, setDropPointId] = useState(
    searchParams.get("dropPointId") || "all"
  );
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportDirection, setExportDirection] = useState<ExportDirection>("OUTBOUND");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (journeyType !== "all") params.set("journeyType", journeyType);
    if (status !== "all") params.set("status", status);
    if (paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
    if (gender !== "all") params.set("gender", gender);
    if (kordaId !== "all") params.set("kordaId", kordaId);
    if (dropPointId !== "all") params.set("dropPointId", dropPointId);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    
    // Reset page when filters change
    params.delete("page");
    
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [
    journeyType,
    status,
    paymentStatus,
    gender,
    kordaId,
    dropPointId,
    debouncedSearch,
    pathname,
    router,
  ]);

  const handleReset = () => {
    setJourneyType("all");
    setStatus("all");
    setPaymentStatus("all");
    setGender("all");
    setKordaId("all");
    setDropPointId("all");
    setSearch("");
    router.replace(pathname);
  };

  const hasActiveFilters = 
    journeyType !== "all" ||
    status !== "all" ||
    paymentStatus !== "all" ||
    gender !== "all" ||
    kordaId !== "all" ||
    dropPointId !== "all" ||
    search.trim() !== "";

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const result = await getRegistrationsForExcelExportAction({
        eventId,
        journeyType,
        exportDirection,
        status,
        paymentStatus,
        gender: gender === "all" ? undefined : gender,
        kordaId: kordaId === "all" ? undefined : kordaId,
        dropPointId: dropPointId === "all" ? undefined : dropPointId,
        search: search.trim() || undefined,
      });

      if (!result.success) {
        toast.error(result.error || "Gagal menyiapkan data export");
        return;
      }

      if (!result.data || !result.totalRows || result.totalRows === 0) {
        toast.error("Tidak ada data untuk diexport");
        return;
      }

      const datePart = new Date().toISOString().slice(0, 10);
      const directionLabel = exportDirection === "OUTBOUND" ? "pulang" : "kembali";
      const filename = `daftar_peserta_${directionLabel}_${datePart}.xlsx`;
      downloadRegistrationsExcel(result.data, filename, directionLabel);

      toast.success(
        `Export ${exportDirection === "OUTBOUND" ? "Pulang" : "Kembali"} berhasil: ${result.totalRows} peserta (${result.data.length} sheet korwil)`,
      );
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan saat export Excel");
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
        <Input
          className="pl-9"
          placeholder="Cari nama atau NIS peserta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Journey Type */}
          <Select value={journeyType} onValueChange={(v) => setJourneyType(v as JourneyType)}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Arah perjalanan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua arah</SelectItem>
              <SelectItem value="outbound_only">Pulang</SelectItem>
              <SelectItem value="return_only">Kembali</SelectItem>
            </SelectContent>
          </Select>

          {/* Payment Status */}
          <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatusFilter)}>
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue placeholder="Status pembayaran" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua pembayaran</SelectItem>
              <SelectItem value="PAID">Lunas</SelectItem>
              <SelectItem value="PARTIAL">Bayar sebagian</SelectItem>
              <SelectItem value="UNPAID">Belum bayar</SelectItem>
              <SelectItem value="CANCELLED">Perjalanan dibatalkan</SelectItem>
              <SelectItem value="UNKNOWN">Tarif belum tersedia</SelectItem>
            </SelectContent>
          </Select>

          {/* Journey Status */}
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Status perjalanan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="REGISTERED">Terdaftar</SelectItem>
              <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
            </SelectContent>
          </Select>

          {/* Gender */}
          <Select value={gender} onValueChange={(v) => setGender(v as GenderFilter)}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Jenis Kelamin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Gender</SelectItem>
              <SelectItem value="Laki-laki">Laki-laki</SelectItem>
              <SelectItem value="Perempuan">Perempuan</SelectItem>
            </SelectContent>
          </Select>

          {/* Korda */}
          <Select value={kordaId} onValueChange={setKordaId}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Korda tujuan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Korda tujuan</SelectItem>
              {kordas.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Drop Point */}
          <Select value={dropPointId} onValueChange={setDropPointId}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Drop Point" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Drop Point</SelectItem>
              {dropPoints.map((dp) => (
                <SelectItem key={dp.id} value={dp.id}>
                  {dp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Reset Button */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="w-full sm:w-auto"
            >
              <X className="mr-2 h-4 w-4" />
              Reset Filter
            </Button>
          )}
        </div>

        {/* Export Button */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={exportDirection} onValueChange={(value) => setExportDirection(value as ExportDirection)}>
            <SelectTrigger className="w-full sm:w-[150px]" aria-label="Arah perjalanan untuk export Excel">
              <SelectValue placeholder="Arah export" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OUTBOUND">Export Pulang</SelectItem>
              <SelectItem value="RETURN">Export Kembali</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handleExportExcel}
            disabled={exportingExcel}
          >
            {exportingExcel ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                Export Excel
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

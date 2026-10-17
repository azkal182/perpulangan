"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { getKorwil } from "@/features/master/actions/korwil.action";
import { getKorda } from "@/features/master/actions/korda.action";
import type { Korwil, Korda } from "@/features/master/types";
import { logger, logError } from "@/lib/logger-client";

import { Download, Filter, Info, Search, UserPlus, XIcon, FileDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getStudentsForPDFExport } from "../actions/export-pdf.action";
import { generateStudentsPDF } from "../utils/pdf-generator";
import { AddManualStudentDialog } from "./AddManualStudentDialog";
import { ImportSingleStudentDialog } from "./ImportSingleStudentDialog";

type StatusParam = "all" | "active" | "inactive";

function normalizeStatusParam(v: string): StatusParam {
  if (v === "active" || v === "inactive" || v === "all") return v;
  return "all";
}

export function SantriToolbarClient({
  lastSyncAt,
  lastStatus,
  initialQuery,
  initialStatus,
  initialKorwilId,
  initialKordaId,
  missingCityCount = 0,
  unlinkedKordaCount = 0,
  initialMissingCity = false,
  initialUnlinkedKorda = false,
}: {
  lastSyncAt: string | null; // ISO
  lastStatus: string | null;
  initialQuery: string;
  initialStatus: string; // dari URL
  initialKorwilId: string;
  initialKordaId: string;
  missingCityCount?: number;
  unlinkedKordaCount?: number;
  initialMissingCity?: boolean;
  initialUnlinkedKorda?: boolean;
}) {
  const [exportingPDF, setExportingPDF] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [importSingleOpen, setImportSingleOpen] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const searchParamsString = sp.toString();

  // URL values
  const urlQ = (sp.get("q") ?? "").trim();
  const urlStatus = normalizeStatusParam((sp.get("status") ?? "all").trim());
  const urlKorwilId = (sp.get("korwilId") ?? "all").trim() || "all";
  const urlKordaId = (sp.get("kordaId") ?? "all").trim() || "all";
  const urlMissingCity = sp.get("missingCity") === "true";
  const urlUnlinkedKorda = sp.get("unlinkedKorda") === "true";
  const lastCommittedQueryRef = useRef(urlQ);

  // UI state
  const [q, setQ] = useState(initialQuery);
  const [status, setStatus] = useState<StatusParam>(
    normalizeStatusParam(initialStatus),
  );
  const [korwilId, setKorwilId] = useState(
    initialKorwilId?.trim() ? initialKorwilId.trim() : "all",
  );
  const [kordaId, setKordaId] = useState(
    initialKordaId?.trim() ? initialKordaId.trim() : "all",
  );
  const [missingCity, setMissingCity] = useState(initialMissingCity);
  const [unlinkedKorda, setUnlinkedKorda] = useState(initialUnlinkedKorda);
  const kordaIdRef = useRef(kordaId);

  const [korwilOptions, setKorwilOptions] = useState<Korwil[]>([]);
  const [kordaOptions, setKordaOptions] = useState<Korda[]>([]);
  const [loadingKorwil, setLoadingKorwil] = useState(false);
  const [loadingKorda, setLoadingKorda] = useState(false);

  // debounce hanya untuk search
  const [debouncedQ, setDebouncedQ] = useState(q);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), 400);
    return () => window.clearTimeout(timer);
  }, [q]);

  // Sync URL -> UI (anti loop)
  useEffect(() => {
    if (urlQ === lastCommittedQueryRef.current) return;
    lastCommittedQueryRef.current = urlQ;
    setQ(urlQ);
    setDebouncedQ(urlQ);
  }, [urlQ]);

  useEffect(() => {
    setStatus((prev) => (prev === urlStatus ? prev : urlStatus));
  }, [urlStatus]);

  useEffect(() => {
    setKorwilId((prev) => (prev === urlKorwilId ? prev : urlKorwilId));
  }, [urlKorwilId]);

  useEffect(() => {
    setKordaId((prev) => (prev === urlKordaId ? prev : urlKordaId));
  }, [urlKordaId]);

  useEffect(() => {
    kordaIdRef.current = kordaId;
  }, [kordaId]);

  useEffect(() => {
    setMissingCity((prev) => (prev === urlMissingCity ? prev : urlMissingCity));
  }, [urlMissingCity]);

  useEffect(() => {
    setUnlinkedKorda((prev) => (prev === urlUnlinkedKorda ? prev : urlUnlinkedKorda));
  }, [urlUnlinkedKorda]);

  useEffect(() => {
    if (korwilId !== "all") return;
    if (kordaId !== "all") setKordaId("all");
  }, [korwilId, kordaId]);

  useEffect(() => {
    let active = true;
    const loadKorwils = async () => {
      try {
        setLoadingKorwil(true);
        const res = await getKorwil({ limit: 100 });
        if (!active) return;
        if (!res.success) {
          setKorwilOptions([]);
          return;
        }
        const items = Array.isArray(res.data) ? res.data : res.data.items;
        setKorwilOptions(items);
      } finally {
        if (active) setLoadingKorwil(false);
      }
    };
    void loadKorwils();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadKordas = async () => {
      if (korwilId === "all") {
        setKordaOptions([]);
        setLoadingKorda(false);
        return;
      }

      try {
        setKordaOptions([]);
        setLoadingKorda(true);
        const res = await getKorda({ korwilId, limit: 100 });
        if (!active) return;
        if (!res.success) {
          setKordaOptions([]);
          return;
        }
        const items = Array.isArray(res.data) ? res.data : res.data.items;
        setKordaOptions(items);
        if (
          kordaIdRef.current !== "all" &&
          !items.some((x) => x.id === kordaIdRef.current)
        ) {
          setKordaId("all");
        }
      } finally {
        if (active) setLoadingKorda(false);
      }
    };
    void loadKordas();
    return () => {
      active = false;
    };
  }, [korwilId]);

  // Sync UI -> URL (anti loop)
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }

    const nextQ = debouncedQ.trim();
    const nextStatus = status;
    const nextKorwilId = korwilId;
    const nextKordaId = korwilId === "all" ? "all" : kordaId;
    const nextMissingCity = missingCity;
    const nextUnlinkedKorda = unlinkedKorda;

    // jika sama persis, skip
    if (
      nextQ === urlQ &&
      nextStatus === urlStatus &&
      nextKorwilId === urlKorwilId &&
      nextKordaId === urlKordaId &&
      nextMissingCity === urlMissingCity &&
      nextUnlinkedKorda === urlUnlinkedKorda
    )
      return;

    const params = new URLSearchParams(searchParamsString);

    // reset page saat filter berubah
    params.delete("page");

    if (nextQ) params.set("q", nextQ);
    else params.delete("q");

    if (nextStatus !== "all") params.set("status", nextStatus);
    else params.delete("status");

    if (nextKorwilId !== "all") params.set("korwilId", nextKorwilId);
    else params.delete("korwilId");

    if (nextKordaId !== "all") params.set("kordaId", nextKordaId);
    else params.delete("kordaId");

    if (nextMissingCity) params.set("missingCity", "true");
    else params.delete("missingCity");

    if (nextUnlinkedKorda) params.set("unlinkedKorda", "true");
    else params.delete("unlinkedKorda");

    const qs = params.toString();
    const nextUrl = qs ? `${pathname}?${qs}` : pathname;
    lastCommittedQueryRef.current = nextQ;

    router.replace(nextUrl, { scroll: false });
  }, [
    debouncedQ,
    status,
    korwilId,
    kordaId,
    missingCity,
    unlinkedKorda,
    pathname,
    router,
    searchParamsString,
    urlQ,
    urlStatus,
    urlKorwilId,
    urlKordaId,
    urlMissingCity,
    urlUnlinkedKorda,
  ]);

  const lastSyncLabel = (() => {
    if (!lastSyncAt) return "Belum pernah sync";
    const d = new Date(lastSyncAt);
    return d.toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  })();

  const statusLabel =
    lastStatus === "success"
      ? "Sukses"
      : lastStatus === "failed"
        ? "Ada error"
        : null;

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      const result = await getStudentsForPDFExport();
      if (result.success && result.data) {
        logger.info({ count: result.data.length }, "santri.export.pdf success");
        generateStudentsPDF(result.data);
      } else {
        logger.warn({ error: result.error }, "santri.export.pdf failed");
        alert(result.error || "Gagal mengambil data siswa");
      }
    } catch (error) {
      logError(error, { component: "SantriToolbar", action: "exportPDF" });
      alert("Terjadi kesalahan saat membuat PDF");
    } finally {
      setExportingPDF(false);
    }
  };

  return (
    <>
      <Alert className="flex items-center justify-between pr-2 [&>svg+div]:translate-y-0 border-none bg-emerald-600/10 text-emerald-500 dark:bg-emerald-600/15">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-4" />
          <div className="flex-col justify-center">
            <AlertTitle>Perpulangan Aktif</AlertTitle>
            <AlertDescription>Liburan Ramadhan 2026</AlertDescription>
          </div>
        </div>

        <Button className="pl-0!" size="icon" variant="ghost">
          <XIcon className="h-5 w-5" />
        </Button>

        <AlertDescription>
          Last sync: {lastSyncLabel}
          {statusLabel ? ` • Status: ${statusLabel}` : ""}
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {/* Search bar - Full width on all screens */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
          <Input
            className="pl-9 pr-10"
            placeholder="Cari nama atau NIS..."
            aria-label="Cari nama atau NIS"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Hapus pencarian"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
              onClick={() => {
                setQ("");
                setDebouncedQ("");
              }}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Filters and Actions Row */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* LEFT: Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {/* KORWIL FILTER */}
            <Select
              value={korwilId}
              onValueChange={(v) => {
                setKorwilId(v);
                setKordaId("all");
              }}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue
                  placeholder={loadingKorwil ? "Memuat korwil..." : "Semua Korwil"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Korwil</SelectItem>
                {korwilOptions.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* KORDA FILTER */}
            <Select
              value={kordaId}
              onValueChange={(v) => setKordaId(v)}
              disabled={korwilId === "all" || loadingKorda}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue
                  placeholder={
                    korwilId === "all"
                      ? "Pilih korwil dulu"
                      : loadingKorda
                        ? "Memuat korda..."
                        : "Semua Korda"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Korda</SelectItem>
                {kordaOptions.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* STATUS FILTER */}
            <Select
              value={status}
              onValueChange={(v) => setStatus(normalizeStatusParam(v))}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Nonaktif</SelectItem>
              </SelectContent>
            </Select>

            {/* MISSING CITY FILTER */}
            {missingCityCount > 0 && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="missingCity"
                  checked={missingCity}
                  onChange={(e) => setMissingCity(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label
                  htmlFor="missingCity"
                  className="text-sm font-medium text-foreground cursor-pointer"
                >
                  Kota/kabupaten belum ada ({missingCityCount})
                </label>
              </div>
            )}

            {unlinkedKordaCount > 0 && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="unlinkedKorda"
                  checked={unlinkedKorda}
                  onChange={(e) => setUnlinkedKorda(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="unlinkedKorda" className="cursor-pointer text-sm font-medium text-foreground">
                  Kabupaten/kota belum terhubung ke Korda ({unlinkedKordaCount})
                </label>
              </div>
            )}

            <Button
              variant="outline"
              className="shrink-0 w-full sm:w-auto"
              size="icon"
              aria-label="Filter"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {/* RIGHT: Action Buttons */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-nowrap">
            <Button
              onClick={handleExportPDF}
              variant="outline"
              className="w-full sm:flex-1 lg:w-auto lg:flex-initial"
              disabled={exportingPDF}
            >
              <FileDown className="mr-2 h-4 w-4" />
              {exportingPDF ? "Membuat PDF..." : "Export PDF"}
            </Button>

            <Button
              variant="outline"
              className="w-full sm:flex-1 lg:w-auto lg:flex-initial"
              onClick={() => setImportSingleOpen(true)}
            >
              <Download className="mr-2 h-4 w-4" />
              Import Single
            </Button>

            <Button
              asChild
              variant="outline"
              className="w-full sm:flex-1 lg:w-auto lg:flex-initial"
            >
              <Link href="/santri/import">
                <Download className="mr-2 h-4 w-4" />
                Import Bulk (Preview)
              </Link>
            </Button>

            <Button
              className="w-full sm:flex-1 lg:w-auto lg:flex-initial"
              onClick={() => setAddStudentOpen(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Tambah Siswa
            </Button>
          </div>
        </div>
      </div>

      <AddManualStudentDialog
        open={addStudentOpen}
        onOpenChange={setAddStudentOpen}
      />

      <ImportSingleStudentDialog
        open={importSingleOpen}
        onOpenChange={setImportSingleOpen}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}

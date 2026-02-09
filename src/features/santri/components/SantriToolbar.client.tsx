"use client";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { bulkUpsertStudents } from "@/features/santri/actions/students.actions";
import { Student } from "@/features/santri/domain/student.model";
import { getStudents } from "@/features/santri/services/students.repository";
import { getKorwil } from "@/features/master/actions/korwil.action";
import { getKorda } from "@/features/master/actions/korda.action";
import type { Korwil, Korda } from "@/features/master/types";

import { Download, Filter, Info, Search, UserPlus, XIcon, FileDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getStudentsForPDFExport } from "../actions/export-pdf.action";
import { generateStudentsPDF } from "../utils/pdf-generator";

type StatusParam = "all" | "active" | "inactive";

function normalizeStatusParam(v: string): StatusParam {
  if (v === "active" || v === "inactive" || v === "all") return v;
  return "all";
}

function summarize(students: Student[]) {
  const total = students.length;

  // status boolean -> bucket
  const statusCount = students.reduce<Record<string, number>>((acc, s) => {
    const key =
      s.status === true
        ? "active"
        : s.status === false
          ? "inactive"
          : "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const genderCount = students.reduce<Record<string, number>>((acc, s) => {
    const key = (s.gender || "unknown").toLowerCase();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const dup = <T,>(arr: T[]) => arr.filter((v, i) => arr.indexOf(v) !== i);

  const idApis = students.map((s) => s.idApi?.trim()).filter(Boolean);
  const niss = students.map((s) => s.nis?.trim()).filter(Boolean);

  const dupIdApi = Array.from(new Set(dup(idApis)));
  const dupNis = Array.from(new Set(dup(niss)));

  const invalid: Array<{
    index: number;
    idApi?: string;
    nis?: string;
    missing: string[];
  }> = [];
  const skipped: Array<{
    index: number;
    idApi?: string;
    nis?: string;
    missing: string[];
  }> = [];

  students
    .map((s, i) => {
      const missing: string[] = [];
      if (!s.idApi) missing.push("idApi");
      if (!s.nis) missing.push("nis");
      if (!s.name) missing.push("name");
      if (!s.gender) missing.push("gender");

      // status boolean: missing kalau null/undefined (bukan !s.status)
      if (s.status === null || s.status === undefined) missing.push("status");

      if (!s.ttl) missing.push("ttl");
      if (!s.dormitory) missing.push("dormitory");
      if (!s.fullAddress) missing.push("fullAddress");
      if (!missing.length) return null;

      const shouldSkip =
        missing.includes("nis") || missing.includes("dormitory");

      const payload = { index: i, idApi: s.idApi, nis: s.nis, missing };
      if (shouldSkip) skipped.push(payload);
      else invalid.push(payload);
      return payload;
    })
    .filter(Boolean);

  return {
    total,
    statusCount,
    genderCount,
    dupIdApi,
    dupNis,
    invalid,
    skipped,
  };
}

function useDebouncedValue<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);

  return debounced;
}

export function SantriToolbarClient({
  lastSyncAt,
  lastStatus,
  initialQuery,
  initialStatus,
  initialKorwilId,
  initialKordaId,
}: {
  lastSyncAt: string | null; // ISO
  lastStatus: string | null;
  initialQuery: string;
  initialStatus: string; // dari URL
  initialKorwilId: string;
  initialKordaId: string;
}) {
  const [openConfirm, setOpenConfirm] = useState(false);

  const [previewRows, setPreviewRows] = useState<Student[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // URL values
  const urlQ = (sp.get("q") ?? "").trim();
  const urlStatus = normalizeStatusParam((sp.get("status") ?? "all").trim());
  const urlKorwilId = (sp.get("korwilId") ?? "all").trim() || "all";
  const urlKordaId = (sp.get("kordaId") ?? "all").trim() || "all";

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
  const kordaIdRef = useRef(kordaId);

  const [korwilOptions, setKorwilOptions] = useState<Korwil[]>([]);
  const [kordaOptions, setKordaOptions] = useState<Korda[]>([]);
  const [loadingKorwil, setLoadingKorwil] = useState(false);
  const [loadingKorda, setLoadingKorda] = useState(false);

  // debounce hanya untuk search
  const debouncedQ = useDebouncedValue(q, 400);

  // Sync URL -> UI (anti loop)
  useEffect(() => {
    setQ((prev) => (prev === urlQ ? prev : urlQ));
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

    // jika sama persis, skip
    if (
      nextQ === urlQ &&
      nextStatus === urlStatus &&
      nextKorwilId === urlKorwilId &&
      nextKordaId === urlKordaId
    )
      return;

    const params = new URLSearchParams(sp.toString());

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

    const qs = params.toString();
    const nextUrl = qs ? `${pathname}?${qs}` : pathname;

    router.replace(nextUrl, { scroll: false });
  }, [
    debouncedQ,
    status,
    korwilId,
    kordaId,
    pathname,
    router,
    sp,
    urlQ,
    urlStatus,
    urlKorwilId,
    urlKordaId,
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

  const previewInfo = useMemo(() => {
    if (!previewRows) return null;
    return summarize(previewRows);
  }, [previewRows]);

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      const result = await getStudentsForPDFExport();
      if (result.success && result.data) {
        generateStudentsPDF(result.data);
      } else {
        alert(result.error || "Gagal mengambil data siswa");
      }
    } catch (error) {
      console.error("PDF export error:", error);
      alert("Terjadi kesalahan saat membuat PDF");
    } finally {
      setExportingPDF(false);
    }
  };

  const onPreviewImport = async () => {
    try {
      setLoadingPreview(true);
      const apiStudents = await getStudents();
      console.log(apiStudents);

      setPreviewRows(apiStudents);
      setOpenConfirm(true);
    } catch {
      alert("Gagal mengambil data dari API.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const onConfirmImport = async () => {
    if (!previewRows) return;

    if (previewInfo?.invalid?.length) {
      alert(
        `Ada ${previewInfo.invalid.length} data invalid (field wajib kosong). ` +
          `Perbaiki sumber data dulu sebelum import.`,
      );
      return;
    }

    if (
      (previewInfo?.dupIdApi?.length ?? 0) > 0 ||
      (previewInfo?.dupNis?.length ?? 0) > 0
    ) {
      const ok = window.confirm(
        `Ditemukan duplikat di payload:\n` +
          `- dup idApi: ${previewInfo?.dupIdApi?.length ?? 0}\n` +
          `- dup nis: ${previewInfo?.dupNis?.length ?? 0}\n\n` +
          `Lanjutkan tetap?`,
      );
      if (!ok) return;
    }

    try {
      setImporting(true);
      const res = await bulkUpsertStudents(previewRows);

      setOpenConfirm(false);
      setPreviewRows(null);

      alert(
        `Import selesai.\n` +
          `Total: ${res.total}\n` +
          `Processed: ${res.processed}\n` +
          `Inserted: ${res.inserted}\n` +
          `Updated: ${res.updated}\n` +
          `Skipped: ${res.skipped}\n` +
          `Failed: ${res.failed}\n` +
          (res.skippedRows.length
            ? `\nContoh skip:\n- ${res.skippedRows[0].message} (index ${res.skippedRows[0].index})`
            : "") +
          (res.errors.length
            ? `\nContoh error:\n- ${res.errors[0].message}`
            : ""),
      );
    } catch {
      alert("Import gagal.");
    } finally {
      setImporting(false);
    }
  };

  const sample = useMemo(
    () => (previewRows ? previewRows.slice(0, 8) : []),
    [previewRows],
  );

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

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* LEFT */}
        <div className="flex w-full flex-col gap-3 md:flex-1 md:flex-row md:items-center md:gap-3">
          <div className="relative w-full md:max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
            <Input
              className="pl-9"
              placeholder="Cari nama atau NIS..."
              aria-label="Cari nama atau NIS"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
            {/* KORWIL FILTER */}
            <Select
              value={korwilId}
              onValueChange={(v) => {
                setKorwilId(v);
                setKordaId("all");
              }}
            >
              <SelectTrigger className="w-full md:w-[190px]">
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
              <SelectTrigger className="w-full md:w-[190px]">
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

            {/* STATUS FILTER (controlled) */}
            <Select
              value={status}
              onValueChange={(v) => setStatus(normalizeStatusParam(v))}
            >
              <SelectTrigger className="w-full md:w-[170px]">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Nonaktif</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              className="shrink-0"
              size="icon"
              aria-label="Filter"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end md:w-auto">
          <Button
            onClick={handleExportPDF}
            variant="outline"
            className="w-full sm:w-auto"
            disabled={exportingPDF}
          >
            <FileDown className="mr-2 h-4 w-4" />
            {exportingPDF ? "Membuat PDF..." : "Export PDF"}
          </Button>

          <Button
            onClick={onPreviewImport}
            variant="outline"
            className="w-full sm:w-auto"
            disabled={loadingPreview || importing}
          >
            <Download className="mr-2 h-4 w-4" />
            {loadingPreview ? "Mengambil data..." : "Import (Preview)"}
          </Button>

          <Button className="w-full sm:w-auto">
            <UserPlus className="mr-2 h-4 w-4" />
            Tambah Siswa
          </Button>
        </div>
      </div>

      {/* CONFIRM DIALOG */}
      <Dialog open={openConfirm} onOpenChange={setOpenConfirm}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Konfirmasi Import Data Santri</DialogTitle>
            <DialogDescription>
              Sistem akan memasukkan data dari API ke database menggunakan{" "}
              <b>upsert</b> (berdasarkan <code>idApi</code>). Pastikan ringkasan
              berikut sesuai sebelum lanjut.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1">
            {!previewInfo ? (
              <div className="text-sm text-muted-foreground">
                Tidak ada data untuk dipreview.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border p-3">
                    <div className="text-muted-foreground">Total baris</div>
                    <div className="text-lg font-semibold">
                      {previewInfo.total}
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="text-muted-foreground">
                      Validasi (blokir)
                    </div>
                    <div className="text-lg font-semibold">
                      {previewInfo.invalid.length === 0
                        ? "OK"
                        : `${previewInfo.invalid.length} invalid`}
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="text-muted-foreground">Skipped</div>
                    <div className="text-lg font-semibold">
                      {previewInfo.skipped.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      NIS/Dormitory kosong akan dilewati
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="text-muted-foreground">Duplikat payload</div>
                    <div className="space-y-1">
                      <div>
                        dup idApi: <b>{previewInfo.dupIdApi.length}</b>
                      </div>
                      <div>
                        dup nis: <b>{previewInfo.dupNis.length}</b>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="text-muted-foreground">Distribusi cepat</div>
                    <div className="space-y-1">
                      <div>
                        status:{" "}
                        {Object.entries(previewInfo.statusCount)
                          .slice(0, 4)
                          .map(([k, v]) => `${k}:${v}`)
                          .join(", ")}
                        {Object.keys(previewInfo.statusCount).length > 4
                          ? "…"
                          : ""}
                      </div>
                      <div>
                        gender:{" "}
                        {Object.entries(previewInfo.genderCount)
                          .slice(0, 4)
                          .map(([k, v]) => `${k}:${v}`)
                          .join(", ")}
                        {Object.keys(previewInfo.genderCount).length > 4
                          ? "…"
                          : ""}
                      </div>
                    </div>
                  </div>
                </div>

                {previewInfo.invalid.length > 0 && (
                  <div className="rounded-md border p-3">
                    <div className="mb-2 text-sm font-semibold text-destructive">
                      Data invalid — import diblokir sampai valid
                    </div>
                    <div className="max-h-40 overflow-auto text-xs">
                      {previewInfo.invalid.slice(0, 20).map((x) => (
                        <div key={`${x.index}-${x.idApi ?? ""}`} className="py-1">
                          #{x.index} idApi={x.idApi ?? "-"} nis={x.nis ?? "-"}{" "}
                          missing: {x.missing.join(", ")}
                        </div>
                      ))}
                      {previewInfo.invalid.length > 20 && (
                        <div className="pt-2 text-muted-foreground">
                          …dan {previewInfo.invalid.length - 20} lainnya
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {previewInfo.skipped.length > 0 && (
                  <div className="rounded-md border p-3">
                    <div className="mb-2 text-sm font-semibold">
                      Data skipped (nis/dormitory kosong)
                    </div>
                    <div className="max-h-40 overflow-auto text-xs">
                      {previewInfo.skipped.slice(0, 20).map((x) => (
                        <div key={`${x.index}-${x.idApi ?? ""}`} className="py-1">
                          #{x.index} idApi={x.idApi ?? "-"} nis={x.nis ?? "-"}{" "}
                          missing: {x.missing.join(", ")}
                        </div>
                      ))}
                      {previewInfo.skipped.length > 20 && (
                        <div className="pt-2 text-muted-foreground">
                          …dan {previewInfo.skipped.length - 20} lainnya
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-md border p-3">
                  <div className="mb-2 text-sm font-semibold">
                    Contoh 8 data pertama
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-background">
                        <tr className="text-left">
                          <th className="py-2 pr-2">NIS</th>
                          <th className="py-2 pr-2">Nama</th>
                          <th className="py-2 pr-2">Status</th>
                          <th className="py-2 pr-2">Dormitory</th>
                          <th className="py-2 pr-2">RegencyId</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sample.map((s) => (
                          <tr key={s.idApi} className="border-t">
                            <td className="py-2 pr-2">{s.nis}</td>
                            <td className="py-2 pr-2">{s.name}</td>
                            <td className="py-2 pr-2">
                              {s.status === true
                                ? "active"
                                : s.status === false
                                  ? "inactive"
                                  : "-"}
                            </td>
                            <td className="py-2 pr-2">{s.dormitory}</td>
                            <td className="py-2 pr-2">{s.regencyId ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setOpenConfirm(false)}
              disabled={importing}
            >
              Batal
            </Button>
            <Button
              onClick={onConfirmImport}
              disabled={
                importing ||
                !previewRows ||
                (previewInfo?.invalid.length ?? 0) > 0
              }
            >
              {importing ? "Mengimpor..." : "Ya, Import ke Database"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle2, Download, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { getStudentDTOs } from "@/features/santri/services/students.repository";
import { bulkUpsertStudents, type BulkImportResult } from "@/features/santri/actions/students.actions";
import { validateRegionalData } from "@/features/santri/actions/validate-regional.action";
import type { Student } from "@/features/santri/domain/student.model";
import type { StudentDTO } from "@/features/santri/api/students.dto";

// ─── Types ────────────────────────────────────────────────────────────────────

type RowIssue = {
  index: number;
  idApi?: string;
  nis?: string | null;
  name?: string;
  dormitory?: string;
  missing: string[];
  level: "invalid" | "skip";
};

type PreviewSummary = {
  total: number;
  valid: number;
  invalid: RowIssue[];
  skipped: RowIssue[];
  dupIdApi: string[];
  dupNis: string[];
  statusCount: Record<string, number>;
  genderCount: Record<string, number>;
  noRegional: number;
};

type Phase = "idle" | "loading" | "preview" | "importing" | "done";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function analyzeStudents(students: Student[]): PreviewSummary {
  const dup = <T,>(arr: T[]) => arr.filter((v, i) => arr.indexOf(v) !== i);

  const idApis = students.map((s) => s.idApi?.trim()).filter(Boolean) as string[];
  const niss = students.map((s) => s.nis?.trim()).filter(Boolean) as string[];

  const dupIdApi = Array.from(new Set(dup(idApis)));
  const dupNis = Array.from(new Set(dup(niss)));

  const invalid: RowIssue[] = [];
  const skipped: RowIssue[] = [];

  students.forEach((s, i) => {
    const missing: string[] = [];
    if (!s.idApi) missing.push("idApi");
    if (!s.nis) missing.push("nis");
    if (!s.name) missing.push("name");
    if (!s.gender) missing.push("gender");
    if (s.status === null || s.status === undefined) missing.push("status");
    if (!s.ttl) missing.push("ttl");
    if (!s.dormitory) missing.push("dormitory");
    if (!s.fullAddress) missing.push("fullAddress");

    if (!missing.length) return;

    const shouldSkip = missing.includes("nis") || missing.includes("dormitory");
    const row: RowIssue = {
      index: i,
      idApi: s.idApi,
      nis: s.nis,
      name: s.name,
      dormitory: s.dormitory,
      missing,
      level: shouldSkip ? "skip" : "invalid",
    };
    if (shouldSkip) skipped.push(row);
    else invalid.push(row);
  });

  const statusCount = students.reduce<Record<string, number>>((acc, s) => {
    const key = s.status === true ? "Aktif" : "Nonaktif";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const genderCount = students.reduce<Record<string, number>>((acc, s) => {
    const key = s.gender?.toLowerCase() === "laki-laki" ? "L" : "P";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const noRegional = students.filter((s) => !s.provinceId && !s.regencyId).length;

  const problemIndices = new Set([...invalid.map((r) => r.index), ...skipped.map((r) => r.index)]);
  const valid = students.length - problemIndices.size;

  return { total: students.length, valid, invalid, skipped, dupIdApi, dupNis, statusCount, genderCount, noRegional };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, variant = "default" }: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const colors = {
    default: "border",
    success: "border border-emerald-500/30 bg-emerald-500/5",
    warning: "border border-amber-500/30 bg-amber-500/5",
    danger: "border border-destructive/30 bg-destructive/5",
  };
  return (
    <div className={`rounded-lg p-4 ${colors[variant]}`}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

type Tab = "all" | "invalid" | "skipped" | "dup";

function PreviewTable({ students, summary, tab, setTab }: {
  students: Student[];
  summary: PreviewSummary;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const invalidSet = new Set(summary.invalid.map((r) => r.index));
  const skippedSet = new Set(summary.skipped.map((r) => r.index));
  const dupIdApiSet = new Set(summary.dupIdApi);
  const dupNisSet = new Set(summary.dupNis);

  const getIssue = (s: Student, i: number): string => {
    const parts: string[] = [];
    if (invalidSet.has(i)) {
      const row = summary.invalid.find((r) => r.index === i);
      parts.push(`Field wajib kosong: ${row?.missing.join(", ")}`);
    }
    if (skippedSet.has(i)) {
      const row = summary.skipped.find((r) => r.index === i);
      parts.push(`Akan dilewati: ${row?.missing.join(", ")} kosong`);
    }
    if (dupIdApiSet.has(s.idApi)) parts.push("idApi duplikat");
    if (dupNisSet.has(s.nis ?? "")) parts.push("NIS duplikat");
    return parts.join(" • ");
  };

  const rows = (() => {
    switch (tab) {
      case "invalid": return students.filter((_, i) => invalidSet.has(i));
      case "skipped": return students.filter((_, i) => skippedSet.has(i));
      case "dup": return students.filter((s) => dupIdApiSet.has(s.idApi) || dupNisSet.has(s.nis ?? ""));
      default: return students;
    }
  })();

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "Semua", count: students.length },
    { key: "invalid", label: "Invalid", count: summary.invalid.length },
    { key: "skipped", label: "Dilewati", count: summary.skipped.length },
    { key: "dup", label: "Duplikat", count: summary.dupIdApi.length + summary.dupNis.length },
  ];

  return (
    <div className="rounded-lg border">
      {/* Tab bar */}
      <div className="flex border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <Badge variant={t.count > 0 && t.key !== "all" ? "destructive" : "secondary"} className="text-xs">
              {t.count}
            </Badge>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="w-28">NIS</TableHead>
              <TableHead className="min-w-[180px]">Nama</TableHead>
              <TableHead className="w-10">L/P</TableHead>
              <TableHead className="w-28">Asrama</TableHead>
              <TableHead className="w-20">Status</TableHead>
              <TableHead className="w-24">Provinsi</TableHead>
              <TableHead className="w-32">Kabupaten</TableHead>
              <TableHead className="min-w-[200px] text-destructive">Masalah</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Tidak ada data.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s, idx) => {
                const origIdx = students.indexOf(s);
                const issue = getIssue(s, origIdx);
                const isInvalid = invalidSet.has(origIdx);
                const isSkipped = skippedSet.has(origIdx);
                return (
                  <TableRow
                    key={s.idApi ?? idx}
                    className={isInvalid ? "bg-destructive/5" : isSkipped ? "bg-amber-500/5" : ""}
                  >
                    <TableCell className="text-muted-foreground text-xs">{origIdx + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{s.nis || <span className="text-destructive">—</span>}</TableCell>
                    <TableCell className="font-medium">{s.name || <span className="text-destructive italic">kosong</span>}</TableCell>
                    <TableCell>{s.gender?.toLowerCase() === "laki-laki" ? "L" : "P"}</TableCell>
                    <TableCell className="text-xs">{s.dormitory || <span className="text-destructive">—</span>}</TableCell>
                    <TableCell>
                      <Badge variant={s.status ? "secondary" : "outline"} className="text-xs">
                        {s.status ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{s.provinceId ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-xs">{s.regencyId ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-xs text-destructive">{issue || null}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <div className="border-t px-4 py-2 text-xs text-muted-foreground">
        Menampilkan {rows.length} dari {students.length} baris
      </div>
    </div>
  );
}

function ImportResultView({ result }: { result: BulkImportResult }) {
  const hasErrors = result.errors.length > 0;
  const hasSkipped = result.skippedRows.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {hasErrors ? (
          <XCircle className="h-6 w-6 text-destructive" />
        ) : (
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        )}
        <div>
          <h2 className="text-lg font-semibold">
            {hasErrors ? "Import selesai dengan error" : "Import berhasil"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total" value={result.total} />
        <StatCard label="Diproses" value={result.processed} variant="success" />
        <StatCard label="Inserted" value={result.inserted} variant="success" sub="Data baru" />
        <StatCard label="Updated" value={result.updated} variant="success" sub="Data diperbarui" />
        <StatCard label="Dilewati" value={result.skipped} variant="warning" sub="NIS/Asrama kosong" />
        <StatCard label="Gagal" value={result.failed} variant={result.failed > 0 ? "danger" : "default"} />
      </div>

      {/* Error table */}
      {hasErrors && (
        <div className="space-y-2">
          <h3 className="font-semibold text-destructive">
            Detail Error ({result.errors.length} baris)
          </h3>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Baris</TableHead>
                  <TableHead className="w-28">NIS</TableHead>
                  <TableHead className="w-36">ID API</TableHead>
                  <TableHead>Pesan Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.errors.map((e, i) => (
                  <TableRow key={i} className="bg-destructive/5">
                    <TableCell className="text-muted-foreground">{e.index + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{e.nis ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{e.idApi ?? "—"}</TableCell>
                    <TableCell className="text-destructive text-sm">{e.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Skipped table */}
      {hasSkipped && (
        <div className="space-y-2">
          <h3 className="font-semibold text-amber-600">
            Baris Dilewati ({result.skippedRows.length} baris)
          </h3>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Baris</TableHead>
                  <TableHead className="w-28">NIS</TableHead>
                  <TableHead className="w-36">ID API</TableHead>
                  <TableHead>Alasan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.skippedRows.map((r, i) => (
                  <TableRow key={i} className="bg-amber-500/5">
                    <TableCell className="text-muted-foreground">{r.index + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{r.nis ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.idApi ?? "—"}</TableCell>
                    <TableCell className="text-amber-700 text-sm">{r.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button asChild variant="outline">
          <Link href="/santri">← Kembali ke Data Santri</Link>
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ImportPreviewPage() {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [students, setStudents] = React.useState<Student[]>([]);
  const [dtos, setDtos] = React.useState<StudentDTO[]>([]);
  const [summary, setSummary] = React.useState<PreviewSummary | null>(null);
  const [tab, setTab] = React.useState<Tab>("all");
  const [importResult, setImportResult] = React.useState<BulkImportResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Regional validation
  const [validatingRegional, setValidatingRegional] = React.useState(false);
  const [regionalStats, setRegionalStats] = React.useState<{
    total: number; successCount: number; failedCount: number; errors: string[];
  } | null>(null);

  const handleFetch = async () => {
    setPhase("loading");
    setError(null);
    try {
      const { students: s, dtos: d } = await getStudentDTOs();
      setStudents(s);
      setDtos(d);
      setSummary(analyzeStudents(s));
      setPhase("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengambil data dari API.");
      setPhase("idle");
    }
  };

  const handleValidateRegional = async () => {
    if (!dtos.length) return;
    setValidatingRegional(true);
    try {
      const needsValidation = dtos.filter(
        (dto) => !dto.alamat_new?.provinsi?.id && dto.alamat?.provinsi?.nama,
      );
      if (needsValidation.length === 0) {
        setRegionalStats({ total: 0, successCount: 0, failedCount: 0, errors: ["Semua data sudah memiliki alamat_new."] });
        return;
      }
      const inputs = needsValidation.map((dto) => ({
        idApi: dto.id_anggota,
        provinceName: dto.alamat?.provinsi?.nama ?? null,
        regencyName: dto.alamat?.kabupaten?.nama ?? null,
      }));
      const result = await validateRegionalData(inputs);
      setRegionalStats({
        total: result.total,
        successCount: result.successCount,
        failedCount: result.failedCount,
        errors: result.errors,
      });
      if (result.success) {
        const validationMap = new Map(result.validationEntries);
        const updatedStudents = students.map((s) => {
          const validated = validationMap.get(s.idApi);
          if (!validated || (!validated.provinceId && !validated.regencyId)) return s;
          return { ...s, provinceId: validated.provinceId ?? s.provinceId, regencyId: validated.regencyId ?? s.regencyId };
        });
        setStudents(updatedStudents);
        setSummary(analyzeStudents(updatedStudents));
      }
    } catch (e) {
      setRegionalStats({ total: 0, successCount: 0, failedCount: 0, errors: [e instanceof Error ? e.message : "Validasi gagal."] });
    } finally {
      setValidatingRegional(false);
    }
  };

  const handleImport = async () => {
    if (!students.length) return;
    setPhase("importing");
    try {
      const toImport = students.filter((s): s is typeof s & { nis: string } => s.nis != null);
      const result = await bulkUpsertStudents(toImport);
      setImportResult(result);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import gagal.");
      setPhase("preview");
    }
  };

  const canImport = summary && summary.invalid.length === 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/santri">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Import Data Santri</h1>
          <p className="text-sm text-muted-foreground">
            Preview dan konfirmasi data dari API sebelum disimpan ke database
          </p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Terjadi kesalahan</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Phase: idle */}
      {phase === "idle" && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 gap-4">
          <Download className="h-10 w-10 text-muted-foreground" />
          <div className="text-center">
            <p className="font-medium">Ambil data dari API</p>
            <p className="text-sm text-muted-foreground mt-1">
              Data akan diambil dari API eksternal dan ditampilkan untuk direview sebelum diimport.
            </p>
          </div>
          <Button onClick={handleFetch} size="lg">
            <Download className="mr-2 h-4 w-4" />
            Ambil Data dari API
          </Button>
        </div>
      )}

      {/* Phase: loading */}
      {phase === "loading" && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Mengambil data dari API, mohon tunggu...</p>
        </div>
      )}

      {/* Phase: preview */}
      {(phase === "preview" || phase === "importing") && summary && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <StatCard label="Total" value={summary.total} />
            <StatCard label="Valid" value={summary.valid} variant="success" />
            <StatCard label="Invalid" value={summary.invalid.length} variant={summary.invalid.length > 0 ? "danger" : "default"} sub="Blokir import" />
            <StatCard label="Dilewati" value={summary.skipped.length} variant={summary.skipped.length > 0 ? "warning" : "default"} sub="NIS/Asrama kosong" />
            <StatCard label="Dup idApi" value={summary.dupIdApi.length} variant={summary.dupIdApi.length > 0 ? "warning" : "default"} />
            <StatCard label="Dup NIS" value={summary.dupNis.length} variant={summary.dupNis.length > 0 ? "warning" : "default"} />
            <StatCard label="Tanpa Regional" value={summary.noRegional} variant={summary.noRegional > 0 ? "warning" : "default"} sub="Provinsi & Kab kosong" />
          </div>

          {/* Distribusi */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-4 text-sm">
              <div className="font-medium mb-2">Distribusi Status</div>
              {Object.entries(summary.statusCount).map(([k, v]) => (
                <div key={k} className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border p-4 text-sm">
              <div className="font-medium mb-2">Distribusi Gender</div>
              {Object.entries(summary.genderCount).map(([k, v]) => (
                <div key={k} className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Regional validation */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Validasi Data Regional</div>
                <div className="text-sm text-muted-foreground">
                  Cocokkan nama provinsi/kabupaten lama ke ID database untuk santri tanpa alamat_new
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleValidateRegional}
                disabled={validatingRegional}
              >
                {validatingRegional ? (
                  <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Memvalidasi...</>
                ) : (
                  "Validasi Regional"
                )}
              </Button>
            </div>
            {regionalStats && (
              <div className={`rounded-md p-3 text-sm ${regionalStats.failedCount > 0 ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
                <div className="font-medium">
                  Hasil: {regionalStats.successCount}/{regionalStats.total} berhasil dicocokkan
                  {regionalStats.failedCount > 0 && `, ${regionalStats.failedCount} gagal`}
                </div>
                {regionalStats.errors.length > 0 && (
                  <ul className="mt-1 list-disc list-inside text-muted-foreground space-y-0.5">
                    {regionalStats.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                    {regionalStats.errors.length > 5 && <li>...dan {regionalStats.errors.length - 5} lainnya</li>}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Invalid warning */}
          {summary.invalid.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Import diblokir — {summary.invalid.length} baris invalid</AlertTitle>
              <AlertDescription>
                Terdapat baris dengan field wajib yang kosong (selain NIS/Asrama). Import tidak dapat dilanjutkan sampai data diperbaiki di sumber.
              </AlertDescription>
            </Alert>
          )}

          {/* Data table */}
          <PreviewTable students={students} summary={summary} tab={tab} setTab={setTab} />

          {/* Actions */}
          <div className="flex items-center justify-between border-t pt-4">
            <Button asChild variant="outline">
              <Link href="/santri">Batal</Link>
            </Button>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleFetch} disabled={phase === "importing"}>
                Refresh Data
              </Button>
              <Button
                onClick={handleImport}
                disabled={!canImport || phase === "importing"}
              >
                {phase === "importing" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mengimport...</>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Lanjutkan Import ({summary.valid} data valid)
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Phase: done */}
      {phase === "done" && importResult && (
        <ImportResultView result={importResult} />
      )}
    </div>
  );
}

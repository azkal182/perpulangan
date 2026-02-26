"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  importSingleStudentByIdAction,
  previewSingleStudentImportByIdAction,
  type SingleStudentImportPreview,
} from "../actions/import-single-student.action";

type ImportSingleStudentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

const ADDRESS_SOURCE_LABEL: Record<SingleStudentImportPreview["addressSource"], string> = {
  alamat_new: "Alamat baru (alamat_new)",
  fallback_validation: "Fallback validasi regional",
  none: "Belum tervalidasi",
};

export function ImportSingleStudentDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportSingleStudentDialogProps) {
  const [idApi, setIdApi] = useState("");
  const [preview, setPreview] = useState<SingleStudentImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);

  const trimmedId = idApi.trim();
  const hasBlockingIssues = (preview?.blockingIssues.length ?? 0) > 0;

  function resetState() {
    setIdApi("");
    setPreview(null);
    setError(null);
    setPreviewing(false);
    setImporting(false);
  }

  function closeDialog() {
    resetState();
    onOpenChange(false);
  }

  async function handlePreview() {
    if (!trimmedId) {
      setError("ID anggota wajib diisi.");
      return;
    }

    setPreviewing(true);
    setError(null);
    setPreview(null);

    try {
      const result = await previewSingleStudentImportByIdAction(trimmedId);
      if (!result.success || !result.data) {
        const message = result.error || "Data anggota tidak ditemukan";
        setError(message);
        toast.error(message);
        return;
      }

      setPreview(result.data);
      if (result.data.blockingIssues.length > 0) {
        toast.warning("Data ditemukan, tetapi ada field wajib yang kosong.");
      }
    } catch {
      setError("Terjadi kesalahan saat mengambil data.");
      toast.error("Terjadi kesalahan saat mengambil data.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport() {
    if (!trimmedId) {
      setError("ID anggota wajib diisi.");
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const result = await importSingleStudentByIdAction(trimmedId);

      if (!result.success) {
        const message = result.error || "Import data santri gagal";
        setError(message);
        toast.error(message);
        return;
      }

      const inserted = result.inserted ?? 0;
      const updated = result.updated ?? 0;
      const skipped = result.skipped ?? 0;
      const summary = `Insert: ${inserted}, Update: ${updated}, Skip: ${skipped}`;

      toast.success(`Import santri berhasil. ${summary}`);
      closeDialog();
      onSuccess?.();
    } catch {
      setError("Terjadi kesalahan saat import data.");
      toast.error("Terjadi kesalahan saat import data.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resetState();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Single Santri</DialogTitle>
          <DialogDescription>
            Input ID anggota untuk mengambil data dari API, validasi regional, lalu import ke database.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="single-import-id">ID Anggota</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="single-import-id"
                placeholder="Contoh: A2100255"
                value={idApi}
                onChange={(event) => {
                  setIdApi(event.target.value);
                  setPreview(null);
                  setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (!previewing && !importing) {
                      void handlePreview();
                    }
                  }
                }}
                disabled={previewing || importing}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handlePreview}
                disabled={previewing || importing}
              >
                {previewing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mengecek...
                  </>
                ) : (
                  "Cek Data"
                )}
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Gagal</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {preview && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{preview.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ID: {preview.idApi} • NIS: {preview.nis || "-"}
                  </p>
                </div>
                <Badge variant={hasBlockingIssues ? "destructive" : "secondary"}>
                  {hasBlockingIssues ? "Belum Valid" : "Siap Import"}
                </Badge>
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Jenis Kelamin</p>
                  <p>{preview.gender || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Asrama</p>
                  <p>{preview.dormitory || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">TTL</p>
                  <p>{preview.ttl || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Provinsi/Kabupaten ID</p>
                  <p>
                    {preview.provinceId ?? "-"} / {preview.regencyId ?? "-"}
                  </p>
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Alamat</p>
                <p>{preview.fullAddress || "-"}</p>
                <p className="text-xs text-muted-foreground">
                  Sumber alamat: {ADDRESS_SOURCE_LABEL[preview.addressSource]}
                </p>
              </div>

              {preview.regional.needed && (
                <Alert variant={preview.regional.matched ? "default" : "destructive"}>
                  {preview.regional.matched ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {preview.regional.matched
                      ? "Validasi regional berhasil"
                      : "Validasi regional belum cocok"}
                  </AlertTitle>
                  <AlertDescription>
                    Referensi alamat lama: {preview.regional.provinceName || "-"} /{" "}
                    {preview.regional.regencyName || "-"}
                  </AlertDescription>
                </Alert>
              )}

              {preview.blockingIssues.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Field Wajib Kosong</AlertTitle>
                  <AlertDescription>
                    {preview.blockingIssues.join(", ")}.
                  </AlertDescription>
                </Alert>
              )}

              {preview.skippedIssues.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Catatan</AlertTitle>
                  <AlertDescription>
                    {preview.skippedIssues.join(", ")} kosong dan akan diperlakukan sebagai data skip.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={closeDialog}
            disabled={previewing || importing}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={!preview || hasBlockingIssues || previewing || importing}
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengimport...
              </>
            ) : (
              "Import Sekarang"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

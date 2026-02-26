"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Autocomplete } from "@/components/AutoComplete";
import { createManualStudent } from "../actions/create-manual-student.action";
import {
  getProvinces,
  getRegenciesByProvince,
  type ProvinceOption,
  type RegencyOption,
} from "../actions/regional.action";

interface AddManualStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const EMPTY_FORM = {
  name: "",
  gender: "" as "L" | "P" | "",
  ttl: "",
  dormitory: "",
  fullAddress: "",
  source: "" as "DAFU" | "MUSA" | "SPBP" | "",
  parrentPhone: "",
  status: true,
};

export function AddManualStudentDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddManualStudentDialogProps) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Province & Regency
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [regencies, setRegencies] = useState<RegencyOption[]>([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(
    null,
  );
  const [selectedRegencyId, setSelectedRegencyId] = useState<number | null>(
    null,
  );
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingRegencies, setLoadingRegencies] = useState(false);

  // Load provinces on open
  useEffect(() => {
    if (!open) return;
    setLoadingProvinces(true);
    getProvinces()
      .then(setProvinces)
      .finally(() => setLoadingProvinces(false));
  }, [open]);

  // Load regencies when province changes
  useEffect(() => {
    if (!selectedProvinceId) {
      setRegencies([]);
      setSelectedRegencyId(null);
      return;
    }
    setLoadingRegencies(true);
    setSelectedRegencyId(null);
    getRegenciesByProvince(selectedProvinceId)
      .then(setRegencies)
      .finally(() => setLoadingRegencies(false));
  }, [selectedProvinceId]);

  function handleChange(
    field: keyof typeof EMPTY_FORM,
    value: string | boolean,
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setError(null);
    setSelectedProvinceId(null);
    setSelectedRegencyId(null);
    setRegencies([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.gender || !form.source) {
      setError("Jenis kelamin dan sumber data wajib dipilih");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await createManualStudent({
        name: form.name,
        gender: form.gender as "L" | "P",
        ttl: form.ttl || undefined,
        dormitory: form.dormitory || undefined,
        fullAddress: form.fullAddress || undefined,
        source: form.source as "DAFU" | "MUSA" | "SPBP",
        parrentPhone: form.parrentPhone || undefined,
        status: form.status,
        provinceId: selectedProvinceId ?? undefined,
        regencyId: selectedRegencyId ?? undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch {
      setError("Terjadi kesalahan, coba lagi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Santri Manual</DialogTitle>
          <DialogDescription>
            Data santri yang tidak berasal dari API (DAFU / MUSA / SPBP). NIS
            dan ID API tidak diperlukan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Nama */}
          <div className="space-y-1.5">
            <Label htmlFor="ms-name">Nama Lengkap *</Label>
            <Input
              id="ms-name"
              placeholder="Nama lengkap santri"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </div>

          {/* Jenis Kelamin & Sumber */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ms-gender">Jenis Kelamin *</Label>
              <Select
                value={form.gender}
                onValueChange={(v) => handleChange("gender", v)}
              >
                <SelectTrigger id="ms-gender">
                  <SelectValue placeholder="Pilih..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Laki-laki</SelectItem>
                  <SelectItem value="P">Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ms-source">Sumber Data *</Label>
              <Select
                value={form.source}
                onValueChange={(v) => handleChange("source", v)}
              >
                <SelectTrigger id="ms-source">
                  <SelectValue placeholder="Pilih..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAFU">DAFU</SelectItem>
                  <SelectItem value="DAFU">DAFU</SelectItem>
                  <SelectItem value="MUSA">SPBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* TTL */}
          <div className="space-y-1.5">
            <Label htmlFor="ms-ttl">Tempat, Tanggal Lahir</Label>
            <Input
              id="ms-ttl"
              placeholder="Contoh: Surabaya, 01 Januari 2005"
              value={form.ttl}
              onChange={(e) => handleChange("ttl", e.target.value)}
            />
          </div>

          {/* Asrama */}
          <div className="space-y-1.5">
            <Label htmlFor="ms-dormitory">Asrama</Label>
            <Input
              id="ms-dormitory"
              placeholder="Nama asrama / pondok"
              value={form.dormitory}
              onChange={(e) => handleChange("dormitory", e.target.value)}
            />
          </div>

          {/* Province */}
          <div className="space-y-1.5">
            <Label>Provinsi</Label>
            <Autocomplete<ProvinceOption, "id">
              items={provinces}
              keyField="id"
              getLabel={(p) => p.name}
              value={selectedProvinceId}
              onValueChange={(v) => setSelectedProvinceId(v)}
              placeholder={loadingProvinces ? "Memuat..." : "Pilih provinsi..."}
              searchPlaceholder="Cari provinsi..."
              disabled={loadingProvinces}
            />
          </div>

          {/* Regency */}
          <div className="space-y-1.5">
            <Label>Kabupaten / Kota</Label>
            <Autocomplete<RegencyOption, "id">
              items={regencies}
              keyField="id"
              getLabel={(r) => r.label ?? r.name}
              getSearchText={(r) => `${r.label ?? ""} ${r.name}`}
              value={selectedRegencyId}
              onValueChange={(v) => setSelectedRegencyId(v)}
              placeholder={
                !selectedProvinceId
                  ? "Pilih provinsi dulu"
                  : loadingRegencies
                    ? "Memuat..."
                    : "Pilih kabupaten/kota..."
              }
              searchPlaceholder="Cari kabupaten/kota..."
              disabled={!selectedProvinceId || loadingRegencies}
            />
          </div>

          {/* Alamat */}
          <div className="space-y-1.5">
            <Label htmlFor="ms-address">Alamat Lengkap</Label>
            <Input
              id="ms-address"
              placeholder="Alamat lengkap"
              value={form.fullAddress}
              onChange={(e) => handleChange("fullAddress", e.target.value)}
            />
          </div>

          {/* No HP Wali */}
          <div className="space-y-1.5">
            <Label htmlFor="ms-phone">No. HP Wali</Label>
            <Input
              id="ms-phone"
              type="tel"
              placeholder="08xxxxxxxxxx"
              value={form.parrentPhone}
              onChange={(e) => handleChange("parrentPhone", e.target.value)}
            />
          </div>

          {/* Status */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="ms-status"
              checked={form.status}
              onChange={(e) => handleChange("status", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="ms-status" className="cursor-pointer font-normal">
              Santri aktif
            </Label>
          </div>

          {error && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

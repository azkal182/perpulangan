"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Autocomplete } from "@/components/AutoComplete";
import { updateStudentRegional } from "@/features/santri/actions/update-regional.action";

type RegionalData = {
  id: number;
  code: string;
  name: string;
  label?: string | null;
  provinceId?: number;
};

export function UpdateRegionalDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  studentNis,
  currentProvinceId,
  currentRegencyId,
  provinces = [],
  regencies = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  studentNis: string;
  currentProvinceId?: number | null;
  currentRegencyId?: number | null;
  provinces?: RegionalData[];
  regencies?: RegionalData[];
}) {
  const [selectedProvinceId, setSelectedProvinceId] = React.useState<
    number | null
  >(currentProvinceId ?? null);
  const [selectedRegencyId, setSelectedRegencyId] = React.useState<
    number | null
  >(currentRegencyId ?? null);
  const [saving, setSaving] = React.useState(false);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedProvinceId(currentProvinceId ?? null);
      setSelectedRegencyId(currentRegencyId ?? null);
    }
  }, [open, currentProvinceId, currentRegencyId]);

  // Filter regencies by selected province using provinceId (accurate)
  const filteredRegencies = React.useMemo(() => {
    if (!selectedProvinceId) return [];
    return regencies.filter((r) => r.provinceId === selectedProvinceId);
  }, [selectedProvinceId, regencies]);

  const handleProvinceChange = (id: number | null) => {
    setSelectedProvinceId(id);
    setSelectedRegencyId(null); // reset regency when province changes
  };

  const handleSave = async () => {
    if (!selectedProvinceId && !selectedRegencyId) {
      toast.error("Pilih setidaknya provinsi atau kabupaten/kota");
      return;
    }

    setSaving(true);
    try {
      const result = await updateStudentRegional({
        studentId,
        provinceId: selectedProvinceId,
        regencyId: selectedRegencyId,
      });

      if (result.success) {
        toast.success("Data regional berhasil diperbarui");
        onOpenChange(false);
      } else {
        toast.error(result.error || "Gagal memperbarui data regional");
      }
    } catch (error) {
      console.error("Failed to update regional:", error);
      toast.error("Gagal memperbarui data regional");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Data Regional</DialogTitle>
          <DialogDescription>
            Update provinsi dan kabupaten/kota untuk {studentName} (NIS:{" "}
            {studentNis})
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Province */}
          <div className="grid gap-2">
            <Label>Provinsi</Label>
            <Autocomplete
              items={provinces}
              keyField="id"
              getLabel={(p) => p.name}
              value={selectedProvinceId}
              onValueChange={handleProvinceChange}
              placeholder="Pilih provinsi..."
              searchPlaceholder="Cari provinsi..."
              emptyText="Provinsi tidak ditemukan"
            />
          </div>

          {/* Regency */}
          <div className="grid gap-2">
            <Label>Kabupaten/Kota</Label>
            <Autocomplete
              items={filteredRegencies}
              keyField="id"
              getLabel={(r) => r.label ?? r.name}
              getSearchText={(r) => `${r.label ?? ""} ${r.name}`}
              value={selectedRegencyId}
              onValueChange={setSelectedRegencyId}
              placeholder={
                selectedProvinceId
                  ? "Pilih kabupaten/kota..."
                  : "Pilih provinsi terlebih dahulu"
              }
              searchPlaceholder="Cari kabupaten/kota..."
              emptyText="Kabupaten/kota tidak ditemukan"
              disabled={!selectedProvinceId}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

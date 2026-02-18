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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateStudentRegional } from "@/features/santri/actions/update-regional.action";

type RegionalData = {
  id: number;
  code: string;
  name: string;
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
  const [provinceId, setProvinceId] = React.useState<string>(
    currentProvinceId?.toString() ?? ""
  );
  const [regencyId, setRegencyId] = React.useState<string>(
    currentRegencyId?.toString() ?? ""
  );
  const [saving, setSaving] = React.useState(false);

  // Filter regencies based on selected province
  const filteredRegencies = React.useMemo(() => {
    if (!provinceId) return [];
    
    const selectedProvince = provinces.find((p) => p.code.toString() === provinceId);
    if (!selectedProvince) return [];

    // Filter regencies that belong to the selected province
    // Regency codes start with province code (e.g., province 11 -> regencies 1101, 1102, etc.)
    return regencies.filter((r) => {
      const regencyCodeStr = r.code.toString();
      const provinceCodeStr = selectedProvince.code.toString();
      return regencyCodeStr.startsWith(provinceCodeStr);
    });
  }, [provinceId, provinces, regencies]);

  // Reset regency when province changes
  React.useEffect(() => {
    setRegencyId("");
  }, [provinceId]);

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setProvinceId(currentProvinceId?.toString() ?? "");
      setRegencyId(currentRegencyId?.toString() ?? "");
    }
  }, [open, currentProvinceId, currentRegencyId]);

  const handleSave = async () => {
    if (!provinceId && !regencyId) {
      toast.error("Pilih setidaknya provinsi atau kabupaten/kota");
      return;
    }

    setSaving(true);
    try {
      const result = await updateStudentRegional({
        studentId,
        provinceId: provinceId ? parseInt(provinceId, 10) : null,
        regencyId: regencyId ? parseInt(regencyId, 10) : null,
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
            Update provinsi dan kabupaten/kota untuk {studentName} (NIS: {studentNis})
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="province">Provinsi</Label>
            <Select value={provinceId} onValueChange={setProvinceId}>
              <SelectTrigger id="province">
                <SelectValue placeholder="Pilih provinsi..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">-- Kosongkan --</SelectItem>
                {provinces.map((prov) => (
                  <SelectItem key={prov.id} value={prov.code.toString()}>
                    {prov.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="regency">Kabupaten/Kota</Label>
            <Select
              value={regencyId}
              onValueChange={setRegencyId}
              disabled={!provinceId}
            >
              <SelectTrigger id="regency">
                <SelectValue placeholder="Pilih kabupaten/kota..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">-- Kosongkan --</SelectItem>
                {filteredRegencies.map((reg) => (
                  <SelectItem key={reg.id} value={reg.code.toString()}>
                    {reg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

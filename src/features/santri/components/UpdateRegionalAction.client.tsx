"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { UpdateRegionalDialog } from "./UpdateRegionalDialog";

export function UpdateRegionalAction({
  studentId,
  studentName,
  studentNis,
  currentProvinceId,
  currentRegencyId,
  currentDistrictId,
  provinces = [],
  regencies = [],
}: {
  studentId: string;
  studentName: string;
  studentNis: string;
  currentProvinceId?: number | null;
  currentRegencyId?: number | null;
  currentDistrictId?: number | null;
  provinces?: Array<{ id: number; code: string; name: string }>;
  regencies?: Array<{ id: number; code: string; name: string; label?: string | null; provinceId: number }>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <DropdownMenuItem onClick={() => setOpen(true)} onSelect={(e) => e.preventDefault()}>
        <MapPin className="mr-2 h-4 w-4" />
        Update Regional
      </DropdownMenuItem>
      <UpdateRegionalDialog
        open={open}
        onOpenChange={setOpen}
        studentId={studentId}
        studentName={studentName}
        studentNis={studentNis}
        currentProvinceId={currentProvinceId}
        currentRegencyId={currentRegencyId}
        currentDistrictId={currentDistrictId}
        provinces={provinces}
        regencies={regencies}
      />
    </>
  );
}

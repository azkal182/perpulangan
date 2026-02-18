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
  provinces = [],
  regencies = [],
}: {
  studentId: string;
  studentName: string;
  studentNis: string;
  currentProvinceId?: number | null;
  currentRegencyId?: number | null;
  provinces?: Array<{ id: number; code: string; name: string }>;
  regencies?: Array<{ id: number; code: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <DropdownMenuItem onClick={() => setOpen(true)}>
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
        provinces={provinces}
        regencies={regencies}
      />
    </>
  );
}

"use client";

import { useState } from "react";
import { MoreVertical, Edit2, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditStudentDialog } from "./EditStudentDialog";
import { DeleteStudentDialog } from "./DeleteStudentDialog";
import { DetailStudentDialog } from "./DetailStudentDialog";
import { UpdateRegionalAction } from "./UpdateRegionalAction.client";
import { useRouter } from "next/navigation";

interface SantriRowActionsProps {
  student: {
    id: string;
    name: string;
    nis: string | null;
    provinceId: number | null;
    regencyId: number | null;
    districtId: number | null;
  };
  provinces: Array<{ id: number; code: string; name: string }>;
  regencies: Array<{ id: number; code: string; name: string; label?: string | null; provinceId: number }>;
}

export function SantriRowActions({ student, provinces, regencies }: SantriRowActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Aksi"
            className="h-8 w-8"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setDetailOpen(true)}>
            <Eye className="mr-2 h-4 w-4" />
            Detail
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <UpdateRegionalAction
            studentId={student.id}
            studentName={student.name}
            studentNis={student.nis ?? ""}
            currentProvinceId={student.provinceId}
            currentRegencyId={student.regencyId}
            currentDistrictId={student.districtId}
            provinces={provinces}
            regencies={regencies}
          />
          <DropdownMenuItem 
            className="text-destructive focus:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Hapus
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DetailStudentDialog 
        open={detailOpen}
        onOpenChange={setDetailOpen}
        studentId={student.id}
      />

      <EditStudentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        studentId={student.id}
        onSuccess={handleSuccess}
      />

      <DeleteStudentDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        studentId={student.id}
        studentName={student.name}
        onSuccess={handleSuccess}
      />
    </>
  );
}

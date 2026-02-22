"use client";

import * as React from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatRupiah } from "../lib/format";
import type { DropPoint, Korda, Korwil } from "../types";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";

type Props = {
  item: DropPoint;
  korda: Korda | undefined;
  korwil: Korwil | undefined;
  onEdit: (item: DropPoint) => void;
  onDelete: (id: string) => void;
};

export function DropPointRow({ item, korda, korwil, onEdit, onDelete }: Props) {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{item.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {korwil?.name ?? "—"} • {korda?.name ?? "—"}
        </div>
        <div className="pt-2 text-sm font-semibold sm:hidden">
          {formatRupiah(item.price)}
        </div>
      </div>

      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        <div className="text-sm font-semibold">{formatRupiah(item.price)}</div>

        <Button type="button" variant="outline" size="sm" onClick={() => onEdit(item)}>
          Edit
        </Button>

        <ConfirmDeleteButton
          title="Hapus titik turun?"
          description={
            <>
              Titik turun <b>{item.name}</b> akan dihapus.
            </>
          }
          onConfirm={() => onDelete(item.id)}
        />
      </div>

      <div className="shrink-0 sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Aksi titik turun</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onEdit(item);
              }}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={(event) => {
                event.preventDefault();
                setDeleteDialogOpen(true);
              }}
            >
              Hapus
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus titik turun?</AlertDialogTitle>
            <AlertDialogDescription>
              Titik turun <b>{item.name}</b> akan dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Batal</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={() => {
                onDelete(item.id);
                setDeleteDialogOpen(false);
              }}
            >
              Ya, hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

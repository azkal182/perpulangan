"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
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
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0">
        <div className="font-medium truncate">{item.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {korwil?.name ?? "—"} • {korda?.name ?? "—"}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
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
    </div>
  );
}

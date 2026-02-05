"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DropPoint, Id, Korda } from "../types";
import { clampNonNegativeInt } from "../lib/format";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  triggerLabel: string;

  kordas: Korda[];
  lockedKordaId?: Id | null; // kalau filter Korda spesifik, lock

  initial?: DropPoint | null;

  onSubmit: (payload: { kordaId: Id; name: string; price: number }) => void;
};

export function DropPointDialog({
  mode,
  open,
  onOpenChange,
  triggerLabel,
  kordas,
  lockedKordaId,
  initial,
  onSubmit,
}: Props) {
  const [kordaId, setKordaId] = React.useState<Id>(initial?.kordaId ?? lockedKordaId ?? (kordas[0]?.id ?? ""));
  const [name, setName] = React.useState(initial?.name ?? "");
  const [priceStr, setPriceStr] = React.useState(initial ? String(initial.price) : "");

  React.useEffect(() => {
    // saat buka dialog edit/create, sync state
    if (!open) return;
    setKordaId(initial?.kordaId ?? lockedKordaId ?? (kordas[0]?.id ?? ""));
    setName(initial?.name ?? "");
    setPriceStr(initial ? String(initial.price) : "");
  }, [open, initial, lockedKordaId, kordas]);

  const effectiveLocked = lockedKordaId && lockedKordaId !== "all";

  const price = clampNonNegativeInt(Number(priceStr.replace(/[^\d]/g, "")));
  const canSubmit = Boolean(kordaId) && name.trim().length > 0 && Number.isFinite(price);

  function submit() {
    if (!canSubmit) return;
    onSubmit({ kordaId, name: name.trim(), price });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Tambah Titik Turun" : "Edit Titik Turun"}</DialogTitle>
          <DialogDescription>Isi nama titik turun dan harga (IDR).</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-medium">Korda</div>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={kordaId}
              onChange={(e) => setKordaId(e.target.value)}
              disabled={Boolean(effectiveLocked)}
            >
              {kordas.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
            {effectiveLocked ? (
              <div className="text-xs text-muted-foreground">Korda dikunci mengikuti filter.</div>
            ) : null}
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Nama Titik Turun</div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Turun Tegal Kota"
            />
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Harga (IDR)</div>
            <Input
              inputMode="numeric"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              placeholder="Contoh: 150000"
            />
            <div className="text-xs text-muted-foreground">Disimpan sebagai number (tanpa format).</div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

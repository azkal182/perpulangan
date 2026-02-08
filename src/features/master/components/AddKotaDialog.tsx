"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { searchRegency } from "../actions/regency.action";
import type { RegencyOption } from "../types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  triggerLabel: string;
  title: string;
  description?: string;
  disabled?: boolean;
  currentKordaId?: string | null;
  usedRegencyIds?: number[];
  onSubmit: (regencyId: number) => Promise<boolean> | boolean;
};

export function AddKotaDialog({
  open,
  onOpenChange,
  triggerLabel,
  title,
  description,
  disabled,
  currentKordaId,
  usedRegencyIds,
  onSubmit,
}: Props) {
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState<RegencyOption[]>([]);
  const [selected, setSelected] = React.useState<RegencyOption | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const usedSet = React.useMemo(
    () => new Set(usedRegencyIds ?? []),
    [usedRegencyIds],
  );

  const filteredOptions = React.useMemo(
    () => options.filter((o) => !usedSet.has(o.value)),
    [options, usedSet],
  );

  const loadOptions = React.useCallback(
    async (q: string) => {
      try {
        setLoading(true);
        const res = await searchRegency({
          q: q.trim() || undefined,
          limit: 50,
        });
        if (!res.success) {
          setOptions([]);
          return;
        }
        setOptions(res.data);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [searchRegency],
  );

  React.useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      void loadOptions(query);
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open, loadOptions]);

  React.useEffect(() => {
    if (open) return;
    setQuery("");
    setOptions([]);
    setSelected(null);
    setLoading(false);
    setSubmitting(false);
  }, [open]);

  const emptyLabel = loading
    ? "Memuat kota..."
    : options.length > 0 && filteredOptions.length === 0
      ? "Semua kota sudah dipilih untuk korda ini."
    : query.trim()
        ? "Tidak ada hasil."
        : "Ketik untuk mencari kota.";

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const ok = await onSubmit(selected.value);
      if (ok) onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-sm font-medium">Pilih Kota (Regency)</div>
          <Combobox<RegencyOption>
            items={filteredOptions}
            value={selected}
            onValueChange={(value) => setSelected(value ?? null)}
            onInputValueChange={(value) => setQuery(value)}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => String(item.value)}
            isItemEqualToValue={(item, value) =>
              value ? item.value === value.value : false
            }
            disabled={disabled}
          >
            <ComboboxInput
              placeholder="Cari kota..."
              showClear
              autoFocus
              disabled={disabled}
            />
            <ComboboxContent>
              <ComboboxList>
                <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
                <ComboboxCollection>
                  {(opt) => {
                    const assignedOther =
                      opt.kordaId && opt.kordaId !== currentKordaId;
                    const assignedCurrent =
                      opt.kordaId && opt.kordaId === currentKordaId;

                    return (
                      <ComboboxItem
                        key={opt.value}
                        value={opt}
                        disabled={assignedOther || assignedCurrent}
                      >
                        <div className="flex flex-col">
                          <span>{opt.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {opt.provinceName ?? "—"}
                            {assignedOther && opt.kordaName
                              ? ` • Korda: ${opt.kordaName}`
                              : ""}
                            {assignedCurrent ? " • Sudah terdaftar" : ""}
                          </span>
                        </div>
                      </ComboboxItem>
                    );
                  }}
                </ComboboxCollection>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !selected || disabled}
          >
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { searchRegency } from "../actions/regency.action";
import { searchProvince } from "../actions/province.action";
import type { ProvinceOption, RegencyOption } from "../types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  triggerLabel: string;
  title: string;
  description?: string;
  disabled?: boolean;
  currentKordaId?: string | null;
  usedRegencyIds?: number[];
  onSubmit: (regencyIds: number[]) => Promise<boolean> | boolean;
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
  const [provinceQuery, setProvinceQuery] = React.useState("");
  const [provinceOptions, setProvinceOptions] =
    React.useState<ProvinceOption[]>([]);
  const [selectedProvince, setSelectedProvince] =
    React.useState<ProvinceOption | null>(null);
  const [loadingProvince, setLoadingProvince] = React.useState(false);

  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState<RegencyOption[]>([]);
  const [selected, setSelected] = React.useState<RegencyOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const regencyAnchor = useComboboxAnchor();

  const usedSet = React.useMemo(
    () => new Set(usedRegencyIds ?? []),
    [usedRegencyIds],
  );

  const filteredOptions = React.useMemo(
    () => options.filter((o) => !usedSet.has(o.value)),
    [options, usedSet],
  );

  const loadProvinceOptions = React.useCallback(
    async (q: string) => {
      try {
        setLoadingProvince(true);
        const res = await searchProvince({
          q: q.trim() || undefined,
          limit: 50,
        });
        if (!res.success) {
          setProvinceOptions([]);
          return;
        }
        setProvinceOptions(res.data);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        setProvinceOptions([]);
      } finally {
        setLoadingProvince(false);
      }
    },
    [searchProvince],
  );

  const loadRegencyOptions = React.useCallback(
    async (q: string, provinceId: number) => {
      try {
        setLoading(true);
        const res = await searchRegency({
          q: q.trim() || undefined,
          provinceId,
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
      void loadProvinceOptions(provinceQuery);
    }, 250);
    return () => clearTimeout(handle);
  }, [provinceQuery, open, loadProvinceOptions]);

  React.useEffect(() => {
    if (!open) return;
    if (!selectedProvince) {
      setOptions([]);
      setLoading(false);
      return;
    }

    const handle = setTimeout(() => {
      void loadRegencyOptions(query, selectedProvince.value);
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open, selectedProvince, loadRegencyOptions]);

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setOptions([]);
    setSelected([]);
  }, [open, selectedProvince?.value]);

  React.useEffect(() => {
    if (usedSet.size === 0) return;
    setSelected((prev) => prev.filter((opt) => !usedSet.has(opt.value)));
  }, [usedSet]);

  React.useEffect(() => {
    if (open) return;
    setProvinceQuery("");
    setProvinceOptions([]);
    setSelectedProvince(null);
    setLoadingProvince(false);
    setQuery("");
    setOptions([]);
    setSelected([]);
    setLoading(false);
    setSubmitting(false);
  }, [open]);

  const provinceEmptyLabel = loadingProvince
    ? "Memuat provinsi..."
    : provinceQuery.trim()
      ? "Tidak ada hasil."
      : "Ketik untuk mencari provinsi.";

  const emptyLabel = !selectedProvince
    ? "Pilih provinsi terlebih dahulu."
    : loading
      ? "Memuat kota..."
      : options.length > 0 && filteredOptions.length === 0
        ? "Semua kota sudah dipilih untuk korda ini."
        : query.trim()
          ? "Tidak ada hasil."
          : "Ketik untuk mencari kota.";

  const handleSubmit = async () => {
    if (selected.length === 0) return;
    setSubmitting(true);
    try {
      const ok = await onSubmit(selected.map((item) => item.value));
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
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Pilih Provinsi</div>
            <Combobox<ProvinceOption>
              items={provinceOptions}
              value={selectedProvince}
              onValueChange={(value) => setSelectedProvince(value ?? null)}
              onInputValueChange={(value) => setProvinceQuery(value)}
              itemToStringLabel={(item) => item.label}
              itemToStringValue={(item) => String(item.value)}
              isItemEqualToValue={(item, value) =>
                value ? item.value === value.value : false
              }
              disabled={disabled}
            >
              <ComboboxInput
                placeholder="Cari provinsi..."
                showClear
                autoFocus
                disabled={disabled}
              />
              <ComboboxContent>
                <ComboboxList>
                  <ComboboxEmpty>{provinceEmptyLabel}</ComboboxEmpty>
                  <ComboboxCollection>
                    {(opt) => (
                      <ComboboxItem key={opt.value} value={opt}>
                        <span>{opt.label}</span>
                      </ComboboxItem>
                    )}
                  </ComboboxCollection>
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Pilih Kota (Regency)</div>
            <Combobox<RegencyOption, true>
              multiple
              items={filteredOptions}
              value={selected}
              onValueChange={(value) =>
                setSelected(Array.isArray(value) ? value : [])
              }
              onInputValueChange={(value) => setQuery(value)}
              itemToStringLabel={(item) => item.label}
              itemToStringValue={(item) => String(item.value)}
              isItemEqualToValue={(item, value) => item.value === value.value}
              disabled={disabled || !selectedProvince}
            >
              <div ref={regencyAnchor}>
                <ComboboxChips>
                  {selected.map((opt) => (
                    <ComboboxChip key={opt.value} value={opt}>
                      {opt.label}
                    </ComboboxChip>
                  ))}
                  <ComboboxChipsInput
                    placeholder={
                      selectedProvince ? "Cari kota..." : "Pilih provinsi dulu"
                    }
                    disabled={disabled || !selectedProvince}
                  />
                </ComboboxChips>
              </div>
              <ComboboxContent anchor={regencyAnchor}>
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
            disabled={submitting || selected.length === 0 || disabled}
          >
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

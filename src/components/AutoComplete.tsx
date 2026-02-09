/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type KeyLike = string | number;

type KeyFieldOf<T> = {
  [K in keyof T]-?: T[K] extends KeyLike ? K : never;
}[keyof T];

type CreatableConfig = {
  enabled: true;
  getCreateLabel?: (query: string) => string;
  onCreate: (query: string) => Promise<void> | void;
  isValidNewOption?: (query: string) => boolean;
};

type AsyncConfig<TItem> = {
  loadOptions: (query: string) => Promise<TItem[]>;
  debounceMs?: number;
  fetchOnEmptyQuery?: boolean;

  /** ✅ built-in cache (opsional) */
  cache?: {
    enabled?: boolean; // default false
    staleTimeMs?: number; // default 30_000
    maxEntries?: number; // default 50
    /** custom key builder, default: query.trim().toLowerCase() */
    key?: (query: string) => string;
  };
};

export type AutocompleteProps<
  TItem extends Record<string, any>,
  TKeyField extends KeyFieldOf<TItem> = Extract<
    KeyFieldOf<TItem>,
    "id"
  > extends never
    ? KeyFieldOf<TItem>
    : Extract<KeyFieldOf<TItem>, "id">,
  Multiple extends boolean | undefined = false,
> = {
  items?: TItem[];
  async?: AsyncConfig<TItem>;

  multiple?: Multiple;

  value?: Multiple extends true
    ? TItem[TKeyField][] | null
    : TItem[TKeyField] | null;
  onValueChange?: (
    value: Multiple extends true
      ? TItem[TKeyField][] | null
      : TItem[TKeyField] | null,
  ) => void;

  onSelectRaw?: (
    item: Multiple extends true ? TItem[] | null : TItem | null,
  ) => void;

  keyField?: TKeyField;
  getLabel: (item: TItem) => string;
  getSearchText?: (item: TItem) => string;

  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;

  className?: string;

  virtualized?: {
    enabled?: boolean;
    heightPx?: number;
    estimateItemPx?: number;
    overscan?: number;
  };

  creatable?: CreatableConfig;

  filterFn?: (item: TItem, query: string) => boolean;
};

function defaultKeyField<TItem extends Record<string, any>>(
  items: TItem[],
): keyof TItem | undefined {
  if (items.length > 0 && "id" in items[0]) return "id";
  const first = items[0];
  if (!first) return undefined;
  const k = Object.keys(first).find((kk) => {
    const v = (first as any)[kk];
    return typeof v === "string" || typeof v === "number";
  });
  return k as any;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function Autocomplete<
  TItem extends Record<string, any>,
  TKeyField extends KeyFieldOf<TItem> = any,
  Multiple extends boolean | undefined = false,
>(props: AutocompleteProps<TItem, TKeyField, Multiple>) {
  const {
    items: syncItems = [],
    async: asyncCfg,

    value,
    onValueChange,
    onSelectRaw,
    multiple,

    keyField,
    getLabel,
    getSearchText,

    placeholder = "Pilih data...",
    searchPlaceholder = "Cari...",
    emptyText = "Tidak ada data.",
    disabled,

    className,
    filterFn,

    virtualized,
    creatable,
  } = props;

  const isMultiple = !!multiple;

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const [asyncItems, setAsyncItems] = React.useState<TItem[]>([]);
  const [asyncError, setAsyncError] = React.useState<string | null>(null);

  const isAsync = !!asyncCfg?.loadOptions;
  const debounceMs = asyncCfg?.debounceMs ?? 250;
  const debouncedQuery = useDebouncedValue(query, debounceMs);
  const fetchOnEmptyQuery = !!asyncCfg?.fetchOnEmptyQuery;

  const effectiveItems = isAsync ? asyncItems : syncItems;
  const isIdleAsync =
    isAsync && !fetchOnEmptyQuery && query.trim().length === 0;

  const effectiveKeyField = React.useMemo(() => {
    const base = effectiveItems.length ? effectiveItems : syncItems;
    return (keyField ??
      (defaultKeyField(base) as TKeyField | undefined)) as TKeyField;
  }, [keyField, effectiveItems, syncItems]);

  const selectedValues = React.useMemo(() => {
    if (!isMultiple) return [] as TItem[TKeyField][];
    return Array.isArray(value) ? (value as TItem[TKeyField][]) : [];
  }, [isMultiple, value]);

  const valueSingle = isMultiple
    ? null
    : (value as TItem[TKeyField] | null | undefined);

  const selectedItem = React.useMemo(() => {
    if (isMultiple) return null;
    if (valueSingle == null || !effectiveKeyField) return null;
    return (
      effectiveItems.find((it) => (it as any)[effectiveKeyField] === valueSingle) ??
      null
    );
  }, [effectiveItems, valueSingle, effectiveKeyField, isMultiple]);

  const selectedItemRef = React.useRef<TItem | null>(null);

  React.useEffect(() => {
    if (isMultiple) return;
    if (!effectiveKeyField) {
      selectedItemRef.current = null;
      return;
    }

    if (selectedItem) {
      selectedItemRef.current = selectedItem;
      return;
    }

    if (valueSingle == null) {
      selectedItemRef.current = null;
      return;
    }

    const refItem = selectedItemRef.current;
    if (refItem) {
      const refKey = (refItem as any)[effectiveKeyField] as KeyLike;
      if (refKey !== valueSingle) {
        selectedItemRef.current = null;
      }
    }
  }, [selectedItem, valueSingle, effectiveKeyField, isMultiple]);

  const displayItem = React.useMemo(() => {
    if (isMultiple) return null;
    if (selectedItem) return selectedItem;
    if (valueSingle == null || !effectiveKeyField) return null;
    const refItem = selectedItemRef.current;
    if (!refItem) return null;
    const refKey = (refItem as any)[effectiveKeyField] as KeyLike;
    return refKey === valueSingle ? refItem : null;
  }, [selectedItem, valueSingle, effectiveKeyField, isMultiple]);

  const selectedItemsRef = React.useRef<Map<KeyLike, TItem>>(new Map());

  React.useEffect(() => {
    if (!isMultiple || !effectiveKeyField) {
      selectedItemsRef.current.clear();
      return;
    }

    const nextKeys = new Set(
      selectedValues.map((v) => v as unknown as KeyLike),
    );

    for (const key of Array.from(selectedItemsRef.current.keys())) {
      if (!nextKeys.has(key)) selectedItemsRef.current.delete(key);
    }

    for (const it of effectiveItems) {
      const key = (it as any)[effectiveKeyField] as KeyLike;
      if (nextKeys.has(key)) {
        selectedItemsRef.current.set(key, it);
      }
    }
  }, [isMultiple, effectiveKeyField, selectedValues, effectiveItems]);

  // ---------------- built-in cache (per-instance) ----------------
  const cacheRef = React.useRef<Map<string, { ts: number; data: TItem[] }>>(
    new Map(),
  );

  const cacheConfigRef = React.useRef<{
    enabled: boolean;
    staleTimeMs: number;
    maxEntries: number;
    key?: (query: string) => string;
  }>({
    enabled: false,
    staleTimeMs: 30_000,
    maxEntries: 50,
  });

  React.useEffect(() => {
    cacheConfigRef.current = {
      enabled: !!asyncCfg?.cache?.enabled,
      staleTimeMs: asyncCfg?.cache?.staleTimeMs ?? 30_000,
      maxEntries: asyncCfg?.cache?.maxEntries ?? 50,
      key: asyncCfg?.cache?.key,
    };
  }, [
    asyncCfg?.cache?.enabled,
    asyncCfg?.cache?.staleTimeMs,
    asyncCfg?.cache?.maxEntries,
    asyncCfg?.cache?.key,
  ]);

  const cacheGet = React.useCallback((q: string) => {
    const cfg = cacheConfigRef.current;
    if (!cfg.enabled) return null;

    const key = cfg.key ? cfg.key(q) : q.trim().toLowerCase();
    const hit = cacheRef.current.get(key);
    if (!hit) return null;

    const isFresh = Date.now() - hit.ts <= cfg.staleTimeMs;

    if (!isFresh) {
      cacheRef.current.delete(key);
      return null;
    }

    // LRU touch (naikkan jadi paling baru)
    cacheRef.current.delete(key);
    cacheRef.current.set(key, hit);

    return hit.data;
  }, []);

  const cacheSet = React.useCallback((q: string, data: TItem[]) => {
    const cfg = cacheConfigRef.current;
    if (!cfg.enabled) return;

    const key = cfg.key ? cfg.key(q) : q.trim().toLowerCase();
    cacheRef.current.set(key, { ts: Date.now(), data });

    while (cacheRef.current.size > cfg.maxEntries) {
      const oldestKey = cacheRef.current.keys().next().value as
        | string
        | undefined;
      if (!oldestKey) break;
      cacheRef.current.delete(oldestKey);
    }
  }, []);

  const cacheClear = React.useCallback(() => {
    cacheRef.current.clear();
  }, []);
  // ----------------------------------------------------------------

  const loadOptionsRef = React.useRef(asyncCfg?.loadOptions);
  React.useEffect(() => {
    loadOptionsRef.current = asyncCfg?.loadOptions;
  }, [asyncCfg?.loadOptions]);

  // -------- async fetch ----------
  React.useEffect(() => {
    if (!isAsync) return;
    if (!open) return;

    const q = debouncedQuery.trim();
    if (!fetchOnEmptyQuery && q.length === 0) {
      setAsyncItems([]);
      setAsyncError(null);
      setLoading(false);
      return;
    }

    // ✅ cache hit
    const cached = cacheGet(q);
    if (cached) {
      setAsyncItems(cached);
      setAsyncError(null);
      setLoading(false);
      return;
    }

    const loadOptions = loadOptionsRef.current;
    if (!loadOptions) return;

    let cancelled = false;
    setLoading(true);
    setAsyncError(null);

    loadOptions(q)
      .then((data) => {
        if (cancelled) return;
        const list = data ?? [];
        setAsyncItems(list);
        cacheSet(q, list); // ✅ cache store
      })
      .catch((e) => {
        if (cancelled) return;
        setAsyncItems([]);
        setAsyncError(
          typeof e?.message === "string" ? e.message : "Gagal memuat data.",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAsync, debouncedQuery, open, cacheGet, cacheSet, fetchOnEmptyQuery]);

  // -------- sync filtering ----------
  const normalizedQuery = query.trim().toLowerCase();

  const filteredItems = React.useMemo(() => {
    if (isAsync) return effectiveItems;

    if (!normalizedQuery) return effectiveItems;

    return effectiveItems.filter((it) => {
      if (filterFn) return filterFn(it, normalizedQuery);
      const text = (getSearchText?.(it) ?? getLabel(it)).toLowerCase();
      return text.includes(normalizedQuery);
    });
  }, [
    isAsync,
    effectiveItems,
    normalizedQuery,
    filterFn,
    getSearchText,
    getLabel,
  ]);

  // -------- creatable visibility ----------
  const creatableEnabled = !!creatable?.enabled;

  const canCreate = React.useMemo(() => {
    if (!creatableEnabled) return false;

    const q = query.trim();
    if (!q) return false;

    if (creatable.isValidNewOption && !creatable.isValidNewOption(q)) {
      return false;
    }

    const exists = filteredItems.some(
      (it) => getLabel(it).trim().toLowerCase() === q.toLowerCase(),
    );
    return !exists;
  }, [creatableEnabled, creatable, query, filteredItems, getLabel]);

  const createLabel = React.useMemo(() => {
    if (!creatableEnabled) return "";
    const q = query.trim();
    return creatable.getCreateLabel?.(q) ?? `Buat "${q}"`;
  }, [creatableEnabled, creatable, query]);

  const handleCreate = async () => {
    if (!creatableEnabled) return;
    const q = query.trim();
    if (!q) return;

    try {
      setLoading(true);
      await creatable.onCreate(q);

      // ✅ data berubah → invalidate built-in cache
      cacheClear();

      setOpen(false);
      setQuery("");
    } finally {
      setLoading(false);
    }
  };

  // -------- select handling ----------
  const handleSelect = (item: TItem) => {
    if (!effectiveKeyField) return;

    const key = (item as any)[effectiveKeyField] as TItem[TKeyField];
    if (isMultiple) {
      const exists = selectedValues.some((v) => v === key);
      const nextValues = exists
        ? selectedValues.filter((v) => v !== key)
        : [...selectedValues, key];

      const mapKey = key as unknown as KeyLike;
      if (exists) {
        selectedItemsRef.current.delete(mapKey);
      } else {
        selectedItemsRef.current.set(mapKey, item);
      }

      onValueChange?.(nextValues as any);
      if (onSelectRaw) {
        const nextItems = nextValues
          .map((v) => selectedItemsRef.current.get(v as any))
          .filter(Boolean) as TItem[];
        onSelectRaw(nextItems as any);
      }
      return;
    }

    const nextValue = valueSingle === key ? null : key;

    onValueChange?.(nextValue as any);
    onSelectRaw?.(nextValue === null ? null : item);

    setOpen(false);
    setQuery("");
  };

  const buttonText = React.useMemo(() => {
    if (!isMultiple) {
      return displayItem ? getLabel(displayItem) : placeholder;
    }

    if (!effectiveKeyField) return placeholder;
    if (selectedValues.length === 0) return placeholder;

    const labels = selectedValues
      .map((val) => {
        const fromList =
          effectiveItems.find(
            (it) => (it as any)[effectiveKeyField] === val,
          ) ?? selectedItemsRef.current.get(val as any);
        return fromList ? getLabel(fromList) : null;
      })
      .filter(Boolean) as string[];

    if (labels.length === 0) return `${selectedValues.length} dipilih`;
    if (labels.length <= 2 && labels.length === selectedValues.length) {
      return labels.join(", ");
    }
    const preview = labels.slice(0, 2).join(", ");
    const remaining = selectedValues.length - 2;
    return remaining > 0 ? `${preview} +${remaining}` : preview;
  }, [
    displayItem,
    effectiveItems,
    effectiveKeyField,
    getLabel,
    isMultiple,
    placeholder,
    selectedValues,
  ]);

  const hasSelection = isMultiple
    ? selectedValues.length > 0
    : !!displayItem;

  // -------- virtualization ----------
  const vCfg = {
    enabled: virtualized?.enabled ?? true,
    heightPx: virtualized?.heightPx ?? 280,
    estimateItemPx: virtualized?.estimateItemPx ?? 40,
    overscan: virtualized?.overscan ?? 6,
  };

  const parentRef = React.useRef<HTMLDivElement | null>(null);

  const totalCount = filteredItems.length + (canCreate ? 1 : 0);

  const rowVirtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => vCfg.estimateItemPx,
    overscan: vCfg.overscan,
  });

  const totalSize = rowVirtualizer.getTotalSize();
  const virtualItems = rowVirtualizer.getVirtualItems();

  const renderEmpty = !loading && filteredItems.length === 0 && !canCreate;
  const emptyStateText = isIdleAsync
    ? "Mulai ketik untuk mencari..."
    : emptyText;

  const estimatedTotalSize = totalCount * vCfg.estimateItemPx;
  const safeTotalSize = totalSize > 0 ? totalSize : estimatedTotalSize;
  const listHeight = Math.min(vCfg.heightPx, safeTotalSize);
  const shouldFallbackToNonVirtual =
    vCfg.enabled && totalCount > 0 && virtualItems.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between", className)}
        >
          <span
            className={cn("truncate", !hasSelection && "text-muted-foreground")}
          >
            {buttonText}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={searchPlaceholder}
            autoFocus
          />

          <CommandList>
            {loading && (
              <div className="p-3 text-sm text-muted-foreground">Memuat...</div>
            )}

            {!loading && asyncError && (
              <div className="p-3 text-sm text-destructive">{asyncError}</div>
            )}

            {renderEmpty ? (
              <CommandEmpty className="px-4 py-6 text-muted-foreground">
                {emptyStateText}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {vCfg.enabled && !shouldFallbackToNonVirtual ? (
                  <div
                    ref={parentRef}
                    style={{ height: listHeight, overflow: "auto" }}
                  >
                    <div
                      style={{
                        height: totalSize,
                        width: "100%",
                        position: "relative",
                      }}
                    >
                      {virtualItems.map((vi) => {
                        const isCreateRow = canCreate && vi.index === 0;
                        const itemIndex = canCreate ? vi.index - 1 : vi.index;

                        return (
                          <div
                            key={vi.key}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              transform: `translateY(${vi.start}px)`,
                            }}
                          >
                            {isCreateRow ? (
                              <CommandItem
                                value={`__create__:${query}`}
                                onSelect={handleCreate}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                <span className="truncate">{createLabel}</span>
                              </CommandItem>
                            ) : (
                              (() => {
                                const it = filteredItems[itemIndex];
                                if (!it) return null;

                                const k = effectiveKeyField
                                  ? ((it as any)[effectiveKeyField] as KeyLike)
                                  : getLabel(it);

                                const label = getLabel(it);

                                const isSelected = effectiveKeyField
                                  ? isMultiple
                                    ? selectedValues.some(
                                        (v) =>
                                          (it as any)[effectiveKeyField] === v,
                                      )
                                    : valueSingle != null &&
                                      (it as any)[effectiveKeyField] ===
                                        valueSingle
                                  : false;

                                const valueKey = effectiveKeyField
                                  ? String(k)
                                  : label;
                                const keywords = effectiveKeyField
                                  ? [label, String(k)]
                                  : undefined;

                                return (
                                  <CommandItem
                                    key={String(k)}
                                    value={valueKey}
                                    keywords={keywords}
                                    onSelect={() => handleSelect(it)}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        isSelected
                                          ? "opacity-100"
                                          : "opacity-0",
                                      )}
                                    />
                                    <span className="truncate">{label}</span>
                                  </CommandItem>
                                );
                              })()
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <>
                    {canCreate && (
                      <CommandItem
                        value={`__create__:${query}`}
                        onSelect={handleCreate}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        <span className="truncate">{createLabel}</span>
                      </CommandItem>
                    )}

                    {filteredItems.map((it) => {
                      const k = effectiveKeyField
                        ? ((it as any)[effectiveKeyField] as KeyLike)
                        : getLabel(it);

                      const label = getLabel(it);

                      const isSelected = effectiveKeyField
                        ? isMultiple
                          ? selectedValues.some(
                              (v) => (it as any)[effectiveKeyField] === v,
                            )
                          : valueSingle != null &&
                            (it as any)[effectiveKeyField] === valueSingle
                        : false;

                      const valueKey = effectiveKeyField ? String(k) : label;
                      const keywords = effectiveKeyField
                        ? [label, String(k)]
                        : undefined;

                      return (
                        <CommandItem
                          key={String(k)}
                          value={valueKey}
                          keywords={keywords}
                          onSelect={() => handleSelect(it)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              isSelected ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="truncate">{label}</span>
                        </CommandItem>
                      );
                    })}
                  </>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

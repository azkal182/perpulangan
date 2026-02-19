"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Id, Korwil, Korda } from "../types";

type Props = {
  korwils: Korwil[];
  kordas: Korda[];

  selectedKorwilId: Id | "all";
  onSelectKorwilId: (v: Id | "all") => void;

  selectedKordaId: Id | "all";
  onSelectKordaId: (v: Id | "all") => void;

  search: string;
  onSearch: (v: string) => void;

  onReset: () => void;
};

export function FiltersBar(props: Props) {
  const {
    korwils,
    kordas,
    selectedKorwilId,
    onSelectKorwilId,
    selectedKordaId,
    onSelectKordaId,
    search,
    onSearch,
    onReset,
  } = props;

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3 md:items-end">
        <div className="space-y-1">
          <div className="text-sm font-medium">Korwil</div>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={selectedKorwilId}
            onChange={(e) => onSelectKorwilId(e.target.value as Id | "all")}
          >
            <option value="all">Semua Korwil</option>
            {korwils.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <div className="text-sm font-medium">Korda</div>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={selectedKordaId}
            onChange={(e) => onSelectKordaId(e.target.value as Id | "all")}
          >
            <option value="all">Semua Korda</option>
            {kordas.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <div className="text-sm font-medium">Search</div>
          <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search titik turun…" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={onReset}>
          Reset
        </Button>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { DropPoint, Id, Korwil, Korda, Kota } from "../types";
import { formatRupiah } from "../lib/format";

type Props = {
  korwils: Korwil[];
  kordas: Korda[];
  kotas: Kota[];
  dropPoints: DropPoint[];

  korwilId: Id | null;
  kordaId: Id | null;
  kotaId: Id | null;
  dropPointId: Id | null;

  departDate: string;

  onKorwil: (id: Id | null) => void;
  onKorda: (id: Id | null) => void;
  onKota: (id: Id | null) => void;
  onDropPoint: (id: Id | null) => void;
  onDepartDate: (v: string) => void;

  pricePerPerson: number;
  errorKorwil?: string;
  errorKorda?: string;
  errorDropPoint?: string;
  errorDepartDate?: string;
};

export function TripSelectors(props: Props) {
  const {
    korwils,
    kordas,
    kotas,
    dropPoints,
    korwilId,
    kordaId,
    kotaId,
    dropPointId,
    departDate,
    onKorwil,
    onKorda,
    onKota,
    onDropPoint,
    onDepartDate,
    pricePerPerson,
    errorKorwil,
    errorKorda,
    errorDropPoint,
    errorDepartDate,
  } = props;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <div className="text-sm font-medium">Korwil</div>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={korwilId ?? ""}
            onChange={(e) => onKorwil(e.target.value ? (e.target.value as Id) : null)}
          >
            <option value="">Pilih Korwil</option>
            {korwils.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
          {errorKorwil ? <div className="text-xs text-destructive">{errorKorwil}</div> : null}
        </div>

        <div className="space-y-1">
          <div className="text-sm font-medium">Korda</div>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={kordaId ?? ""}
            onChange={(e) => onKorda(e.target.value ? (e.target.value as Id) : null)}
            disabled={!korwilId}
          >
            <option value="">{korwilId ? "Pilih Korda" : "Pilih Korwil dulu"}</option>
            {kordas.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
          {errorKorda ? <div className="text-xs text-destructive">{errorKorda}</div> : null}
        </div>

        <div className="space-y-1">
          <div className="text-sm font-medium">Kota</div>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={kotaId ?? ""}
            onChange={(e) => onKota(e.target.value ? (e.target.value as Id) : null)}
            disabled={!kordaId}
          >
            <option value="">{kordaId ? "Pilih Kota (opsional)" : "Pilih Korda dulu"}</option>
            {kotas.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <div className="text-sm font-medium">Tanggal Pulang</div>
          <Input type="date" value={departDate} onChange={(e) => onDepartDate(e.target.value)} />
          {errorDepartDate ? <div className="text-xs text-destructive">{errorDepartDate}</div> : null}
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-sm font-medium">Titik Turun</div>
        <select
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          value={dropPointId ?? ""}
          onChange={(e) => onDropPoint(e.target.value ? (e.target.value as Id) : null)}
          disabled={!kordaId}
        >
          <option value="">{kordaId ? "Pilih Titik Turun" : "Pilih Korda dulu"}</option>
          {dropPoints.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} — {formatRupiah(d.price)}
            </option>
          ))}
        </select>
        {errorDropPoint ? <div className="text-xs text-destructive">{errorDropPoint}</div> : null}

        <div className="pt-1">
          <Badge variant="secondary">Harga / orang: {formatRupiah(pricePerPerson)}</Badge>
        </div>
      </div>
    </div>
  );
}

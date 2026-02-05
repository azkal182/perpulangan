"use client";

import * as React from "react";
import type { DropPoint, Id, Korwil, Korda } from "../types";
import { uid } from "../lib/uid";

type FilterId = Id | "all";

const seedKorwils: Korwil[] = [
  { id: "kw-1", name: "Jawa Barat" },
  { id: "kw-2", name: "Jawa Timur" },
];

const seedKordas: Korda[] = [
  { id: "kd-1", name: "Bandung Raya", korwilId: "kw-1" },
  { id: "kd-2", name: "Bogor Depok", korwilId: "kw-1" },
  { id: "kd-3", name: "Surabaya Raya", korwilId: "kw-2" },
];

const seedDropPoints: DropPoint[] = [
  { id: "dp-1", kordaId: "kd-1", name: "Turun Kota Bandung", price: 150000 },
  { id: "dp-2", kordaId: "kd-1", name: "Turun Kab. Bandung", price: 140000 },
  { id: "dp-3", kordaId: "kd-3", name: "Turun Kota Surabaya", price: 200000 },
];

export function useDropPoints() {
  const [korwils] = React.useState<Korwil[]>(seedKorwils);
  const [kordas] = React.useState<Korda[]>(seedKordas);
  const [dropPoints, setDropPoints] =
    React.useState<DropPoint[]>(seedDropPoints);

  const [korwilId, setKorwilId] = React.useState<FilterId>("all");
  const [kordaId, setKordaId] = React.useState<FilterId>("all");
  const [q, setQ] = React.useState("");

  // dialog state
  const [openCreate, setOpenCreate] = React.useState(false);
  const [openEdit, setOpenEdit] = React.useState(false);
  const [editing, setEditing] = React.useState<DropPoint | null>(null);

  // dependent filter: kalau korwil berubah, korda yang valid menyesuaikan
  const kordasFilteredByKorwil = React.useMemo(() => {
    if (korwilId === "all") return kordas;
    return kordas.filter((k) => k.korwilId === korwilId);
  }, [kordas, korwilId]);

  React.useEffect(() => {
    // kalau korda yang dipilih tidak termasuk korwil baru, reset
    if (kordaId === "all") return;
    const stillValid = kordasFilteredByKorwil.some((k) => k.id === kordaId);
    if (!stillValid) setKordaId("all");
  }, [kordasFilteredByKorwil, kordaId]);

  const list = React.useMemo(() => {
    const qq = q.trim().toLowerCase();

    return dropPoints.filter((dp) => {
      const k = kordas.find((x) => x.id === dp.kordaId);
      const passKorwil = korwilId === "all" ? true : k?.korwilId === korwilId;
      const passKorda = kordaId === "all" ? true : dp.kordaId === kordaId;
      const passQ = !qq ? true : dp.name.toLowerCase().includes(qq);

      return passKorwil && passKorda && passQ;
    });
  }, [dropPoints, kordas, korwilId, kordaId, q]);

  function resetFilters() {
    setKorwilId("all");
    setKordaId("all");
    setQ("");
  }

  function create(payload: { kordaId: Id; name: string; price: number }) {
    const id = uid("dp");
    setDropPoints((s) => [{ id, ...payload }, ...s]);
  }

  function startEdit(item: DropPoint) {
    setEditing(item);
    setOpenEdit(true);
  }

  function update(payload: { kordaId: Id; name: string; price: number }) {
    if (!editing) return;
    setDropPoints((s) =>
      s.map((x) => (x.id === editing.id ? { ...x, ...payload } : x)),
    );
    setEditing(null);
  }

  function remove(id: Id) {
    setDropPoints((s) => s.filter((x) => x.id !== id));
  }

  return {
    korwils,
    kordas,
    dropPoints: list,

    // lookup helper
    getKordaById: (id: Id) => kordas.find((k) => k.id === id),
    getKorwilById: (id: Id) => korwils.find((k) => k.id === id),

    // filters
    korwilId,
    setKorwilId,
    kordaId,
    setKordaId,
    kordasFilteredByKorwil,
    q,
    setQ,
    resetFilters,

    // dialogs
    openCreate,
    setOpenCreate,
    openEdit,
    setOpenEdit,
    editing,

    // actions
    create,
    startEdit,
    update,
    remove,
  };
}

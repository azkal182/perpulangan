"use client";

import * as React from "react";
import type { DropPoint, Id, Korwil, Korda } from "../types";
import {
  getDropPoints,
  createDropPoint,
  updateDropPoint,
  deleteDropPoint,
} from "../actions/drop-point.action";
import { getKorwil } from "@/features/master/actions/korwil.action";
import { getKorda } from "@/features/master/actions/korda.action";
import { logError } from "@/lib/logger-client";

type FilterId = Id | "all";

export function useDropPoints() {
  const [korwils, setKorwils] = React.useState<Korwil[]>([]);
  const [kordas, setKordas] = React.useState<Korda[]>([]);
  const [dropPoints, setDropPoints] = React.useState<DropPoint[]>([]);

  const [loading, setLoading] = React.useState(true);

  const [korwilId, setKorwilId] = React.useState<FilterId>("all");
  const [kordaId, setKordaId] = React.useState<FilterId>("all");
  const [q, setQ] = React.useState("");

  // dialog state
  const [openCreate, setOpenCreate] = React.useState(false);
  const [openEdit, setOpenEdit] = React.useState(false);
  const [editing, setEditing] = React.useState<DropPoint | null>(null);

  // 1. Fetch Master Data (Korwil & Korda)
  React.useEffect(() => {
    async function loadMasters() {
      try {
        const [resKorwil, resKorda] = await Promise.all([
          getKorwil({ limit: 100 }),
          getKorda({ limit: 100 }), // Fetch all kordas for mapping
        ]);

        if (resKorwil.success && resKorwil.data) {
          const items = Array.isArray(resKorwil.data)
            ? resKorwil.data
            : resKorwil.data.items;
          setKorwils(items);
        }
        if (resKorda.success && resKorda.data) {
          const items = Array.isArray(resKorda.data)
            ? resKorda.data
            : resKorda.data.items;
          setKordas(items);
        }
      } catch (err) {
        logError(err, { hook: "useDropPoints", action: "loadMasters" });
      }
    }
    loadMasters();
  }, []);

  // 2. Fetch Drop Points
  React.useEffect(() => {
    async function loadDropPoints() {
      setLoading(true);
      try {
        const res = await getDropPoints();
        if (res.success && res.data) {
          setDropPoints(res.data as DropPoint[]);
        }
      } catch (err) {
        logError(err, { hook: "useDropPoints", action: "loadDropPoints" });
      } finally {
        setLoading(false);
      }
    }
    loadDropPoints();
  }, []); // Reload triggers handled manually or via revalidatePath

  async function refresh() {
    const res = await getDropPoints();
    if (res.success && res.data) {
      setDropPoints(res.data as DropPoint[]);
    }
  }

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

  async function create(payload: { kordaId: Id; name: string; price: number }) {
    const res = await createDropPoint(payload);
    if (res.success && res.data) {
      setOpenCreate(false);
      refresh();
      // toast.success("Titik turun berhasil dibuat");
    } else {
      alert("Gagal membuat titik turun");
    }
  }

  function startEdit(item: DropPoint) {
    setEditing(item);
    setOpenEdit(true);
  }

  async function update(payload: { kordaId: Id; name: string; price: number }) {
    if (!editing) return;
    const res = await updateDropPoint(editing.id, payload);
    if (res.success) {
      setOpenEdit(false);
      setEditing(null);
      refresh();
      // toast.success("Titik turun berhasil diupdate");
    } else {
      alert("Gagal update titik turun");
    }
  }

  async function remove(id: Id) {
    if (!confirm("Yakin hapus?")) return;
    const res = await deleteDropPoint(id);
    if (res.success) {
      refresh();
    } else {
      alert("Gagal hapus");
    }
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
    loading,
  };
}

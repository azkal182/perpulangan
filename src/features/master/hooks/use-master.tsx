"use client";

import * as React from "react";
import type { Id, State } from "../types";
import { uid } from "../lib/uid";

const initialState: State = {
  selectedKorwilId: null,
  selectedKordaId: null,
  korwils: [
    { id: "kw-1", name: "Jawa Barat" },
    { id: "kw-2", name: "Jawa Timur" },
  ],
  kordasByKorwil: {
    "kw-1": [
      { id: "kd-1", name: "Bandung Raya" },
      { id: "kd-2", name: "Bogor Depok" },
    ],
    "kw-2": [{ id: "kd-3", name: "Surabaya Raya" }],
  },
  kotasByKorda: {
    "kd-1": [
      { id: "kt-1", name: "Kota Bandung" },
      { id: "kt-2", name: "Kab. Bandung" },
    ],
    "kd-2": [{ id: "kt-3", name: "Kota Bogor" }],
    "kd-3": [{ id: "kt-4", name: "Kota Surabaya" }],
  },
};

export function useMaster() {
  const [state, setState] = React.useState<State>(() => initialState);

  // dialog open
  const [openAddKorwil, setOpenAddKorwil] = React.useState(false);
  const [openAddKorda, setOpenAddKorda] = React.useState(false);
  const [openAddKota, setOpenAddKota] = React.useState(false);

  // form inputs
  const [korwilName, setKorwilName] = React.useState("");
  const [kordaName, setKordaName] = React.useState("");
  const [kotaName, setKotaName] = React.useState("");

  // search
  const [qKorwil, setQKorwil] = React.useState("");
  const [qKorda, setQKorda] = React.useState("");
  const [qKota, setQKota] = React.useState("");

  const selectedKorwil = React.useMemo(
    () => state.korwils.find((k) => k.id === state.selectedKorwilId) ?? null,
    [state.korwils, state.selectedKorwilId]
  );

  const kordas = React.useMemo(() => {
    if (!state.selectedKorwilId) return [];
    return state.kordasByKorwil[state.selectedKorwilId] ?? [];
  }, [state.kordasByKorwil, state.selectedKorwilId]);

  const selectedKorda = React.useMemo(
    () => kordas.find((k) => k.id === state.selectedKordaId) ?? null,
    [kordas, state.selectedKordaId]
  );

  const kotas = React.useMemo(() => {
    if (!state.selectedKordaId) return [];
    return state.kotasByKorda[state.selectedKordaId] ?? [];
  }, [state.kotasByKorda, state.selectedKordaId]);

  const korwilsFiltered = React.useMemo(() => {
    const q = qKorwil.trim().toLowerCase();
    if (!q) return state.korwils;
    return state.korwils.filter((x) => x.name.toLowerCase().includes(q));
  }, [state.korwils, qKorwil]);

  const kordasFiltered = React.useMemo(() => {
    const q = qKorda.trim().toLowerCase();
    if (!q) return kordas;
    return kordas.filter((x) => x.name.toLowerCase().includes(q));
  }, [kordas, qKorda]);

  const kotasFiltered = React.useMemo(() => {
    const q = qKota.trim().toLowerCase();
    if (!q) return kotas;
    return kotas.filter((x) => x.name.toLowerCase().includes(q));
  }, [kotas, qKota]);

  function selectKorwil(id: Id) {
    setState((s) => ({
      ...s,
      selectedKorwilId: id,
      selectedKordaId: null, // guard
    }));
    setQKorda("");
    setQKota("");
  }

  function selectKorda(id: Id) {
    setState((s) => ({ ...s, selectedKordaId: id }));
    setQKota("");
  }

  function resetSelection() {
    setState((s) => ({ ...s, selectedKorwilId: null, selectedKordaId: null }));
    setQKorda("");
    setQKota("");
  }

  function addKorwil() {
    const name = korwilName.trim();
    if (!name) return;

    const id = uid("kw");
    setState((s) => ({
      ...s,
      korwils: [...s.korwils, { id, name }],
      kordasByKorwil: { ...s.kordasByKorwil, [id]: [] },
      selectedKorwilId: id,
      selectedKordaId: null,
    }));

    setKorwilName("");
    setQKorwil("");
    setOpenAddKorwil(false);
  }

  function addKorda() {
    const korwilId = state.selectedKorwilId;
    if (!korwilId) return;

    const name = kordaName.trim();
    if (!name) return;

    const id = uid("kd");
    setState((s) => ({
      ...s,
      kordasByKorwil: {
        ...s.kordasByKorwil,
        [korwilId]: [...(s.kordasByKorwil[korwilId] ?? []), { id, name }],
      },
      kotasByKorda: { ...s.kotasByKorda, [id]: [] },
      selectedKordaId: id,
    }));

    setKordaName("");
    setQKorda("");
    setOpenAddKorda(false);
  }

  function addKota() {
    const kordaId = state.selectedKordaId;
    if (!kordaId) return;

    const name = kotaName.trim();
    if (!name) return;

    const id = uid("kt");
    setState((s) => ({
      ...s,
      kotasByKorda: {
        ...s.kotasByKorda,
        [kordaId]: [...(s.kotasByKorda[kordaId] ?? []), { id, name }],
      },
    }));

    setKotaName("");
    setQKota("");
    setOpenAddKota(false);
  }

  // DELETE (tetap simple + cleanup mapping agar tidak orphan)
  function deleteKorwil(korwilId: Id) {
    setState((s) => {
      const next: State = { ...s };
      const kordasOfKorwil = next.kordasByKorwil[korwilId] ?? [];

      next.korwils = next.korwils.filter((k) => k.id !== korwilId);

      next.kordasByKorwil = { ...next.kordasByKorwil };
      delete next.kordasByKorwil[korwilId];

      next.kotasByKorda = { ...next.kotasByKorda };
      for (const kd of kordasOfKorwil) delete next.kotasByKorda[kd.id];

      if (next.selectedKorwilId === korwilId) {
        next.selectedKorwilId = null;
        next.selectedKordaId = null;
      }
      return next;
    });

    setQKorda("");
    setQKota("");
  }

  function deleteKorda(kordaId: Id) {
    const korwilId = state.selectedKorwilId;
    if (!korwilId) return;

    setState((s) => {
      const next: State = { ...s };

      next.kordasByKorwil = { ...next.kordasByKorwil };
      next.kordasByKorwil[korwilId] = (next.kordasByKorwil[korwilId] ?? []).filter((k) => k.id !== kordaId);

      next.kotasByKorda = { ...next.kotasByKorda };
      delete next.kotasByKorda[kordaId];

      if (next.selectedKordaId === kordaId) next.selectedKordaId = null;
      return next;
    });

    setQKota("");
  }

  function deleteKota(kotaId: Id) {
    const kordaId = state.selectedKordaId;
    if (!kordaId) return;

    setState((s) => ({
      ...s,
      kotasByKorda: {
        ...s.kotasByKorda,
        [kordaId]: (s.kotasByKorda[kordaId] ?? []).filter((x) => x.id !== kotaId),
      },
    }));
  }

  const currentStep = state.selectedKorwilId ? (state.selectedKordaId ? 3 : 2) : 1;

  return {
    // data
    state,
    selectedKorwil,
    selectedKorda,
    kordas,
    kotas,
    korwilsFiltered,
    kordasFiltered,
    kotasFiltered,
    currentStep,

    // dialog state
    openAddKorwil,
    setOpenAddKorwil,
    openAddKorda,
    setOpenAddKorda,
    openAddKota,
    setOpenAddKota,

    // form
    korwilName,
    setKorwilName,
    kordaName,
    setKordaName,
    kotaName,
    setKotaName,

    // search
    qKorwil,
    setQKorwil,
    qKorda,
    setQKorda,
    qKota,
    setQKota,

    // actions
    selectKorwil,
    selectKorda,
    resetSelection,
    addKorwil,
    addKorda,
    addKota,
    deleteKorwil,
    deleteKorda,
    deleteKota,
  };
}

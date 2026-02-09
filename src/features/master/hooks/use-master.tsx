"use client";

import * as React from "react";
import type { Id, Korda, State } from "../types";
import {
  getKorwil,
  createKorwil,
  deleteKorwil as deleteKorwilAction,
} from "../actions/korwil.action";
import {
  getKorda,
  createKorda,
  deleteKorda as deleteKordaAction,
} from "../actions/korda.action";
import {
  getKota,
  createKota,
  deleteKota as deleteKotaAction,
} from "../actions/kota.action";

const initialState: State = {
  selectedKorwilId: null,
  selectedKordaId: null,
  korwils: [],
  kordasByKorwil: {},
  kotasByKorda: {},
};

function groupKordasByKorwil(items: Korda[]) {
  const out: Record<Id, Korda[]> = {};
  for (const item of items) {
    if (!item.korwilId) continue;
    if (!out[item.korwilId]) out[item.korwilId] = [];
    out[item.korwilId].push(item);
  }
  return out;
}

export function useMaster() {
  const [state, setState] = React.useState<State>(() => initialState);
  const [loadingKorwil, setLoadingKorwil] = React.useState(false);
  const [loadingKorda, setLoadingKorda] = React.useState(false);
  const [loadingKota, setLoadingKota] = React.useState(false);

  // dialog open
  const [openAddKorwil, setOpenAddKorwil] = React.useState(false);
  const [openAddKorda, setOpenAddKorda] = React.useState(false);
  const [openAddKota, setOpenAddKota] = React.useState(false);

  // form inputs
  const [korwilName, setKorwilName] = React.useState("");
  const [kordaName, setKordaName] = React.useState("");
  // search
  const [qKorwil, setQKorwil] = React.useState("");
  const [qKorda, setQKorda] = React.useState("");
  const [qKota, setQKota] = React.useState("");

  const loadKorwils = React.useCallback(async () => {
    try {
      setLoadingKorwil(true);
      const res = await getKorwil();
      if (!res.success) {
        alert(res.error ?? "Gagal mengambil data korwil.");
        return;
      }
      const items = Array.isArray(res.data) ? res.data : res.data.items;
      setState((s) => ({ ...s, korwils: items }));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      alert("Gagal mengambil data korwil.");
    } finally {
      setLoadingKorwil(false);
    }
  }, [getKorwil]);

  const loadKordas = React.useCallback(
    async (korwilId?: Id) => {
      try {
        setLoadingKorda(true);
        const res = await getKorda(korwilId ? { korwilId } : undefined);
        if (!res.success) {
          alert(res.error ?? "Gagal mengambil data korda.");
          return;
        }
        const items = Array.isArray(res.data) ? res.data : res.data.items;
        setState((s) => {
          if (korwilId) {
            return {
              ...s,
              kordasByKorwil: { ...s.kordasByKorwil, [korwilId]: items },
            };
          }
          const grouped = groupKordasByKorwil(items);
          for (const kw of s.korwils) {
            if (!grouped[kw.id]) grouped[kw.id] = [];
          }
          return { ...s, kordasByKorwil: grouped };
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        alert("Gagal mengambil data korda.");
      } finally {
        setLoadingKorda(false);
      }
    },
    [getKorda],
  );

  React.useEffect(() => {
    void (async () => {
      await loadKorwils();
      await loadKordas();
    })();
  }, [loadKorwils, loadKordas]);

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
    if (!state.kordasByKorwil[id]) {
      void loadKordas(id);
    }
  }

  function selectKorda(id: Id) {
    setState((s) => ({ ...s, selectedKordaId: id }));
    setQKota("");
    if (!state.kotasByKorda[id]) {
      void loadKotas(id);
    }
  }

  function resetSelection() {
    setState((s) => ({ ...s, selectedKorwilId: null, selectedKordaId: null }));
    setQKorda("");
    setQKota("");
  }

  async function addKorwil() {
    const name = korwilName.trim();
    if (!name) return;

    try {
      const res = await createKorwil({ name });
      if (!res.success) {
        alert(res.error ?? "Gagal membuat korwil.");
        return;
      }

      const created = res.data;
      setState((s) => ({
        ...s,
        korwils: [...s.korwils, created],
        kordasByKorwil: { ...s.kordasByKorwil, [created.id]: [] },
        selectedKorwilId: created.id,
        selectedKordaId: null,
      }));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      alert("Gagal membuat korwil.");
      return;
    }

    setKorwilName("");
    setQKorwil("");
    setOpenAddKorwil(false);
  }

  async function addKorda() {
    const korwilId = state.selectedKorwilId;
    if (!korwilId) return;

    const name = kordaName.trim();
    if (!name) return;

    try {
      const res = await createKorda({ name, korwilId });
      if (!res.success) {
        alert(res.error ?? "Gagal membuat korda.");
        return;
      }

      const created = res.data;
      setState((s) => ({
        ...s,
        kordasByKorwil: {
          ...s.kordasByKorwil,
          [korwilId]: [...(s.kordasByKorwil[korwilId] ?? []), created],
        },
        kotasByKorda: { ...s.kotasByKorda, [created.id]: [] },
        selectedKordaId: created.id,
      }));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      alert("Gagal membuat korda.");
      return;
    }

    setKordaName("");
    setQKorda("");
    setOpenAddKorda(false);
  }

  const loadKotas = React.useCallback(
    async (kordaId: Id) => {
      try {
        setLoadingKota(true);
        const res = await getKota({ kordaId });
        if (!res.success) {
          alert(res.error ?? "Gagal mengambil data kota.");
          return;
        }
        const items = res.data;
        setState((s) => ({
          ...s,
          kotasByKorda: { ...s.kotasByKorda, [kordaId]: items },
        }));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        alert("Gagal mengambil data kota.");
      } finally {
        setLoadingKota(false);
      }
    },
    [getKota],
  );

  async function addKota(regencyIds: number[]): Promise<boolean> {
    const kordaId = state.selectedKordaId;
    if (!kordaId) return false;
    const ids = Array.from(new Set(regencyIds)).filter((id) => !!id);
    if (ids.length === 0) return false;

    try {
      const errors: string[] = [];

      for (const regencyId of ids) {
        const res = await createKota({ kordaId, regencyId });
        if (!res.success) {
          errors.push(res.error ?? `Gagal menambahkan kota (${regencyId}).`);
          continue;
        }

        const created = res.data;
        setState((s) => ({
          ...s,
          kotasByKorda: {
            ...s.kotasByKorda,
            [kordaId]: (() => {
              const current = s.kotasByKorda[kordaId] ?? [];
              if (current.some((x) => x.id === created.id)) return current;
              return [...current, created].sort((a, b) =>
                a.name.localeCompare(b.name, "id-ID"),
              );
            })(),
          },
        }));
      }

      setQKota("");
      if (errors.length > 0) {
        alert(errors[0]);
        return false;
      }
      return true;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      alert("Gagal menambahkan kota.");
      return false;
    }
  }

  // DELETE (tetap simple + cleanup mapping agar tidak orphan)
  async function deleteKorwil(korwilId: Id) {
    try {
      const res = await deleteKorwilAction(korwilId);
      if (!res.success) {
        alert(res.error ?? "Gagal menghapus korwil.");
        return;
      }

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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      alert("Gagal menghapus korwil.");
    }

    setQKorda("");
    setQKota("");
  }

  async function deleteKorda(kordaId: Id) {
    const korwilId = state.selectedKorwilId;
    if (!korwilId) return;

    try {
      const res = await deleteKordaAction(kordaId);
      if (!res.success) {
        alert(res.error ?? "Gagal menghapus korda.");
        return;
      }

      setState((s) => {
        const next: State = { ...s };

        next.kordasByKorwil = { ...next.kordasByKorwil };
        next.kordasByKorwil[korwilId] = (next.kordasByKorwil[korwilId] ?? []).filter((k) => k.id !== kordaId);

        next.kotasByKorda = { ...next.kotasByKorda };
        delete next.kotasByKorda[kordaId];

        if (next.selectedKordaId === kordaId) next.selectedKordaId = null;
        return next;
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      alert("Gagal menghapus korda.");
    }

    setQKota("");
  }

  async function deleteKota(kotaId: number) {
    const kordaId = state.selectedKordaId;
    if (!kordaId) return;

    try {
      const res = await deleteKotaAction({ id: kotaId, kordaId });
      if (!res.success) {
        alert(res.error ?? "Gagal menghapus kota.");
        return;
      }

      setState((s) => ({
        ...s,
        kotasByKorda: {
          ...s.kotasByKorda,
          [kordaId]: (s.kotasByKorda[kordaId] ?? []).filter((x) => x.id !== kotaId),
        },
      }));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      alert("Gagal menghapus kota.");
    }
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
    loadingKorwil,
    loadingKorda,
    loadingKota,

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

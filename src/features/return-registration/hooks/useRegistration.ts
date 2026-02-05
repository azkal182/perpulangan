"use client";

import * as React from "react";
import type {
  DropPoint,
  Id,
  Korda,
  Korwil,
  Kota,
  Member,
  RegistrationDraft,
} from "../types";
import { uid } from "../lib/uid";

const seedKorwils: Korwil[] = [
  { id: "kw-1", name: "Jawa Barat" },
  { id: "kw-2", name: "Jawa Timur" },
];

const seedKordas: Korda[] = [
  { id: "kd-1", name: "Bandung Raya", korwilId: "kw-1" },
  { id: "kd-2", name: "Bogor Depok", korwilId: "kw-1" },
  { id: "kd-3", name: "Surabaya Raya", korwilId: "kw-2" },
];

const seedKotas: Kota[] = [
  { id: "kt-1", name: "Kota Bandung", kordaId: "kd-1" },
  { id: "kt-2", name: "Kab. Bandung", kordaId: "kd-1" },
  { id: "kt-3", name: "Kota Bogor", kordaId: "kd-2" },
  { id: "kt-4", name: "Kota Surabaya", kordaId: "kd-3" },
];

const seedDropPoints: DropPoint[] = [
  { id: "dp-1", kordaId: "kd-1", name: "Turun Kota Bandung", price: 150000 },
  { id: "dp-2", kordaId: "kd-1", name: "Turun Kab. Bandung", price: 140000 },
  { id: "dp-3", kordaId: "kd-2", name: "Turun Kota Bogor", price: 155000 },
  { id: "dp-4", kordaId: "kd-3", name: "Turun Kota Surabaya", price: 200000 },
];

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function useRegistration() {
  const [korwils] = React.useState(seedKorwils);
  const [kordas] = React.useState(seedKordas);
  const [kotas] = React.useState(seedKotas);
  const [dropPoints] = React.useState(seedDropPoints);

  const [draft, setDraft] = React.useState<RegistrationDraft>(() => ({
    korwilId: null,
    kordaId: null,
    kotaId: null,
    dropPointId: null,
    departDate: todayISO(),
    bookerName: "",
    bookerPhone: "",
    notes: "",
    members: [{ id: uid("mb"), name: "", phone: "" }],
  }));

  const kordasByKorwil = React.useMemo(() => {
    if (!draft.korwilId) return [];
    return kordas.filter((k) => k.korwilId === draft.korwilId);
  }, [kordas, draft.korwilId]);

  const kotasByKorda = React.useMemo(() => {
    if (!draft.kordaId) return [];
    return kotas.filter((k) => k.kordaId === draft.kordaId);
  }, [kotas, draft.kordaId]);

  const dropPointsByKorda = React.useMemo(() => {
    if (!draft.kordaId) return [];
    return dropPoints.filter((d) => d.kordaId === draft.kordaId);
  }, [dropPoints, draft.kordaId]);

  const selectedDropPoint = React.useMemo(() => {
    if (!draft.dropPointId) return null;
    return dropPoints.find((d) => d.id === draft.dropPointId) ?? null;
  }, [dropPoints, draft.dropPointId]);

  // total: price per orang * jumlah member yang valid (name tidak kosong)
  const memberCount = React.useMemo(() => {
    return draft.members.filter((m) => m.name.trim().length > 0).length;
  }, [draft.members]);

  const pricePerPerson = selectedDropPoint?.price ?? 0;
  const total = pricePerPerson * memberCount;

  function setField<K extends keyof RegistrationDraft>(
    key: K,
    value: RegistrationDraft[K],
  ) {
    setDraft((s) => ({ ...s, [key]: value }));
  }

  function selectKorwil(id: Id | null) {
    setDraft((s) => ({
      ...s,
      korwilId: id,
      kordaId: null,
      kotaId: null,
      dropPointId: null,
    }));
  }

  function selectKorda(id: Id | null) {
    setDraft((s) => ({
      ...s,
      kordaId: id,
      kotaId: null,
      dropPointId: null,
    }));
  }

  function selectKota(id: Id | null) {
    setDraft((s) => ({ ...s, kotaId: id }));
  }

  function selectDropPoint(id: Id | null) {
    setDraft((s) => ({ ...s, dropPointId: id }));
  }

  function addMember() {
    setDraft((s) => ({
      ...s,
      members: [...s.members, { id: uid("mb"), name: "", phone: "" }],
    }));
  }

  function updateMember(id: Id, patch: Partial<Member>) {
    setDraft((s) => ({
      ...s,
      members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  }

  function removeMember(id: Id) {
    setDraft((s) => ({
      ...s,
      members:
        s.members.length <= 1
          ? s.members
          : s.members.filter((m) => m.id !== id),
    }));
  }

  function resetAll() {
    setDraft({
      korwilId: null,
      kordaId: null,
      kotaId: null,
      dropPointId: null,
      departDate: todayISO(),
      bookerName: "",
      bookerPhone: "",
      notes: "",
      members: [{ id: uid("mb"), name: "", phone: "" }],
    });
  }

  // validasi minimal (client)
  const errors = React.useMemo(() => {
    const e: Record<string, string> = {};
    if (!draft.korwilId) e.korwilId = "Korwil wajib dipilih.";
    if (!draft.kordaId) e.kordaId = "Korda wajib dipilih.";
    if (!draft.dropPointId) e.dropPointId = "Titik turun wajib dipilih.";
    if (!draft.departDate) e.departDate = "Tanggal pulang wajib diisi.";
    if (!draft.bookerName.trim()) e.bookerName = "Nama pemesan wajib diisi.";
    if (!draft.bookerPhone.trim())
      e.bookerPhone = "No. HP pemesan wajib diisi.";
    if (memberCount <= 0)
      e.members = "Minimal 1 anggota rombongan harus diisi.";
    return e;
  }, [draft, memberCount]);

  const canSubmit = Object.keys(errors).length === 0;

  async function submit() {
    if (!canSubmit) return { ok: false as const, message: "Form belum valid." };

    // TODO: ganti ke API call (Server Action / route handler)
    // simulasi payload final:
    const payload = {
      ...draft,
      members: draft.members.filter((m) => m.name.trim().length > 0),
      pricePerPerson,
      total,
      createdAt: new Date().toISOString(),
    };

    console.log("SUBMIT REGISTRATION", payload);

    return {
      ok: true as const,
      message: "Registrasi berhasil (simulasi).",
      payload,
    };
  }

  return {
    korwils,
    kordasByKorwil,
    kotasByKorda,
    dropPointsByKorda,
    selectedDropPoint,

    draft,
    setField,

    selectKorwil,
    selectKorda,
    selectKota,
    selectDropPoint,

    addMember,
    updateMember,
    removeMember,

    resetAll,

    memberCount,
    pricePerPerson,
    total,

    errors,
    canSubmit,
    submit,
  };
}

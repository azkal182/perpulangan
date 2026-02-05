"use client";

import * as React from "react";
import { useRegistration } from "./hooks/useRegistration";
import { RegistrationForm } from "./components/RegistrationForm";

export default function RegistrationPageView() {
  const r = useRegistration();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="text-lg font-semibold">Registrasi Rombongan Perpulangan</div>
          <div className="text-sm text-muted-foreground">
            Pilih titik turun & harga, lalu input data rombongan.
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <RegistrationForm
          korwils={r.korwils}
          kordas={r.kordasByKorwil}
          kotas={r.kotasByKorda}
          dropPoints={r.dropPointsByKorda}
          draft={r.draft}
          errors={r.errors}
          canSubmit={r.canSubmit}
          onKorwil={r.selectKorwil}
          onKorda={r.selectKorda}
          onKota={r.selectKota}
          onDropPoint={r.selectDropPoint}
          onDepartDate={(v) => r.setField("departDate", v)}
          onBookerName={(v) => r.setField("bookerName", v)}
          onBookerPhone={(v) => r.setField("bookerPhone", v)}
          onNotes={(v) => r.setField("notes", v)}
          onAddMember={r.addMember}
          onUpdateMember={r.updateMember}
          onRemoveMember={r.removeMember}
          memberCount={r.memberCount}
          pricePerPerson={r.pricePerPerson}
          total={r.total}
          onReset={r.resetAll}
          onSubmit={r.submit}
        />
      </div>
    </div>
  );
}

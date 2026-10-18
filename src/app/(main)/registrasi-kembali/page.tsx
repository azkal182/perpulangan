import { getEvent } from "@/features/event/services/event.service";
import { getKorda } from "@/features/master/actions/korda.action";
import { getDropPoints } from "@/features/drop-points/actions/drop-point.action";
import { MultiParticipantRegistrationForm } from "@/features/registration/components/MultiParticipantRegistrationForm";
import { RegistrationNavigation } from "@/features/registrations-management/components/RegistrationNavigation";
import type { Metadata } from "next";
import { getRegionalAccessScope } from "@/server/access-scope";

export const metadata: Metadata = {
  title: "Registrasi Kembali | Perpulangan Santri",
  description: "Halaman khusus untuk pendaftaran kembali saja (return-only)",
};

export default async function ReturnOnlyRegistrationPage() {
  const [activeEvent, scope] = await Promise.all([getActiveEvent(), getRegionalAccessScope()]);

  if (!activeEvent) {
    return (
      <>
        <RegistrationNavigation />
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Tidak Ada Event Aktif</h1>
            <p className="text-muted-foreground">
              Silakan aktifkan event terlebih dahulu untuk membuka pendaftaran.
            </p>
          </div>
        </div>
      </>
    );
  }

  // Fetch data
  const [kordasRes, dropPointsRes] = await Promise.all([
    getKorda({ limit: 100 }),
    getDropPoints(),
  ]);

  const kordas =
    kordasRes.success && kordasRes.data
      ? Array.isArray(kordasRes.data)
        ? kordasRes.data
        : kordasRes.data.items
      : [];

  const dropPoints =
    dropPointsRes.success && dropPointsRes.data ? dropPointsRes.data : [];

  return (
    <>
      <RegistrationNavigation />
      <div className="min-h-screen bg-background">
        <div className="border-b">
          <div className="mx-auto max-w-7xl px-4 py-4">
            <div className="text-lg font-semibold">
              Registrasi Kembali (Return Only)
            </div>
            <div className="text-sm text-muted-foreground">{activeEvent.name}</div>
          </div>
        </div>

        {activeEvent.status === "COMPLETED" && (
          <div className="mx-auto max-w-7xl px-4 pt-4 text-sm text-amber-700">
            Event telah selesai. Form ini hanya dapat menambahkan perjalanan Kembali yang belum tercatat pada peserta/event ini.
          </div>
        )}

        <div className="mx-auto max-w-7xl px-4 py-6">
          <MultiParticipantRegistrationForm
            eventId={activeEvent.id}
            eventName={activeEvent.name}
            kordas={kordas}
            dropPoints={dropPoints}
            defaultMode="return_only"
            defaultKordaId={scope.role === "korda" ? scope.kordaId : null}
            lockMode={true}
          />
        </div>
      </div>
    </>
  );
}

async function getActiveEvent() {
  try {
    const result = await getEvent();
    if (result.success && result.data) {
      const events = (Array.isArray(result.data) ? result.data : [result.data]) as Array<{ id: string; name: string; status: string; endDate: Date | string }>;
      const active = events.find((event) => event.status === "ACTIVE");
      if (active) return active;
      return events
        .filter((event) => event.status === "COMPLETED")
        .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];
    }
    return null;
  } catch {
    return null;
  }
}

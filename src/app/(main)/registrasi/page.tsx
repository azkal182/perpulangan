import { getKorda } from "@/features/master/actions/korda.action";
import { getDropPoints } from "@/features/drop-points/actions/drop-point.action";
import { MultiParticipantRegistrationForm } from "@/features/registration/components/MultiParticipantRegistrationForm";
import { RegistrationNavigation } from "@/features/registrations-management/components/RegistrationNavigation";
import { getRegionalAccessScope } from "@/server/access-scope";
import { getEventContext } from "@/server/event-context";
import { EventScopeBanner } from "@/features/event/components/EventScopeBanner";

export default async function RegistrationPage() {
  const scope = await getRegionalAccessScope();
  const { selectedEvent: activeEvent } = await getEventContext(scope);

  if (!activeEvent) {
    return (
      <>
        <RegistrationNavigation />
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Tidak Ada Event Terpilih</h1>
            <p className="text-muted-foreground">
              Pilih event dari pemilih di header. Jika belum ada event yang tersedia, admin perlu membuat atau mengaktifkan event.
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
              Registrasi Pulang-Kembali
            </div>
            <div className="text-sm text-muted-foreground">{activeEvent.name}</div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6">
          <EventScopeBanner eventName={activeEvent.name} status={activeEvent.status} />
          <div className="h-4" />
          {activeEvent.status === "ACTIVE" ? <MultiParticipantRegistrationForm
            eventId={activeEvent.id}
            eventName={activeEvent.name}
            kordas={kordas}
            dropPoints={dropPoints}
            defaultMode="both"
            defaultKordaId={scope.role === "korda" ? scope.kordaId : null}
            enableUnsavedGuard
          /> : <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">Registrasi tidak dapat diubah karena event ini tidak aktif.</p>}
        </div>
      </div>
    </>
  );
}

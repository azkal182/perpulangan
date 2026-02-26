import { getEvent } from "@/features/event/services/event.service";
import { getKorda } from "@/features/master/actions/korda.action";
import { getDropPoints } from "@/features/drop-points/actions/drop-point.action";
import { MultiParticipantRegistrationForm } from "@/features/registration/components/MultiParticipantRegistrationForm";
import { RegistrationNavigation } from "@/features/registrations-management/components/RegistrationNavigation";

export default async function RegistrationPage() {
  const activeEvent = await getActiveEvent();

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
              Registrasi Pulang-Kembali
            </div>
            <div className="text-sm text-muted-foreground">{activeEvent.name}</div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6">
          <MultiParticipantRegistrationForm
            eventId={activeEvent.id}
            eventName={activeEvent.name}
            kordas={kordas}
            dropPoints={dropPoints}
            defaultMode="both"
            lockMode={true}
            enableUnsavedGuard
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
      const events = Array.isArray(result.data) ? result.data : [result.data];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return events.find((e: any) => e.status === "ACTIVE");
    }
    return null;
  } catch {
    return null;
  }
}

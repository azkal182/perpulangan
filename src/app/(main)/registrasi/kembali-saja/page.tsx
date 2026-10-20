import RegistrationPageView from "@/features/registration/registration-page-view";
import { getKorda } from "@/features/master/actions/korda.action";
import { getDropPoints } from "@/features/drop-points/actions/drop-point.action";
import { getRegistrations } from "@/features/registration/actions/registration.action";
import { Metadata } from "next";
import { getRegionalAccessScope } from "@/server/access-scope";
import { getEventContext } from "@/server/event-context";

export const metadata: Metadata = {
  title: "Registrasi Kembali Saja | Perpulangan Santri",
  description: "Halaman khusus untuk pendaftaran kepulangan santri (One Way)",
};

export default async function ReturnOnlyRegistrationPage() {
  const scope = await getRegionalAccessScope();
  const { selectedEvent: activeEvent } = await getEventContext(scope);

  if (!activeEvent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Tidak Ada Event Terpilih</h1>
          <p className="text-muted-foreground">
            Pilih event dari pemilih di header. Jika belum ada event yang tersedia, admin perlu membuat atau mengaktifkan event.
          </p>
        </div>
      </div>
    );
  }

  // Fetch all data on server
  const [kordasRes, dropPointsRes, registrationsRes] =
    await Promise.all([
      getKorda({ limit: 100 }),
      getDropPoints(),
      getRegistrations({ eventId: activeEvent.id }),
    ]);

  const kordas =
    kordasRes.success && kordasRes.data
      ? Array.isArray(kordasRes.data)
        ? kordasRes.data
        : kordasRes.data.items
      : [];

  const dropPoints = dropPointsRes.success && dropPointsRes.data ? dropPointsRes.data : [];
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registrations = (registrationsRes.success && registrationsRes.data ? registrationsRes.data : []) as any;

  return (
    activeEvent.status === "ACTIVE" ? <RegistrationPageView
      eventId={activeEvent.id}
      eventName={activeEvent.name}
      initialKordas={kordas}
      initialDropPoints={dropPoints}
      initialRegistrations={registrations}
      defaultKordaId={scope.role === "korda" ? scope.kordaId : null}
      pageTitle="Registrasi Kembali Saja (Return Only)"
      defaultMode="return_only"
      lockMode={true}
    /> : <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">Perubahan perjalanan Kembali hanya dapat dilakukan pada event aktif. Data event ini tetap dapat dilihat melalui daftar peserta.</div>
  );
}

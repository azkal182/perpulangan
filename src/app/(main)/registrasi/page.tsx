import RegistrationPageView from "@/features/registration/registration-page-view";
import { getEvent } from "@/features/event/services/event.service";
import { getStudentsPage } from "@/features/santri/services/students.db";
import { getKorda } from "@/features/master/actions/korda.action";
import { getDropPoints } from "@/features/drop-points/actions/drop-point.action";
import { getRegistrations } from "@/features/registration/actions/registration.action";

export default async function RegistrationPage() {
  const activeEvent = await getActiveEvent();

  if (!activeEvent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Tidak Ada Event Aktif</h1>
          <p className="text-muted-foreground">
            Silakan aktifkan event terlebih dahulu untuk membuka pendaftaran.
          </p>
        </div>
      </div>
    );
  }

  // Fetch all data on server
  const [studentsRes, kordasRes, dropPointsRes, registrationsRes] =
    await Promise.all([
      getStudentsPage(1, 100),
      getKorda({ limit: 100 }),
      getDropPoints(),
      getRegistrations({ eventId: activeEvent.id }),
    ]);

  const students =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    studentsRes.students?.map((s: any) => ({
      id: s.id,
      name: s.name,
      nis: s.nis,
      regency: s.regency?.korda
        ? {
            kordaId: s.regency.korda.id,  // ← Extract from regency.korda.id
          }
        : null,
    })) || [];

  const kordas =
    kordasRes.success && kordasRes.data
      ? Array.isArray(kordasRes.data)
        ? kordasRes.data
        : kordasRes.data.items
      : [];

  const dropPoints = dropPointsRes.success && dropPointsRes.data ? dropPointsRes.data : [];
  const registrations = registrationsRes.success && registrationsRes.data ? registrationsRes.data : [];

  return (
    <RegistrationPageView
      eventId={activeEvent.id}
      eventName={activeEvent.name}
      initialStudents={students}
      initialKordas={kordas}
      initialDropPoints={dropPoints}
      initialRegistrations={registrations}
    />
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

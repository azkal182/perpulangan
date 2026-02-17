import { getEvent } from "@/features/event/services/event.service";
import { getKorda } from "@/features/master/actions/korda.action";
import { getDropPoints } from "@/features/drop-points/actions/drop-point.action";
import {
  getRegistrationsAction,
  getStatsAction,
} from "@/features/registrations-management/actions/registrations-management.actions";
import type { RegistrationStatus } from "@/generated/prisma/client";
import { RegistrationNavigation } from "@/features/registrations-management/components/RegistrationNavigation";
import { RegistrationStatsCards } from "@/features/registrations-management/components/RegistrationStatsCards";
import { RegistrationFilters } from "@/features/registrations-management/components/RegistrationFilters";
import { RegistrationsTable } from "@/features/registrations-management/components/RegistrationsTable";
import { PrintButton } from "@/features/registrations-management/components/PrintButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PageProps {
  searchParams?: Promise<{
    journeyType?: string;
    status?: string;
    kordaId?: string;
    dropPointId?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function DaftarPesertaPage({ searchParams }: PageProps) {
  const activeEvent = await getActiveEvent();

  if (!activeEvent) {
    return (
      <>
        <RegistrationNavigation />
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Tidak Ada Event Aktif</h1>
            <p className="text-muted-foreground">
              Silakan aktifkan event terlebih dahulu untuk melihat daftar peserta.
            </p>
          </div>
        </div>
      </>
    );
  }

  // Parse search params
  const params = await searchParams;
  const journeyType = params?.journeyType || "all";
  const status = params?.status || "all";
  const kordaId = params?.kordaId || undefined;
  const dropPointId = params?.dropPointId || undefined;
  const search = params?.search || undefined;
  const page = parseInt(params?.page || "1", 10);
  const pageSize = 20;

  // Fetch data
  const [kordasRes, dropPointsRes, registrationsRes, statsRes] =
    await Promise.all([
      getKorda({ limit: 100 }),
      getDropPoints(),
      getRegistrationsAction({
        eventId: activeEvent.id,
        journeyType: journeyType as "all" | "both" | "return_only" | "outbound_only",
        status: status as RegistrationStatus | "all",
        outboundKordaId: kordaId,
        returnKordaId: kordaId,
        dropPointId,
        search,
        page,
        pageSize,
      }),
      getStatsAction(activeEvent.id),
    ]);

  const kordas =
    kordasRes.success && kordasRes.data
      ? Array.isArray(kordasRes.data)
        ? kordasRes.data
        : kordasRes.data.items
      : [];

  const dropPoints =
    dropPointsRes.success && dropPointsRes.data ? dropPointsRes.data : [];

  const registrations = registrationsRes.success ? registrationsRes.data : [];
  const total = registrationsRes.success ? registrationsRes.total : 0;
  const stats = statsRes.success ? statsRes.data : null;

  return (
    <>
      <RegistrationNavigation />
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b">
          <div className="mx-auto max-w-7xl px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Daftar Peserta Terdaftar</div>
                <div className="text-sm text-muted-foreground">{activeEvent.name}</div>
              </div>
              <PrintButton
                eventId={activeEvent.id}
                kordas={kordas}
                dropPoints={dropPoints}
              />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
          {/* Stats Cards */}
          {stats && <RegistrationStatsCards stats={stats} />}

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filter Peserta</CardTitle>
              <CardDescription>
                Filter berdasarkan jenis perjalanan, status, korda, atau drop point
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RegistrationFilters kordas={kordas} dropPoints={dropPoints} />
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Daftar Registrasi</CardTitle>
              <CardDescription>
                Total {total} peserta terdaftar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RegistrationsTable
                registrations={registrations}
                total={total}
                currentPage={page}
                pageSize={pageSize}
              />
            </CardContent>
          </Card>
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

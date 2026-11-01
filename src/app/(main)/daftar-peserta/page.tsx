import { getKorda } from "@/features/master/actions/korda.action";
import { getDropPoints } from "@/features/drop-points/actions/drop-point.action";
import {
  getRegistrationsAction,
  getStatsAction,
} from "@/features/registrations-management/actions/registrations-management.actions";
import type { JourneyStatus } from "@/generated/prisma/client";
import { RegistrationNavigation } from "@/features/registrations-management/components/RegistrationNavigation";
import { RegistrationStatsCards } from "@/features/registrations-management/components/RegistrationStatsCards";
import { RegistrationFilters } from "@/features/registrations-management/components/RegistrationFilters";
import { RegistrationsTable } from "@/features/registrations-management/components/RegistrationsTable";
import { PrintButton } from "@/features/registrations-management/components/PrintButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getGlobalEventContext } from "@/server/event-context";
import { getRegionalAccessScope } from "@/server/access-scope";
import { EventScopeBanner } from "@/features/event/components/EventScopeBanner";

interface PageProps {
  searchParams?: Promise<{
    journeyType?: string;
    status?: string;
    paymentStatus?: string;
    gender?: string;
    kordaId?: string;
    dropPointId?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function DaftarPesertaPage({ searchParams }: PageProps) {
  const [{ selectedEvent: activeEvent }, scope] = await Promise.all([getGlobalEventContext(), getRegionalAccessScope()]);

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

  // Parse search params
  const params = await searchParams;
  const journeyType = params?.journeyType || "all";
  const status = params?.status === "REGISTERED" || params?.status === "CANCELLED" ? params.status : "all";
  const paymentStatus = params?.paymentStatus === "PAID" || params?.paymentStatus === "PARTIAL" || params?.paymentStatus === "UNPAID" || params?.paymentStatus === "CANCELLED" || params?.paymentStatus === "UNKNOWN" ? params.paymentStatus : "all";
  const gender =
    params?.gender === "Laki-laki" || params?.gender === "Perempuan"
      ? params.gender
      : undefined;
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
        status: status as JourneyStatus | "all",
        paymentStatus,
        gender,
        outboundKordaId: kordaId,
        returnKordaId: kordaId,
        dropPointId,
        search,
        page,
        pageSize,
      }),
      getStatsAction({
        eventId: activeEvent.id,
        journeyType: journeyType as "all" | "both" | "return_only" | "outbound_only",
        status: status as JourneyStatus | "all",
        paymentStatus,
        gender,
        outboundKordaId: kordaId,
        returnKordaId: kordaId,
        dropPointId,
        search,
      }),
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold">Daftar Peserta</h1>
                <div className="text-sm text-muted-foreground">{activeEvent.name}</div>
              </div>
              <PrintButton />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
          <EventScopeBanner eventName={activeEvent.name} status={activeEvent.status} />
          {/* Stats Cards */}
          {stats && <RegistrationStatsCards stats={stats} />}

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filter Peserta</CardTitle>
              <CardDescription>
                Saring peserta menurut arah Pulang/Kembali, status perjalanan dan pembayaran, Korda tujuan, atau titik perjalanan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RegistrationFilters
                eventId={activeEvent.id}
                kordas={kordas}
                dropPoints={dropPoints}
              />
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Rincian Peserta</CardTitle>
              <CardDescription>{total} peserta pada event terpilih</CardDescription>
            </CardHeader>
            <CardContent>
              <RegistrationsTable
                registrations={registrations}
                total={total}
                currentPage={page}
                pageSize={pageSize}
                canWrite={activeEvent.status === "ACTIVE"}
                canPurge={scope.role === "admin"}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

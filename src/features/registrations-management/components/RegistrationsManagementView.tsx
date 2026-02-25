"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RegistrationStatsCards } from "./RegistrationStatsCards";
import { RegistrationFilters } from "./RegistrationFilters";
import { RegistrationsTable } from "./RegistrationsTable";
import { MultiParticipantRegistrationForm } from "@/features/registration/components/MultiParticipantRegistrationForm";
import type { RegistrationWithDetails, RegistrationStats } from "../repositories/registrations.repository";
import type { Korda } from "@/features/master/types";
import type { DropPoint } from "@/features/drop-points/types";

interface RegistrationsManagementViewProps {
  eventId: string;
  eventName: string;
  registrations: RegistrationWithDetails[];
  total: number;
  currentPage: number;
  pageSize: number;
  stats: RegistrationStats | null;
  kordas: Korda[];
  dropPoints: DropPoint[];
}

export function RegistrationsManagementView({
  eventId,
  eventName,
  registrations,
  total,
  currentPage,
  pageSize,
  stats,
  kordas,
  dropPoints,
}: RegistrationsManagementViewProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="text-lg font-semibold">Manajemen Registrasi</div>
          <div className="text-sm text-muted-foreground">{eventName}</div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <Tabs defaultValue="list" className="space-y-6">
          <TabsList>
            <TabsTrigger value="list">
              Daftar Peserta ({total})
            </TabsTrigger>
            <TabsTrigger value="register">Daftar Baru</TabsTrigger>
          </TabsList>

          {/* Tab: Daftar Peserta */}
          <TabsContent value="list" className="space-y-6">
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
                <RegistrationFilters
                  eventId={eventId}
                  kordas={kordas}
                  dropPoints={dropPoints}
                />
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
                  currentPage={currentPage}
                  pageSize={pageSize}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Daftar Baru */}
          <TabsContent value="register">
            <MultiParticipantRegistrationForm
              eventId={eventId}
              eventName={eventName}
              kordas={kordas}
              dropPoints={dropPoints}
              defaultMode="both"
              lockMode={false}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

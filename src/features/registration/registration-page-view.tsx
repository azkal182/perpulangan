"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiParticipantRegistrationForm } from "./components/MultiParticipantRegistrationForm";
import { RegistrationList } from "./components/RegistrationList";
import type { Registration, Korda } from "./types";
import type { DropPoint } from "@/features/drop-points/types";

type Props = {
  eventId: string;
  eventName: string;
  initialKordas: Korda[];
  initialDropPoints: DropPoint[];
  initialRegistrations: Registration[];
  defaultKordaId?: string | null;
  pageTitle?: string;
  defaultMode?: 'both' | 'return_only';
  lockMode?: boolean;
};

export default function RegistrationPageView({
  eventId,
  eventName,
  initialKordas,
  initialDropPoints,
  initialRegistrations,
  defaultKordaId = null,
  pageTitle = "Pendaftaran Peserta Rombongan",
  defaultMode = "both",
  lockMode = false,
}: Props) {
  const registrations = initialRegistrations;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="text-lg font-semibold">{pageTitle}</div>
          <div className="text-sm text-muted-foreground">{eventName}</div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <Tabs defaultValue="register" className="space-y-4">
          <TabsList>
            <TabsTrigger value="register">Daftar Baru</TabsTrigger>
            <TabsTrigger value="list">Daftar Peserta ({registrations.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="register">
            <MultiParticipantRegistrationForm
              eventId={eventId}
              eventName={eventName}
              kordas={initialKordas}
              dropPoints={initialDropPoints}
              defaultKordaId={defaultKordaId}
              defaultMode={defaultMode}
              lockMode={lockMode}
            />
          </TabsContent>

          <TabsContent value="list" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Peserta Terdaftar</CardTitle>
                <CardDescription>
                  Daftar semua peserta yang sudah terdaftar untuk event ini
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RegistrationList
                  registrations={registrations}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

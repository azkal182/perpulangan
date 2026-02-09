"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiParticipantRegistrationForm } from "./components/MultiParticipantRegistrationForm";
import { RegistrationList } from "./components/RegistrationList";
import {
  deleteRegistration,
  confirmKordaChange,
} from "./actions/registration.action";
import type { Registration, Student, Korda } from "./types";
import type { DropPoint } from "@/features/drop-points/types";

type Props = {
  eventId: string;
  eventName: string;
  initialKordas: Korda[];
  initialDropPoints: DropPoint[];
  initialRegistrations: Registration[];
};

export default function RegistrationPageView({
  eventId,
  eventName,
  initialKordas,
  initialDropPoints,
  initialRegistrations,
}: Props) {
  const registrations = initialRegistrations;

  async function handleDelete(id: string) {
    const result = await deleteRegistration(id);
    if (result.success) {
      window.location.reload();
    } else {
      alert(result.error || "Gagal menghapus");
    }
  }

  async function handleConfirmKordaChange(id: string) {
    const result = await confirmKordaChange(id);
    if (result.success) {
      window.location.reload();
    } else {
      alert(result.error || "Gagal konfirmasi");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="text-lg font-semibold">Pendaftaran Peserta Rombongan</div>
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
                  onDelete={handleDelete}
                  onConfirmKordaChange={handleConfirmKordaChange}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

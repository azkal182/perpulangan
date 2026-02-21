import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEvent } from "@/features/event/services/event.service";
import { getKorda } from "@/features/master/actions/korda.action";
import { getDropPoints } from "@/features/drop-points/actions/drop-point.action";
import { RegistrationNavigation } from "@/features/registrations-management/components/RegistrationNavigation";
import { PrintWorkspace } from "@/features/registrations-management/components/PrintDialog";

export default async function CetakDokumenPage() {
  const activeEvent = await getActiveEvent();

  if (!activeEvent) {
    return (
      <>
        <RegistrationNavigation />
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Tidak Ada Event Aktif</h1>
            <p className="text-muted-foreground">
              Silakan aktifkan event terlebih dahulu untuk mengakses halaman cetak.
            </p>
          </div>
        </div>
      </>
    );
  }

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
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
            <div>
              <div className="text-lg font-semibold">Cetak Kartu & Tiket</div>
              <div className="text-sm text-muted-foreground">{activeEvent.name}</div>
            </div>
            <Button asChild variant="outline">
              <Link href="/daftar-peserta">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali ke Daftar Peserta
              </Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-6">
          <Card>
            <CardHeader>
              <CardTitle>Panel Cetak</CardTitle>
              <CardDescription>
                Pilih jenis dokumen, filter data, lalu preview sebelum generate PDF.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PrintWorkspace
                eventId={activeEvent.id}
                kordas={kordas}
                dropPoints={dropPoints}
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

import type { Metadata } from "next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { getOutboundRoster } from "@/features/outbound-roster/actions/outbound-roster.actions";
import { OutboundRosterManager } from "@/features/outbound-roster/components/OutboundRosterManager";
import prisma from "@/lib/prisma";
import { getRegionalAccessScope } from "@/server/access-scope";

export const metadata: Metadata = { title: "Data Pulang" };

export default async function DataPulangPage({ searchParams }: { searchParams: Promise<{ eventId?: string; q?: string; page?: string; view?: string }> }) {
  const [scope, params] = await Promise.all([getRegionalAccessScope(), searchParams]);
  const events = await prisma.event.findMany({ select: { id: true, name: true, status: true, startDate: true }, orderBy: [{ startDate: "desc" }, { createdAt: "desc" }] });
  const selectedEventId = events.some((event) => event.id === params.eventId)
    ? params.eventId!
    : (events.find((event) => event.status === "ACTIVE") ?? events[0])?.id ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const result = selectedEventId ? await getOutboundRoster(selectedEventId, params.q, page) : null;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Data Pulang</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Pantau santri aktif yang belum terdaftar untuk perjalanan Pulang, catat pengecualian, dan lihat santri yang sudah terdaftar untuk event.</p>
      </header>
      <Card>
        <CardContent className="p-4">
          {events.length ? (
            <form action="/data-pulang" className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="grid flex-1 gap-1.5 text-sm font-medium">Event
                <select name="eventId" defaultValue={selectedEventId} className="h-10 rounded-md border bg-background px-3 font-normal">
                  {events.map((event) => <option key={event.id} value={event.id}>{event.name}{event.status === "COMPLETED" ? " · Selesai" : event.status === "DRAFT" ? " · Draft" : ""}</option>)}
                </select>
              </label>
              <label className="grid flex-1 gap-1.5 text-sm font-medium">Cari santri
                <input name="q" defaultValue={params.q ?? ""} placeholder="Nama atau NIS" className="h-10 rounded-md border bg-background px-3 font-normal" />
              </label>
              <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Tampilkan</button>
            </form>
          ) : <p className="text-sm text-muted-foreground">Belum ada event.</p>}
        </CardContent>
      </Card>
      {!events.length ? null : result?.success ? (
        <OutboundRosterManager data={result} canManage={scope.role === "admin"} search={params.q ?? ""} page={page} pageSize={50} view={params.view ?? "candidates"} />
      ) : (
        <Alert variant="destructive"><AlertDescription>{result && !result.success ? result.error : "Pilih event untuk melihat daftar Pulang."}</AlertDescription></Alert>
      )}
    </main>
  );
}

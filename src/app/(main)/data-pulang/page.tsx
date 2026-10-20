import type { Metadata } from "next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { getOutboundRoster } from "@/features/outbound-roster/actions/outbound-roster.actions";
import { OutboundRosterManager } from "@/features/outbound-roster/components/OutboundRosterManager";
import { getRegionalAccessScope } from "@/server/access-scope";
import { getEventContext } from "@/server/event-context";

export const metadata: Metadata = { title: "Data Pulang" };

export default async function DataPulangPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; view?: string }> }) {
  const [scope, params] = await Promise.all([getRegionalAccessScope(), searchParams]);
  const eventContext = await getEventContext(scope);
  const events = eventContext.events;
  const selectedEventId = eventContext.selectedEvent?.id ?? "";
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
          {selectedEventId ? (
            <form action="/data-pulang" className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="grid flex-1 gap-1.5 text-sm font-medium">Cari santri
                <input name="q" defaultValue={params.q ?? ""} placeholder="Nama atau NIS" className="h-10 rounded-md border bg-background px-3 font-normal" />
              </label>
              <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Tampilkan</button>
            </form>
          ) : <p className="text-sm text-muted-foreground">Pilih event di header untuk melihat daftar Pulang. Jika belum ada event yang bisa dipilih, admin perlu membuat atau mengaktifkan event.</p>}
        </CardContent>
      </Card>
      {!events.length ? null : result?.success ? (
        <OutboundRosterManager data={result} canManage={scope.role === "admin" && result.event.status === "ACTIVE"} search={params.q ?? ""} page={page} pageSize={50} view={params.view ?? "candidates"} />
      ) : (
        <Alert variant="destructive"><AlertDescription>{result && !result.success ? result.error : "Pilih event untuk melihat daftar Pulang."}</AlertDescription></Alert>
      )}
    </main>
  );
}

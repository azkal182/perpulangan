"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setGlobalEventSelection } from "../actions/event-selection.actions";

type Props = {
  events: Array<{ id: string; name: string; status: "DRAFT" | "ACTIVE" | "COMPLETED" }>;
  selectedEventId: string;
};

export function GlobalEventSelector({ events, selectedEventId }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onChange(eventId: string) {
    startTransition(async () => {
      const result = await setGlobalEventSelection(eventId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const url = new URL(window.location.href);
      url.searchParams.delete("event");
      url.searchParams.delete("eventId");
      const query = url.searchParams.toString();
      router.replace(`${url.pathname}${query ? `?${query}` : ""}`);
      router.refresh();
    });
  }

  const selected = events.find((event) => event.id === selectedEventId);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <CalendarDays className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
      <Select value={selectedEventId} onValueChange={onChange} disabled={pending || events.length === 0}>
        <SelectTrigger className="h-9 w-[min(42vw,13rem)] min-w-0 border-0 bg-muted/60 px-2 text-xs shadow-none sm:w-56 sm:px-3 sm:text-sm" aria-label="Pilih event aplikasi">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <SelectValue placeholder="Pilih event" />}
        </SelectTrigger>
        <SelectContent align="end">
          {events.map((event) => (
            <SelectItem key={event.id} value={event.id}>
              <span className="truncate">{event.name}{event.status === "ACTIVE" ? " · Aktif" : event.status === "COMPLETED" ? " · Selesai" : " · Draft"}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {events.length === 0 && <span role="status" className="text-[10px] text-muted-foreground sm:text-xs">Belum ada event · hubungi admin</span>}
      {selected?.status === "ACTIVE" && <span className="sr-only">Event aktif</span>}
    </div>
  );
}

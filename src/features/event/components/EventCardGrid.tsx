import CardEvent from "@/features/event/components/CardEvent";
import { getEvents } from "@/features/event/services/events.db";
import type { EventStatus } from "@/features/event/types";
import { EventRowActions } from "@/features/event/components/EventRowActions.client";

function formatDateRange(start: Date, end: Date) {
  const fmt = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${fmt.format(new Date(start))} - ${fmt.format(new Date(end))}`;
}

function statusLabel(status: EventStatus) {
  if (status === "ACTIVE") return "Aktif";
  if (status === "DRAFT") return "Draft";
  return "Selesai";
}

function statusVariant(status: EventStatus) {
  if (status === "ACTIVE") return "secondary";
  if (status === "DRAFT") return "outline";
  return "default";
}

export async function EventCardGrid() {
  const rows = await getEvents();
  console.log(rows)

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {rows.map((event) => {
        const eventForClient = {
          id: event.id,
          name: event.name,
          startDate: event.startDate.toISOString(),
          endDate: event.endDate.toISOString(),
          status: event.status,
          trackerEventId: event.trackerEventId,
        };

        return (
          <CardEvent
            key={event.id}
            title={event.name}
            date={formatDateRange(event.startDate, event.endDate)}
            status={statusLabel(event.status)}
            statusVariant={statusVariant(event.status)}
            santri={`${event._count.registrations}/3`}
            payment={`Rp ${event.payment.totalPaid.toLocaleString()}`}
            progress={event._count.registrations / 3 * 100}
            actions={<EventRowActions event={eventForClient} />}
          />
        );
      })}

      {rows.length === 0 ? (
        <div className="col-span-full rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Data tidak tersedia.
        </div>
      ) : null}
    </div>
  );
}

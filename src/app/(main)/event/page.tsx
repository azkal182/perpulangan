import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EventFormDialog } from "@/features/event/components/EventFormDialog.client";
import { EventCardGrid } from "@/features/event/components/EventCardGrid";

export default function EventPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Event</h1>
          <p className="text-muted-foreground">
            Kelola event perpulangan santri
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Input className="w-full sm:w-64" placeholder="Cari event" />
          <EventFormDialog
            mode="create"
            trigger={<Button className="shrink-0">Tambah Event</Button>}
          />
        </div>
      </div>

      <EventCardGrid />
    </div>
  );
}

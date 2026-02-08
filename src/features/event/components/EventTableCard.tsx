import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { getEvents } from "@/features/event/services/events.db";
import type { EventStatus } from "@/features/event/types";
import { EventRowActions } from "./EventRowActions.client";

function formatDateRange(start: Date, end: Date) {
  const fmt = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${fmt.format(new Date(start))} - ${fmt.format(new Date(end))}`;
}

function statusBadgeVariant(status: EventStatus) {
  if (status === "ACTIVE") return "secondary";
  if (status === "DRAFT") return "outline";
  return "default";
}

function statusLabel(status: EventStatus) {
  if (status === "ACTIVE") return "Aktif";
  if (status === "DRAFT") return "Draft";
  return "Selesai";
}

export async function EventTableCard() {
  const rows = await getEvents();

  return (
    <Card className="w-full">
      <CardHeader className="pb-0" />

      <CardContent className="pt-0">
        <div className="w-full overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[320px]">Nama Event</TableHead>
                <TableHead className="w-[260px]">Tanggal</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[220px]">Santri</TableHead>
                <TableHead className="w-[180px]">Pembayaran</TableHead>
                <TableHead className="w-[56px]" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((event) => {
                const eventForClient = {
                  id: event.id,
                  name: event.name,
                  startDate: event.startDate.toISOString(),
                  endDate: event.endDate.toISOString(),
                  status: event.status,
                };

                return (
                <TableRow key={event.id}>
                  <TableCell>
                    <div className="font-medium">{event.name}</div>
                    <div className="text-xs text-muted-foreground">
                      ID: {event.id}
                    </div>
                  </TableCell>

                  <TableCell className="opacity-80">
                    {formatDateRange(event.startDate, event.endDate)}
                  </TableCell>

                  <TableCell>
                    <Badge variant={statusBadgeVariant(event.status)}>
                      {statusLabel(event.status)}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-2">
                      <Progress value={0} />
                      <div className="text-xs text-muted-foreground">
                        0/0 lunas
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    Rp -
                  </TableCell>

                  <TableCell className="text-right">
                    <EventRowActions event={eventForClient} />
                  </TableCell>
                </TableRow>
                );
              })}

              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center opacity-70"
                  >
                    Data tidak tersedia.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between">
        <div className="text-sm opacity-70">Total {rows.length} event</div>
      </CardFooter>
    </Card>
  );
}

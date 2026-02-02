import { Calendar, ChevronRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Event {
  id: string;
  name: string;
  date: string;
  status: "draft" | "aktif" | "selesai";
  totalSantri: number;
  totalLunas: number;
}

const mockEvents: Event[] = [
  {
    id: "1",
    name: "Liburan Ramadhan 2026",
    date: "15 Mar - 20 Apr 2026",
    status: "aktif",
    totalSantri: 245,
    totalLunas: 180,
  },
  {
    id: "2",
    name: "Liburan Semester Genap 2026",
    date: "10 Jun - 15 Jul 2026",
    status: "draft",
    totalSantri: 0,
    totalLunas: 0,
  },
  {
    id: "3",
    name: "Liburan Akhir Tahun 2025",
    date: "20 Des - 5 Jan 2026",
    status: "selesai",
    totalSantri: 320,
    totalLunas: 320,
  },
];

const statusConfig = {
  draft: { label: "Draft", className: "badge-draft" },
  aktif: { label: "Aktif", className: "badge-aktif" },
  selesai: { label: "Selesai", className: "badge-lunas" },
};

export function RecentEvents() {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Event Terbaru</h3>
        <Button variant="ghost" size="sm" className="text-primary">
          Lihat Semua
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        {mockEvents.map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {event.name}
              </p>
              <p className="text-sm text-muted-foreground">{event.date}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{event.totalSantri}</span>
                </div>
                {event.totalSantri > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {Math.round((event.totalLunas / event.totalSantri) * 100)}%
                    lunas
                  </p>
                )}
              </div>
              <Badge
                className={cn("text-xs", statusConfig[event.status].className)}
              >
                {statusConfig[event.status].label}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

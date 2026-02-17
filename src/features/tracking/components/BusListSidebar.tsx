"use client";

import { RefreshCw, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Bus {
  id: string;
  label: string;
  trackerId: string | null;
  isActive: boolean;
  korwil: { id: string; name: string } | null;
  kordas: Array<{ id: string; name: string }>;
}

interface Event {
  id: string;
  name: string;
}

interface Korda {
  id: string;
  name: string;
}

interface BusListSidebarProps {
  events: Event[];
  buses: Bus[];
  kordas: Korda[];
  selectedEventId: string;
  selectedKordaId: string | undefined;
  selectedBusIds: Set<string>;
  onEventChange: (eventId: string) => void;
  onKordaChange: (kordaId: string | undefined) => void;
  onBusToggle: (busId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  lastUpdate: Date | null;
  isRefreshing: boolean;
}

export function BusListSidebar({
  events,
  buses,
  kordas,
  selectedEventId,
  selectedKordaId,
  selectedBusIds,
  onEventChange,
  onKordaChange,
  onBusToggle,
  onSelectAll,
  onDeselectAll,
  lastUpdate,
  isRefreshing,
}: BusListSidebarProps) {
  return (
    <div className="w-80 border rounded-lg p-4 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold mb-4">GPS Tracking</h2>
        
        {/* Event Selector */}
        <div className="space-y-2 mb-4">
          <label className="text-sm font-medium">Event</label>
          <Select value={selectedEventId} onValueChange={onEventChange}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih event" />
            </SelectTrigger>
            <SelectContent>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {events.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Belum ada event yang di-sync. Sync event di halaman Events dulu.
            </p>
          )}
        </div>

        {/* Korda Filter */}
        {selectedEventId && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Filter by Korda</label>
            <Select 
              value={selectedKordaId || "all"} 
              onValueChange={(v) => onKordaChange(v === "all" ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Semua korda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Korda</SelectItem>
                {kordas.map((korda) => (
                  <SelectItem key={korda.id} value={korda.id}>
                    {korda.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Bus List */}
      {selectedEventId && (
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Bus ({selectedBusIds.size}/{buses.length})
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={onSelectAll}
                disabled={buses.length === 0}
                className="h-7 text-xs"
              >
                <CheckSquare className="h-3 w-3 mr-1" />
                All
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDeselectAll}
                disabled={selectedBusIds.size === 0}
                className="h-7 text-xs"
              >
                <Square className="h-3 w-3 mr-1" />
                None
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 border rounded-md">
            <div className="p-2 space-y-2">
              {buses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Belum ada bus untuk event ini
                </p>
              ) : (
                buses.map((bus) => (
                  <div
                    key={bus.id}
                    className="flex items-start gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                    onClick={() => onBusToggle(bus.id)}
                  >
                    <Checkbox
                      checked={selectedBusIds.has(bus.id)}
                      onCheckedChange={() => onBusToggle(bus.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {bus.label}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {bus.kordas.map((korda) => (
                          <Badge
                            key={korda.id}
                            variant="outline"
                            className="text-xs"
                          >
                            {korda.name}
                          </Badge>
                        ))}
                      </div>
                      {!bus.isActive && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          Nonaktif
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Last Update Info */}
          {lastUpdate && (
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Last update: {lastUpdate.toLocaleTimeString()}</span>
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

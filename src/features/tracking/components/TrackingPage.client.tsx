"use client";

import "leaflet/dist/leaflet.css";

import { useState, useEffect } from "react";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getTrackingEvents,
  getBusesForTracking,
  getGPSPositions,
  getKordasForFilter,
} from "../actions/tracking.actions";
import type { MonitoringData } from "@/services/tracker-api.service";
import { BusListSidebar } from "./BusListSidebar";
import { TrackingMap } from "./TrackingMap";

type Event = Awaited<ReturnType<typeof getTrackingEvents>>[0];
type Bus = Awaited<ReturnType<typeof getBusesForTracking>>[0];
type Korda = Awaited<ReturnType<typeof getKordasForFilter>>[0];

export default function TrackingPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [kordas, setKordas] = useState<Korda[]>([]);
  
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedKordaId, setSelectedKordaId] = useState<string | undefined>(undefined);
  const [selectedBusIds, setSelectedBusIds] = useState<Set<string>>(new Set());
  
  const [gpsData, setGpsData] = useState<MonitoringData[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [fetchingGPS, setFetchingGPS] = useState(false);
  
  // Mobile sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load buses when event or korda filter changes
  useEffect(() => {
    if (selectedEventId) {
      loadBuses();
    } else {
      setBuses([]);
      setSelectedBusIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, selectedKordaId]);

  // Auto-refresh GPS positions every 30 seconds
  useEffect(() => {
    if (!selectedEventId) return;
    
    fetchGPSData();
    const interval = setInterval(fetchGPSData, 30000); // 30s
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  async function loadInitialData() {
    try {
      const [eventsData, kordasData] = await Promise.all([
        getTrackingEvents(),
        getKordasForFilter(),
      ]);
      
      setEvents(eventsData);
      setKordas(kordasData);
      
      // Auto-select first event
      if (eventsData.length > 0) {
        setSelectedEventId(eventsData[0].id);
      }
    } catch (error) {
      console.error("Failed to load initial data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadBuses() {
    try {
      const busesData = await getBusesForTracking({
        eventId: selectedEventId,
        kordaId: selectedKordaId,
      });
      setBuses(busesData);
      
      // Clear selections if filtered buses changed
      setSelectedBusIds(new Set());
    } catch (error) {
      console.error("Failed to load buses:", error);
    }
  }

  async function fetchGPSData() {
    if (!selectedEventId) return;
    
    setFetchingGPS(true);
    try {
      const result = await getGPSPositions(selectedEventId);
      if (result.success) {
        setGpsData(result.data);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error("Failed to fetch GPS data:", error);
    } finally {
      setFetchingGPS(false);
    }
  }

  function toggleBusSelection(busId: string) {
    setSelectedBusIds(prev => {
      const next = new Set(prev);
      if (next.has(busId)) {
        next.delete(busId);
      } else {
        next.add(busId);
      }
      return next;
    });
  }

  function selectAllBuses() {
    setSelectedBusIds(new Set(buses.map(b => b.id)));
  }

  function deselectAllBuses() {
    setSelectedBusIds(new Set());
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Get buses with GPS data for map
  const busesWithGPS = buses
    .filter(bus => selectedBusIds.has(bus.id))
    .map(bus => {
      const gps = gpsData.find(g => g.id === bus.trackerId);
      return {
        ...bus,
        gps,
      };
    })
    .filter((bus): bus is Bus & { gps: MonitoringData } => 
      bus.gps !== undefined && bus.gps.lat !== null && bus.gps.lon !== null
    );

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-8rem)] gap-4">
      {/* Mobile: Collapsible sidebar */}
      <div className="lg:hidden w-full">
        <Button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          variant="outline"
          className="w-full mb-2 flex items-center justify-between"
        >
          <span>Filters & Bus Selection ({selectedBusIds.size} selected)</span>
          {isSidebarCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
        
        {!isSidebarCollapsed && (
          <div className="max-h-[50vh] overflow-hidden">
            <BusListSidebar
              events={events}
              buses={buses}
              kordas={kordas}
              selectedEventId={selectedEventId}
              selectedKordaId={selectedKordaId}
              selectedBusIds={selectedBusIds}
              onEventChange={setSelectedEventId}
              onKordaChange={setSelectedKordaId}
              onBusToggle={toggleBusSelection}
              onSelectAll={selectAllBuses}
              onDeselectAll={deselectAllBuses}
              lastUpdate={lastUpdate}
              isRefreshing={fetchingGPS}
            />
          </div>
        )}
      </div>

      {/* Desktop: Always visible sidebar */}
      <div className="hidden lg:block">
        <BusListSidebar
          events={events}
          buses={buses}
          kordas={kordas}
          selectedEventId={selectedEventId}
          selectedKordaId={selectedKordaId}
          selectedBusIds={selectedBusIds}
          onEventChange={setSelectedEventId}
          onKordaChange={setSelectedKordaId}
          onBusToggle={toggleBusSelection}
          onSelectAll={selectAllBuses}
          onDeselectAll={deselectAllBuses}
          lastUpdate={lastUpdate}
          isRefreshing={fetchingGPS}
        />
      </div>
      
      {/* Map - Full width on mobile, 70% on desktop */}
      <div className="flex-1 rounded-lg border overflow-hidden min-h-[400px] lg:min-h-0">
        <TrackingMap buses={busesWithGPS} />
      </div>
    </div>
  );
}


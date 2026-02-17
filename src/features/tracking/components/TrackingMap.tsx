"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { MonitoringData } from "@/services/tracker-api.service";

// Fix Leaflet default icon issue in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface Bus {
  id: string;
  label: string;
  trackerId: string | null;
  isActive: boolean;
  korwil: { id: string; name: string } | null;
  kordas: Array<{ id: string; name: string }>;
  gps?: MonitoringData;
}

interface TrackingMapProps {
  buses: Array<Bus & { gps: MonitoringData }>;
}

// Component to auto-fit map bounds
function MapBounds({ buses }: { buses: Array<Bus & { gps: MonitoringData }> }) {
  const map = useMap();

  useEffect(() => {
    if (buses.length === 0) return;

    const bounds = buses
      .filter(b => b.gps.lat !== null && b.gps.lon !== null)
      .map(b => [b.gps.lat!, b.gps.lon!] as [number, number]);

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [buses, map]);

  return null;
}

export function TrackingMap({ buses }: TrackingMapProps) {
  const center: [number, number] = useMemo(() => {
    if (buses.length === 0) {
      // Default to Indonesia center
      return [-2.548926, 118.0148634];
    }
    
    const firstBus = buses[0];
    if (firstBus.gps.lat !== null && firstBus.gps.lon !== null) {
      return [firstBus.gps.lat, firstBus.gps.lon];
    }
    
    return [-2.548926, 118.0148634];
  }, [buses]);

  return (
    <div className="w-full h-full relative">
      {buses.length === 0 ? (
        <div className="flex items-center justify-center h-full bg-muted">
          <div className="text-center text-muted-foreground">
            <div className="text-lg font-medium mb-2">No buses selected</div>
            <div className="text-sm">Select buses from the sidebar to see their GPS positions</div>
          </div>
        </div>
      ) : (
        <MapContainer
          center={center}
          zoom={6}
          className="h-full w-full"
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapBounds buses={buses} />

          {buses.map((bus) => {
            if (!bus.gps || bus.gps.lat === null || bus.gps.lon === null) {
              return null;
            }

            return (
              <Marker
                key={bus.id}
                position={[bus.gps.lat, bus.gps.lon]}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <div className="font-semibold text-base mb-2">{bus.label}</div>
                    
                    <div className="space-y-1 text-sm">
                      {bus.kordas.length > 0 && (
                        <div>
                          <span className="font-medium">Kordas:</span>{" "}
                          {bus.kordas.map(k => k.name).join(", ")}
                        </div>
                      )}
                      
                      {bus.gps.speed !== null && (
                        <div>
                          <span className="font-medium">Speed:</span> {bus.gps.speed.toFixed(1)} km/h
                        </div>
                      )}
                      
                      {bus.gps.heading !== null && (
                        <div>
                          <span className="font-medium">Heading:</span> {bus.gps.heading.toFixed(0)}°
                        </div>
                      )}
                      
                      {bus.gps.accuracy !== null && (
                        <div>
                          <span className="font-medium">Accuracy:</span> ±{bus.gps.accuracy.toFixed(1)}m
                        </div>
                      )}
                      
                      {bus.gps.last_seen_at && (
                        <div>
                          <span className="font-medium">Last seen:</span>{" "}
                          {new Date(bus.gps.last_seen_at).toLocaleString()}
                        </div>
                      )}
                      
                      <div className="text-xs text-muted-foreground mt-2">
                        {bus.gps.lat.toFixed(6)}, {bus.gps.lon.toFixed(6)}
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      )}
    </div>
  );
}

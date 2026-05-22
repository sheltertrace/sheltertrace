"use client";

// Must be loaded via dynamic(() => import(...), { ssr: false }) — Leaflet requires browser globals.
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import type { OfficerFieldProfile, LocationHistory } from "@/lib/types";

// Fix broken default icon URLs in Next.js / webpack builds
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Morgan County, GA shelter coordinates
const MCAS_CENTER: [number, number] = [33.598, -83.454];

const STATUS_COLORS: Record<string, { fill: string; text: string }> = {
  "On Duty":  { fill: "#16a34a", text: "#fff" },
  "En Route": { fill: "#d97706", text: "#fff" },
  "On Scene": { fill: "#2563eb", text: "#fff" },
  "Available":{ fill: "#0891b2", text: "#fff" },
  "Break":    { fill: "#dc2626", text: "#fff" },
  "Off Duty": { fill: "#9ca3af", text: "#fff" },
};

function elapsed(ts?: string | null): string {
  if (!ts) return "Unknown";
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

function makeOfficerIcon(officer: OfficerFieldProfile): L.DivIcon {
  const sc = STATUS_COLORS[officer.current_field_status] ?? STATUS_COLORS["Off Duty"];
  const initial = (officer.first_name?.[0] ?? "?").toUpperCase();
  const isTracking = officer.tracking_active;
  const pulse = isTracking
    ? `<span style="position:absolute;top:-3px;right:-3px;width:10px;height:10px;border-radius:50%;background:#4ade80;border:2px solid #fff;animation:gps-pulse 1.5s infinite;"></span>`
    : "";
  return L.divIcon({
    className: "",
    html: `
      <style>
        @keyframes gps-pulse {
          0%,100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
      </style>
      <div style="position:relative;width:36px;height:36px;">
        <div style="
          width:36px;height:36px;border-radius:50%;
          background:${sc.fill};border:3px solid #fff;
          box-shadow:0 2px 8px rgba(0,0,0,0.35);
          display:flex;align-items:center;justify-content:center;
          font-size:14px;font-weight:800;color:${sc.text};
          font-family:-apple-system,sans-serif;
        ">${initial}</div>
        ${pulse}
      </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

function makeCallIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="width:20px;height:20px;background:#dc2626;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

// Recenter map when officer list changes to fit all markers
function AutoFit({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (positions.length === 0 || fitted.current) return;
    if (positions.length === 1) {
      map.setView(positions[0], 13);
    } else {
      map.fitBounds(L.latLngBounds(positions), { padding: [48, 48], maxZoom: 14 });
    }
    fitted.current = true;
  }, [positions.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export interface CallPin {
  lat: number;
  lng: number;
  label: string;
}

interface Props {
  officers: OfficerFieldProfile[];
  callPins?: CallPin[];
  todayRoutes?: Record<string, LocationHistory[]>; // officerId → ordered pings
  height?: number;
}

export default function OfficerMap({ officers, callPins = [], todayRoutes = {}, height = 480 }: Props) {
  const onDuty = officers.filter(
    (o) => o.current_field_status !== "Off Duty" &&
           o.last_location_lat != null &&
           o.last_location_lng != null
  );

  const positions: [number, number][] = [
    ...onDuty.map((o) => [o.last_location_lat!, o.last_location_lng!] as [number, number]),
    ...callPins.map((p) => [p.lat, p.lng] as [number, number]),
  ];

  return (
    <div style={{ height, borderRadius: 12, overflow: "hidden", border: "1px solid #d1d5db", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" }}>
      <MapContainer
        center={MCAS_CENTER}
        zoom={12}
        style={{ width: "100%", height: "100%" }}
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <AutoFit positions={positions} />

        {/* Officer markers */}
        {onDuty.map((o) => (
          <Marker
            key={o.id}
            position={[o.last_location_lat!, o.last_location_lng!]}
            icon={makeOfficerIcon(o)}
          >
            <Popup>
              <div style={{ fontFamily: "-apple-system, sans-serif", minWidth: 180 }}>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>
                  {o.first_name} {o.last_name}
                  {o.badge ? <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}> · Badge {o.badge}</span> : null}
                </div>
                <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: (STATUS_COLORS[o.current_field_status] ?? STATUS_COLORS["Off Duty"]).fill, color: "#fff", marginBottom: 6 }}>
                  {o.current_field_status}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Updated: {elapsed(o.last_status_update)}
                </div>
                {o.tracking_active && (
                  <div style={{ fontSize: 11, color: "#16a34a", marginTop: 4, fontWeight: 600 }}>
                    ● GPS Active
                  </div>
                )}
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
                  {o.last_location_lat?.toFixed(5)}, {o.last_location_lng?.toFixed(5)}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Call location pins */}
        {callPins.map((pin, i) => (
          <Marker key={`call-${i}`} position={[pin.lat, pin.lng]} icon={makeCallIcon()}>
            <Popup>
              <div style={{ fontFamily: "-apple-system, sans-serif", fontSize: 13 }}>
                <div style={{ fontWeight: 700, color: "#dc2626", marginBottom: 2 }}>📞 Active Call</div>
                <div>{pin.label}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Today's route polylines */}
        {Object.entries(todayRoutes).map(([officerId, pings]) => {
          if (pings.length < 2) return null;
          const officer = officers.find((o) => o.id === officerId);
          const sc = STATUS_COLORS[officer?.current_field_status ?? "Off Duty"];
          const path: [number, number][] = pings.map((p) => [p.latitude, p.longitude]);
          return (
            <Polyline
              key={officerId}
              positions={path}
              pathOptions={{ color: sc.fill, weight: 3, opacity: 0.65, dashArray: "6 4" }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}

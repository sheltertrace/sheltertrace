"use client";

// Must be loaded via dynamic(() => import(...), { ssr: false })
import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { OfficerFieldProfile } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MCAS_CENTER: [number, number] = [33.598, -83.454];

const STATUS_COLORS: Record<string, string> = {
  "On Duty": "#16a34a", "En Route": "#d97706", "On Scene": "#2563eb",
  "Available": "#0891b2", "Break": "#dc2626", "Off Duty": "#9ca3af",
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toMiles(km: number): string {
  return (km * 0.621371).toFixed(1);
}

function elapsed(ts?: string | null): string {
  if (!ts) return "?";
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function makeOfficerIcon(status: string): L.DivIcon {
  const color = STATUS_COLORS[status] ?? "#9ca3af";
  return L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

function makeCallIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
      <div style="width:20px;height:20px;background:#dc2626;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>
      <div style="position:absolute;top:-4px;right:-4px;width:12px;height:12px;background:#ef4444;border-radius:50%;animation:call-pulse 1s infinite;border:2px solid #fff;"></div>
      <style>@keyframes call-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.5);opacity:0.5}}</style>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

interface Props {
  callAddress?: string;
  callCity?: string;
  officers: OfficerFieldProfile[];
}

interface NearbyOfficer {
  officer: OfficerFieldProfile;
  distanceKm: number;
}

export default function MiniDispatchMap({ callAddress, callCity, officers }: Props) {
  const [callLatLng, setCallLatLng] = useState<[number, number] | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  // Geocode call address via Nominatim (free, no key needed)
  useEffect(() => {
    const query = [callAddress, callCity, "GA"].filter(Boolean).join(", ");
    if (!query.trim() || query === ", GA") return;
    setGeocoding(true);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`;
    fetch(url, { headers: { "User-Agent": "ShelterTrace/1.0 (Morgan County Animal Services)" } })
      .then((r) => r.json())
      .then((results: Array<{ lat: string; lon: string }>) => {
        if (results[0]) setCallLatLng([parseFloat(results[0].lat), parseFloat(results[0].lon)]);
      })
      .catch(() => {})
      .finally(() => setGeocoding(false));
  }, [callAddress, callCity]);

  const onDuty = officers.filter(
    (o) => o.current_field_status !== "Off Duty" &&
           o.last_location_lat != null &&
           o.last_location_lng != null
  );

  // Sort on-duty officers by distance to call (if geocoded), otherwise by last update
  const nearbyOfficers: NearbyOfficer[] = onDuty
    .map((o) => ({
      officer: o,
      distanceKm: callLatLng
        ? haversineKm(callLatLng[0], callLatLng[1], o.last_location_lat!, o.last_location_lng!)
        : Infinity,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const mapCenter = callLatLng ?? MCAS_CENTER;

  return (
    <div>
      {/* Map */}
      <div style={{ height: 280, borderRadius: 10, overflow: "hidden", border: "1px solid #d1d5db", marginBottom: 12 }}>
        <MapContainer center={mapCenter} zoom={12} style={{ width: "100%", height: "100%" }} zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {onDuty.map((o) => (
            <Marker
              key={o.id}
              position={[o.last_location_lat!, o.last_location_lng!]}
              icon={makeOfficerIcon(o.current_field_status)}
            >
              <Popup>
                <div style={{ fontFamily: "-apple-system,sans-serif", fontSize: 13 }}>
                  <strong>{o.first_name} {o.last_name}</strong>
                  {o.badge ? <span style={{ color: "#64748b" }}> · #{o.badge}</span> : null}
                  <br />
                  <span style={{ color: STATUS_COLORS[o.current_field_status] ?? "#555", fontWeight: 700 }}>
                    {o.current_field_status}
                  </span>
                  <br />
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>Updated {elapsed(o.last_status_update)}</span>
                </div>
              </Popup>
            </Marker>
          ))}

          {callLatLng && (
            <Marker position={callLatLng} icon={makeCallIcon()}>
              <Popup>
                <div style={{ fontFamily: "-apple-system,sans-serif", fontSize: 13 }}>
                  <strong style={{ color: "#dc2626" }}>📞 Call Location</strong><br />
                  {callAddress}{callCity ? `, ${callCity}` : ""}
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Geocoding status */}
      {geocoding && (
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>📍 Locating call address…</div>
      )}

      {/* Nearest officers list */}
      {onDuty.length === 0 ? (
        <div style={{ fontSize: 13, color: "#64748b", fontStyle: "italic" }}>No officers currently on duty with GPS active.</div>
      ) : (
        <div>
          {callLatLng && nearbyOfficers[0]?.distanceKm < Infinity && (
            <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginBottom: 6 }}>
              📍 Nearest: {nearbyOfficers[0].officer.first_name} {nearbyOfficers[0].officer.last_name} — {toMiles(nearbyOfficers[0].distanceKm)} mi away
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {nearbyOfficers.slice(0, 5).map(({ officer: o, distanceKm }) => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: STATUS_COLORS[o.current_field_status] ?? "#9ca3af", display: "inline-block", flexShrink: 0 }} />
                  <span><strong>{o.first_name} {o.last_name}</strong>{o.badge ? ` #${o.badge}` : ""}</span>
                  <span style={{ color: "#64748b", fontSize: 12 }}>{o.current_field_status}</span>
                </div>
                <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
                  {distanceKm < Infinity ? `${toMiles(distanceKm)} mi` : elapsed(o.last_status_update)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

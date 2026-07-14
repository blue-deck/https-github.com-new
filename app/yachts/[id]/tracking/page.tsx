"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "../../../lib/supabase";
import "leaflet/dist/leaflet.css";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then((m) => m.Polyline), { ssr: false });

export default function TrackingPage() {
  const params = useParams();
  const yachtId = String(params?.id || "");

  const [positions, setPositions] = useState<any[]>([]);
  const [latest, setLatest] = useState<any>(null);
  const [boatIcon, setBoatIcon] = useState<any>(null);
  const [pointIcon, setPointIcon] = useState<any>(null);

  useEffect(() => {
    async function setupIcons() {
      const L = await import("leaflet");

      setBoatIcon(
        L.divIcon({
          html: `<div style="
            width:46px;height:46px;border-radius:50%;
            background:#06b6d4;color:#00111a;
            display:flex;align-items:center;justify-content:center;
            font-size:26px;font-weight:900;
            box-shadow:0 0 30px #06b6d4;
            border:3px solid white;">⛵</div>`,
          className: "",
          iconSize: [46, 46],
          iconAnchor: [23, 23],
        })
      );

      setPointIcon(
        L.divIcon({
          html: `<div style="
            width:18px;height:18px;border-radius:50%;
            background:#22c55e;
            box-shadow:0 0 18px #22c55e;
            border:2px solid white;"></div>`,
          className: "",
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        })
      );
    }

    setupIcons();
  }, []);

  async function loadPositions() {
    const { data } = await supabase
      .from("yacht_positions")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: true });

    const clean = (data || []).filter((p) => p.latitude && p.longitude);
    setPositions(clean);

    if (clean.length > 0) setLatest(clean[clean.length - 1]);
  }

  useEffect(() => {
    if (!yachtId) return;

    loadPositions();

    const channel = supabase
      .channel(`tracking_${yachtId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "yacht_positions",
          filter: `yacht_id=eq.${yachtId}`,
        },
        () => loadPositions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [yachtId]);

  const polyline = positions.map((p) => [Number(p.latitude), Number(p.longitude)]);

  return (
    <main className="bd-app-page min-h-screen bg-[#020817] p-6 text-white">
      <div className="mx-auto max-w-[1700px]">
        <div className="bd-page-hero rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
          <p className="text-cyan-400">BlueDeck Fleet Tracking</p>
          <h1 className="mt-4 text-6xl font-black">Live Vessel Tracking</h1>
          <p className="mt-4 max-w-4xl text-2xl text-gray-400">
            Historical vessel movement, realtime GPS tracking and operational replay.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-4">
          <Card title="Total Positions" value={positions.length} />
          <Card title="Latitude" value={latest?.latitude ? Number(latest.latitude).toFixed(5) : "-"} />
          <Card title="Longitude" value={latest?.longitude ? Number(latest.longitude).toFixed(5) : "-"} />
          <Card title="Mode" value={latest?.operational_mode || "-"} />
        </div>

        <div className="bd-media-canvas mt-8 overflow-hidden rounded-[40px] border border-white/10">
          {latest && boatIcon && pointIcon ? (
            <MapContainer
              center={[Number(latest.latitude), Number(latest.longitude)]}
              zoom={14}
              style={{ height: "850px", width: "100%" }}
            >
              <TileLayer
                attribution="OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {polyline.length > 1 && (
                <Polyline positions={polyline as any} pathOptions={{ color: "#06b6d4", weight: 5 }} />
              )}

              {positions.map((p, index) => {
                const isLatest = index === positions.length - 1;

                return (
                  <Marker
                    key={p.id}
                    position={[Number(p.latitude), Number(p.longitude)]}
                    icon={isLatest ? boatIcon : pointIcon}
                  >
                    <Popup>
                      <div>
                        <h3 style={{ fontWeight: "bold" }}>
                          {isLatest ? "YOUR YACHT" : p.location_name || "Position"}
                        </h3>
                        <p>Lat: {Number(p.latitude).toFixed(5)}</p>
                        <p>Lon: {Number(p.longitude).toFixed(5)}</p>
                        <p>Speed: {p.speed || 0} kn</p>
                        <p>Mode: {p.operational_mode || "-"}</p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          ) : (
            <div className="bd-media-canvas flex h-[700px] items-center justify-center bg-black text-3xl text-gray-500">
              No tracking data yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className="bd-app-card rounded-[30px] border border-white/10 bg-white/5 p-6">
      <p className="text-gray-400">{title}</p>
      <h2 className="mt-5 break-all text-5xl font-black">{value}</h2>
    </div>
  );
}

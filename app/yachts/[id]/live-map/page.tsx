"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });

export default function LiveMapPage() {
  const [position, setPosition] = useState<any>(null);
  const [boatIcon, setBoatIcon] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function setupIcon() {
      const L = await import("leaflet");

      setBoatIcon(
        L.divIcon({
          html: `<div style="width:56px;height:56px;border-radius:50%;background:#06b6d4;color:#00111a;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:900;box-shadow:0 0 35px #06b6d4;border:3px solid white;">⛵</div>`,
          className: "",
          iconSize: [56, 56],
          iconAnchor: [28, 28],
        })
      );
    }

    setupIcon();
  }, []);

  function getRealGPS() {
    setError("");

    if (!navigator.geolocation) {
      setError("Bu cihazda GPS desteklenmiyor.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          time: new Date().toLocaleString(),
        });
      },
      (err) => {
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  const center: [number, number] = position
    ? [position.latitude, position.longitude]
    : [37.93665, 23.64949];

  return (
    <main className="bd-app-page min-h-screen bg-[#020817] p-6 pb-28 text-white">
      <div className="mx-auto max-w-[1700px]">
        <div className="bd-page-hero rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
          <p className="text-cyan-400">BlueDeck Real Navigation</p>

          <h1 className="mt-4 text-6xl font-black">
            Real GPS Map
          </h1>

          <p className="mt-4 max-w-4xl text-2xl text-gray-400">
            This screen shows only verified browser GPS data from the active device.
          </p>

          <button
            onClick={getRealGPS}
            className="mt-6 rounded-2xl bg-cyan-400 px-6 py-4 font-bold text-black"
          >
            Get Real GPS
          </button>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-4">
          <Stat title="Latitude" value={position ? position.latitude.toFixed(6) : "-"} />
          <Stat title="Longitude" value={position ? position.longitude.toFixed(6) : "-"} />
          <Stat title="Accuracy" value={position ? `${Math.round(position.accuracy)} m` : "-"} />
          <Stat title="Updated" value={position ? position.time : "-"} />
        </div>

        <div className="bd-media-canvas mt-8 overflow-hidden rounded-[40px] border border-white/10">
          {boatIcon ? (
            <MapContainer center={center} zoom={15} style={{ height: "850px", width: "100%" }}>
              <TileLayer
                attribution="OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {position && (
                <Marker position={[position.latitude, position.longitude]} icon={boatIcon}>
                  <Popup>
                    <div>
                      <h3 style={{ fontWeight: "bold" }}>REAL GPS POSITION</h3>
                      <p>Lat: {position.latitude.toFixed(6)}</p>
                      <p>Lon: {position.longitude.toFixed(6)}</p>
                      <p>Accuracy: {Math.round(position.accuracy)} m</p>
                      <p>Updated: {position.time}</p>
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          ) : (
            <div className="bd-media-canvas flex h-[850px] items-center justify-center bg-black text-3xl text-gray-500">
              Loading map...
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Stat({ title, value }: any) {
  return (
    <div className="bd-app-card rounded-[30px] border border-white/10 bg-white/5 p-6">
      <p className="text-gray-400">{title}</p>
      <h2 className="mt-5 break-all text-3xl font-black">{value}</h2>
    </div>
  );
}

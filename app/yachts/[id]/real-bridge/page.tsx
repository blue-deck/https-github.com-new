"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

export default function RealBridgePage() {
  const params = useParams();
  const yachtId = String(params?.id || "");

  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [weather, setWeather] = useState<any>(null);
  const [anchorLat, setAnchorLat] = useState("");
  const [anchorLon, setAnchorLon] = useState("");
  const [radius, setRadius] = useState("50");
  const [anchorLogs, setAnchorLogs] = useState<any[]>([]);

  async function getGPS() {
    if (!navigator.geolocation) {
      alert("GPS not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const currentLat = pos.coords.latitude;
        const currentLon = pos.coords.longitude;

        setLat(currentLat);
        setLon(currentLon);

        await supabase.from("yacht_positions").insert({
          yacht_id: yachtId,
          latitude: currentLat,
          longitude: currentLon,
          speed: 0,
          heading: 0,
          location_name: "Live GPS Position",
          operational_mode: "live-gps",
        });

        fetchWeather(currentLat, currentLon);
      },
      (err) => {
        alert(err.message);
      },
      {
        enableHighAccuracy: true,
      }
    );
  }

  async function fetchWeather(latitude: number, longitude: number) {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,wind_direction_10m`
    );

    const data = await res.json();
    setWeather(data.current);

    await supabase.from("weather_snapshots").insert({
      yacht_id: yachtId,
      location_name: "Live GPS Weather",
      temperature: data.current?.temperature_2m || 0,
      wind_speed: data.current?.wind_speed_10m || 0,
      wave_height: 0,
      visibility: 0,
      weather_condition: "Live weather",
    });
  }

  function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000;
    const p1 = (lat1 * Math.PI) / 180;
    const p2 = (lat2 * Math.PI) / 180;
    const dp = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dp / 2) * Math.sin(dp / 2) +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async function setAnchorWatch() {
    if (!lat || !lon) {
      alert("Get GPS first");
      return;
    }

    const aLat = Number(anchorLat || lat);
    const aLon = Number(anchorLon || lon);
    const r = Number(radius || 50);
    const d = distanceMeters(aLat, aLon, lat, lon);

    const status = d > r ? "dragging" : "safe";

    await supabase.from("anchor_watch").insert({
      yacht_id: yachtId,
      anchor_latitude: aLat,
      anchor_longitude: aLon,
      current_latitude: lat,
      current_longitude: lon,
      radius_meters: r,
      distance_meters: d,
      status,
      notes: status === "dragging" ? "Anchor alarm triggered" : "Anchor safe",
    });

    if (status === "dragging") {
      await supabase.from("global_notifications").insert({
        yacht_id: yachtId,
        title: "ANCHOR ALARM",
        message: `Yacht moved ${d.toFixed(1)}m from anchor point.`,
        category: "navigation",
        severity: "critical",
        status: "unread",
      });
    }

    loadAnchorLogs();
  }

  async function loadAnchorLogs() {
    const { data } = await supabase
      .from("anchor_watch")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    setAnchorLogs(data || []);
  }

  useEffect(() => {
    if (yachtId) loadAnchorLogs();
  }, [yachtId]);

  return (
    <main className="min-h-screen bg-[#020817] p-6 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <Link href={`/yachts/${yachtId}`} className="text-cyan-300">
          ← Back to yacht
        </Link>

        <div className="mt-6 rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 p-10">
          <p className="text-cyan-300">BlueDeck Real Bridge</p>
          <h1 className="mt-4 text-6xl font-black">Real GPS + Weather + Anchor Alarm</h1>
          <p className="mt-4 max-w-4xl text-xl text-gray-300">
            Uses browser GPS, live weather and anchor distance monitoring.
          </p>

          <button
            onClick={getGPS}
            className="mt-6 rounded-2xl bg-cyan-400 px-6 py-4 font-bold text-black"
          >
            Get Live GPS + Weather
          </button>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-4">
          <Stat title="Latitude" value={lat || "-"} />
          <Stat title="Longitude" value={lon || "-"} />
          <Stat title="Wind" value={`${weather?.wind_speed_10m || 0} kn`} />
          <Stat title="Temp" value={`${weather?.temperature_2m || 0}°C`} />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-3xl font-bold">Anchor Watch</h2>

            <div className="mt-6 space-y-4">
              <input
                placeholder="Anchor latitude optional"
                value={anchorLat}
                onChange={(e) => setAnchorLat(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4"
              />

              <input
                placeholder="Anchor longitude optional"
                value={anchorLon}
                onChange={(e) => setAnchorLon(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4"
              />

              <input
                placeholder="Alarm radius meters"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4"
              />

              <button
                onClick={setAnchorWatch}
                className="w-full rounded-2xl bg-red-400 py-4 font-bold text-black"
              >
                Set / Check Anchor Alarm
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-3xl font-bold">Anchor Logs</h2>

            <div className="mt-6 space-y-4">
              {anchorLogs.map((log) => (
                <div
                  key={log.id}
                  className={`rounded-2xl border p-5 ${
                    log.status === "dragging"
                      ? "border-red-500/30 bg-red-500/10"
                      : "border-green-500/30 bg-green-500/10"
                  }`}
                >
                  <h3 className="text-2xl font-bold">{log.status}</h3>
                  <p className="mt-2 text-gray-300">
                    Distance: {Number(log.distance_meters || 0).toFixed(1)}m / Radius:{" "}
                    {log.radius_meters}m
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              ))}

              {anchorLogs.length === 0 && (
                <div className="rounded-2xl border border-white/10 p-5 text-gray-400">
                  No anchor logs yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ title, value }: any) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-gray-400">{title}</p>
      <h2 className="mt-4 break-all text-3xl font-black">{value}</h2>
    </div>
  );
}
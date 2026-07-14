"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function YachtMapPage() {
  const params = useParams();
  const yachtId = String(params?.id || "");

  const [positions, setPositions] = useState<any[]>([]);
  const [lastError, setLastError] = useState("");

  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [speed, setSpeed] = useState("");
  const [heading, setHeading] = useState("");
  const [location, setLocation] = useState("");
  const [mode, setMode] = useState("marina");

  async function fetchPositions() {
    if (!yachtId) return;

    const { data, error } = await supabase
      .from("yacht_positions")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    if (error) {
      setLastError(error.message);
      alert(error.message);
      return;
    }

    setPositions(data || []);
  }

  useEffect(() => {
    if (yachtId) fetchPositions();
  }, [yachtId]);

  async function savePosition() {
    setLastError("");

    if (!location) {
      alert("Location required");
      return;
    }

    const payload = {
      yacht_id: yachtId,
      latitude: Number(lat || 0),
      longitude: Number(lng || 0),
      speed: Number(speed || 0),
      heading: Number(heading || 0),
      location_name: location,
      operational_mode: mode,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("yacht_positions")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      setLastError(error.message);
      alert(error.message);
      return;
    }

    if (data) {
      setPositions((prev) => [data, ...prev]);
    }

    setLat("");
    setLng("");
    setSpeed("");
    setHeading("");
    setLocation("");
    setMode("marina");

    await fetchPositions();
  }

  const latest = positions[0];

  return (
    <main className="bd-app-page min-h-screen bg-[#020817] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <a href={`/yachts/${yachtId}`} className="text-cyan-300">
          ← Back
        </a>

        <div className="bd-page-hero mt-6 rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-10">
          <p className="text-cyan-300">BlueDeck Navigation</p>
          <h1 className="mt-4 text-6xl font-black">Live Fleet Map</h1>
          <p className="mt-4 text-xl text-gray-300">
            AIS-style yacht movement tracking and navigation history.
          </p>

          <div className="bd-app-card mt-4 rounded-2xl bg-black/30 p-4 text-sm text-gray-300">
            Debug yachtId: {yachtId}
            {lastError && <p className="mt-2 text-red-300">Error: {lastError}</p>}
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-4">
          <Stat title="Positions" value={positions.length} />
          <Stat title="Speed" value={`${latest?.speed || 0} kn`} />
          <Stat title="Heading" value={`${latest?.heading || 0}°`} />
          <Stat title="Mode" value={latest?.operational_mode || "-"} />
        </div>

        <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div className="bd-app-card rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-3xl font-bold">Update Position</h2>

            <div className="mt-5 space-y-4">
              <input placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} className="w-full rounded-2xl bg-white/10 p-4 outline-none" />
              <input placeholder="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} className="w-full rounded-2xl bg-white/10 p-4 outline-none" />
              <input placeholder="Speed" value={speed} onChange={(e) => setSpeed(e.target.value)} className="w-full rounded-2xl bg-white/10 p-4 outline-none" />
              <input placeholder="Heading" value={heading} onChange={(e) => setHeading(e.target.value)} className="w-full rounded-2xl bg-white/10 p-4 outline-none" />
              <input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-2xl bg-white/10 p-4 outline-none" />

              <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full rounded-2xl bg-white/10 p-4 outline-none">
                <option value="marina">Marina</option>
                <option value="anchored">Anchored</option>
                <option value="underway">Underway</option>
                <option value="crossing">Crossing</option>
                <option value="night-navigation">Night Navigation</option>
              </select>

              <button onClick={savePosition} className="w-full rounded-2xl bg-cyan-400 py-4 text-xl font-bold text-black">
                Save Position
              </button>
            </div>
          </div>

          <div className="bd-media-canvas rounded-3xl border border-white/10 bg-black/30 p-6">
            <h2 className="text-3xl font-bold">Position History</h2>

            <div className="mt-6 space-y-4">
              {positions.map((pos) => (
                <div key={pos.id} className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-5">
                  <h3 className="text-2xl font-bold">{pos.location_name || "Unknown"}</h3>
                  <p className="mt-2 text-gray-300">{pos.latitude}, {pos.longitude}</p>
                  <p className="mt-2 text-gray-300">{pos.speed || 0} kn · {pos.heading || 0}°</p>
                  <p className="mt-2 text-cyan-300">{pos.operational_mode || "marina"}</p>
                  <p className="mt-3 text-sm text-gray-500">
                    {pos.created_at ? new Date(pos.created_at).toLocaleString() : ""}
                  </p>
                </div>
              ))}

              {positions.length === 0 && (
                <div className="rounded-2xl border border-white/10 p-6 text-gray-400">
                  No positions yet.
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
    <div className="bd-app-card rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-gray-400">{title}</p>
      <h2 className="mt-3 text-5xl font-black">{value}</h2>
    </div>
  );
}

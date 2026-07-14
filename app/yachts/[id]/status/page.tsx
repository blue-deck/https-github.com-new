"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function YachtStatusPage() {
  const yachtId = usePathname().split("/")[2];

  const [status, setStatus] = useState<any>(null);

  const [currentStatus, setCurrentStatus] = useState("At Marina");
  const [location, setLocation] = useState("");
  const [weather, setWeather] = useState("");
  const [seaState, setSeaState] = useState("");
  const [ownerOnboard, setOwnerOnboard] = useState(false);
  const [guestMode, setGuestMode] = useState(false);

  async function fetchStatus() {
    const { data } = await supabase
      .from("yacht_status")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setStatus(data);

      setCurrentStatus(data.status || "At Marina");
      setLocation(data.location || "");
      setWeather(data.weather || "");
      setSeaState(data.sea_state || "");
      setOwnerOnboard(data.owner_onboard || false);
      setGuestMode(data.guest_mode || false);
    }
  }

  useEffect(() => {
    if (yachtId) fetchStatus();
  }, [yachtId]);

  async function saveStatus() {
    const { error } = await supabase.from("yacht_status").insert({
      yacht_id: yachtId,
      status: currentStatus,
      location,
      weather,
      sea_state: seaState,
      owner_onboard: ownerOnboard,
      guest_mode: guestMode,
    });

    if (error) {
      alert(error.message);
      return;
    }

    fetchStatus();

    alert("Yacht status updated");
  }

  return (
    <main className="bd-app-page min-h-screen bg-[#020817] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <a href={`/yachts/${yachtId}`} className="text-blue-300">
          ← Back to yacht
        </a>

        <div className="bd-page-hero mt-6 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-blue-500/10 p-10">
          <p className="text-xl text-gray-400">BlueDeck Live Operations</p>

          <h1 className="mt-4 text-6xl font-black">
            Yacht Live Status
          </h1>

          <p className="mt-4 max-w-3xl text-xl text-gray-400">
            Real-time yacht operational mode, owner presence and navigation status.
          </p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="bd-app-card rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-3xl font-bold">
              Update Status
            </h2>

            <div className="mt-6 space-y-4">
              <select
                value={currentStatus}
                onChange={(e) => setCurrentStatus(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              >
                <option>At Marina</option>
                <option>Underway</option>
                <option>Anchored</option>
                <option>Guest Cruise</option>
                <option>Shipyard</option>
                <option>Maintenance</option>
              </select>

              <input
                placeholder="Current location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <input
                placeholder="Weather"
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <input
                placeholder="Sea state"
                value={seaState}
                onChange={(e) => setSeaState(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={ownerOnboard}
                  onChange={(e) => setOwnerOnboard(e.target.checked)}
                />
                Owner onboard
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={guestMode}
                  onChange={(e) => setGuestMode(e.target.checked)}
                />
                Guest mode active
              </label>

              <button
                onClick={saveStatus}
                className="w-full rounded-2xl bg-blue-400 py-4 font-bold text-black"
              >
                Save Yacht Status
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-green-500/20 bg-green-500/10 p-8">
              <p className="text-gray-300">
                Operational Status
              </p>

              <h2 className="mt-4 text-5xl font-black">
                {status?.status || "Unknown"}
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <InfoCard
                title="Location"
                value={status?.location || "-"}
              />

              <InfoCard
                title="Weather"
                value={status?.weather || "-"}
              />

              <InfoCard
                title="Sea State"
                value={status?.sea_state || "-"}
              />

              <InfoCard
                title="Updated"
                value={
                  status?.updated_at
                    ? new Date(status.updated_at).toLocaleString()
                    : "-"
                }
              />
            </div>

            <div className="bd-app-card rounded-3xl border border-white/10 bg-white/5 p-8">
              <div className="flex flex-wrap gap-4">
                <Badge
                  active={status?.owner_onboard}
                  label="Owner Onboard"
                />

                <Badge
                  active={status?.guest_mode}
                  label="Guest Mode"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function InfoCard({ title, value }: any) {
  return (
    <div className="bd-app-card rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-gray-400">
        {title}
      </p>

      <h2 className="mt-4 text-2xl font-bold">
        {value}
      </h2>
    </div>
  );
}

function Badge({ label, active }: any) {
  return (
    <div
      className={`rounded-full px-5 py-3 text-sm font-bold ${
        active
          ? "bg-green-400 text-black"
          : "bg-white/10 text-gray-300"
      }`}
    >
      {label}
    </div>
  );
}

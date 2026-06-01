"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Battery, Droplets, Fan, Gauge, Wrench } from "lucide-react";
import { supabase } from "../../../lib/supabase";

type EngineeringAsset = {
  id: string;
  name?: string | null;
  asset_type?: string | null;
  current_hours?: number | null;
  service_interval?: number | null;
  last_service_hours?: number | null;
  status?: string | null;
  notes?: string | null;
};

type MaintenanceSchedule = {
  id: string;
  title?: string | null;
  system?: string | null;
  next_due_hours?: number | null;
  status?: string | null;
};

const iconMap = [Gauge, Wrench, Battery, Droplets, Fan, AlertTriangle];

export default function EngineeringPage() {
  const params = useParams();
  const yachtId = String(params?.id || "");
  const [assets, setAssets] = useState<EngineeringAsset[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);

  async function loadEngineering() {
    if (!yachtId) return;

    const [{ data: assetData }, { data: scheduleData }] = await Promise.all([
      supabase
        .from("engineering_assets")
        .select("*")
        .eq("yacht_id", yachtId)
        .order("created_at", { ascending: false }),
      supabase
        .from("maintenance_schedules")
        .select("*")
        .eq("yacht_id", yachtId)
        .order("created_at", { ascending: false }),
    ]);

    setAssets(assetData || []);
    setSchedules(scheduleData || []);
  }

  useEffect(() => {
    loadEngineering();
  }, [yachtId]);

  const stats = useMemo(() => {
    const due = assets.filter((asset) => remainingHours(asset) <= 25).length;
    const overdue = assets.filter((asset) => remainingHours(asset) <= 0).length;
    return { due, overdue, online: assets.length - overdue };
  }, [assets]);

  return (
    <main className="min-h-screen bg-[#020817] p-8 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
          <p className="text-cyan-300">BlueDeck EngineeringOS</p>
          <h1 className="mt-3 text-6xl font-black">Engineering Center</h1>
          <p className="mt-5 max-w-3xl text-xl text-gray-400">
            Live machinery assets, service windows and onboard engineering readiness.
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-4">
          <Stat title="Assets" value={String(assets.length)} />
          <Stat title="Systems Online" value={String(Math.max(stats.online, 0))} />
          <Stat title="Service Due" value={String(stats.due)} />
          <Stat title="Critical Alerts" value={String(stats.overdue)} />
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset, index) => {
            const Icon = iconMap[index % iconMap.length];
            const remaining = remainingHours(asset);
            const state = remaining <= 0 ? "Overdue" : remaining <= 25 ? "Due Soon" : asset.status || "Operational";

            return (
              <div key={asset.id} className="rounded-[36px] border border-white/10 bg-white/5 p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400 text-black">
                    <Icon className="h-8 w-8" />
                  </div>

                  <div className={`rounded-full px-4 py-2 text-sm ${
                    remaining <= 0
                      ? "bg-red-500/20 text-red-300"
                      : remaining <= 25
                      ? "bg-yellow-500/20 text-yellow-300"
                      : "bg-green-500/20 text-green-300"
                  }`}>
                    {state}
                  </div>
                </div>

                <h2 className="mt-8 text-4xl font-black">{asset.name || "Engineering Asset"}</h2>
                <p className="mt-3 text-lg text-gray-400">{asset.asset_type || "System"}</p>

                <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-gray-400">Hours / Service Window</p>
                  <h3 className="mt-3 text-3xl font-black text-cyan-300">
                    {Number(asset.current_hours || 0)}h · {remaining}h left
                  </h3>
                </div>
              </div>
            );
          })}

          {assets.length === 0 && (
            <div className="rounded-[36px] border border-white/10 bg-white/5 p-8 text-gray-400">
              No engineering assets recorded yet.
            </div>
          )}
        </div>

        <div className="mt-10 rounded-[36px] border border-white/10 bg-white/5 p-8">
          <h2 className="text-4xl font-black">Maintenance Schedule</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {schedules.map((item) => (
              <div key={item.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-cyan-300">{item.system || "System"}</p>
                <h3 className="mt-2 text-2xl font-black">{item.title || "Maintenance"}</h3>
                <p className="mt-2 text-gray-400">
                  Next due: {item.next_due_hours ? `${item.next_due_hours}h` : "Not scheduled"}
                </p>
              </div>
            ))}
            {schedules.length === 0 && <p className="text-gray-400">No maintenance schedule yet.</p>}
          </div>
        </div>
      </div>
    </main>
  );
}

function remainingHours(asset: EngineeringAsset) {
  return (
    Number(asset.last_service_hours || 0) +
    Number(asset.service_interval || 0) -
    Number(asset.current_hours || 0)
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
      <p className="text-gray-400">{title}</p>
      <h2 className="mt-4 text-3xl font-black">{value}</h2>
    </div>
  );
}

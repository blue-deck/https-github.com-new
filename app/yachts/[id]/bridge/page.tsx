"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Radar,
  Ship,
  Navigation,
  Waves,
  Fuel,
  Gauge,
  AlertTriangle,
  Satellite,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "../../../lib/supabase";

type YachtPosition = {
  id: string;
  latitude?: number | null;
  longitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  location_name?: string | null;
  operational_mode?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type YachtStatus = {
  operational_status?: string | null;
  current_location?: string | null;
  weather?: string | null;
  sea_state?: string | null;
};

type Voyage = {
  id: string;
  departure_port?: string | null;
  arrival_port?: string | null;
  status?: string | null;
  eta?: string | null;
};

type ExpiryAlert = {
  id: string;
  severity?: string | null;
  status?: string | null;
};

type EngineeringAsset = {
  id: string;
  current_hours?: number | null;
  last_service_hours?: number | null;
  service_interval?: number | null;
};

export default function BridgePage() {
  const params = useParams();
  const yachtId = String(params?.id || "");
  const [positions, setPositions] = useState<YachtPosition[]>([]);
  const [status, setStatus] = useState<YachtStatus | null>(null);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [alerts, setAlerts] = useState<ExpiryAlert[]>([]);
  const [assets, setAssets] = useState<EngineeringAsset[]>([]);

  async function loadBridge() {
    if (!yachtId) return;

    const [positionResult, statusResult, voyageResult, alertResult, assetResult] = await Promise.all([
      supabase
        .from("yacht_positions")
        .select("*")
        .eq("yacht_id", yachtId)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("yacht_status")
        .select("*")
        .eq("yacht_id", yachtId)
        .maybeSingle(),
      supabase
        .from("voyages")
        .select("*")
        .eq("yacht_id", yachtId)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("expiry_alerts")
        .select("*")
        .eq("yacht_id", yachtId)
        .order("created_at", { ascending: false }),
      supabase
        .from("engineering_assets")
        .select("id,current_hours,last_service_hours,service_interval")
        .eq("yacht_id", yachtId),
    ]);

    setPositions(positionResult.data || []);
    setStatus(statusResult.data || null);
    setVoyages(voyageResult.data || []);
    setAlerts(alertResult.data || []);
    setAssets(assetResult.data || []);
  }

  useEffect(() => {
    loadBridge();
  }, [yachtId]);

  const latestPosition = positions[0];
  const activeVoyage = voyages.find((voyage) => voyage.status !== "completed") || voyages[0];
  const criticalAlerts = alerts.filter((alert) => alert.status !== "resolved" && alert.severity === "critical");
  const dueAssets = assets.filter((asset) => remainingHours(asset) <= 25);
  const coordinates = hasPosition(latestPosition)
    ? `${Number(latestPosition?.latitude).toFixed(4)}, ${Number(latestPosition?.longitude).toFixed(4)}`
    : "Position not set";

  const systems: Array<[string, string, LucideIcon]> = useMemo(
    () => [
      ["Course", `${Number(latestPosition?.heading || 0)}°`, Navigation],
      ["Speed", `${Number(latestPosition?.speed || 0)} kn`, Gauge],
      ["AIS", activeVoyage ? "Voyage Linked" : "MMSI Required", Radar],
      ["Fuel", "Finance Linked", Fuel],
      ["Sea", status?.sea_state || "Not logged", Waves],
      ["GPS", latestPosition ? "Position Active" : "Waiting", Satellite],
    ],
    [activeVoyage, latestPosition, status],
  );

  return (
    <main className="min-h-screen px-4 py-6 pb-14 text-[#071629] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-[1700px]">
        <div className="mb-8 overflow-hidden rounded-[30px] border border-white/70 bg-white/90 shadow-2xl shadow-cyan-950/10 backdrop-blur sm:mb-10 sm:rounded-[40px]">
          <div className="h-1.5 bg-[linear-gradient(90deg,#061225,#22d3ee,#d8b45f,#ef776f)]" />
          <div className="p-6 sm:p-10">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#0e7490]">
              BlueDeck BridgeOS
            </p>
            <h1 className="mt-3 text-4xl font-black leading-tight text-[#071629] sm:text-6xl">
              Captain Bridge
            </h1>
            <p className="mt-5 max-w-4xl text-base leading-relaxed text-[#52677d] sm:text-xl">
              Professional bridge interface for live position, voyage awareness and captain operations.
            </p>
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:mb-10 xl:grid-cols-6">
          {systems.map(([title, value, Icon]) => (
            <div
              key={title}
              className="rounded-[26px] border border-cyan-950/10 bg-white/88 p-5 shadow-xl shadow-cyan-950/7 backdrop-blur"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 text-[#0e7490]">
                <Icon className="h-6 w-6" />
              </div>
              <p className="mt-5 text-sm font-semibold uppercase tracking-[0.12em] text-[#607489]">
                {title}
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#071629]">{value}</h2>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:gap-8">
          <div className="rounded-[30px] border border-cyan-950/10 bg-white/92 p-5 shadow-2xl shadow-cyan-950/10 backdrop-blur sm:rounded-[40px] sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#0e7490]">
                  Tactical Display
                </p>
                <h2 className="mt-2 text-3xl font-black leading-tight text-[#071629] sm:text-5xl">
                  Navigation Radar
                </h2>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#061225] text-[#a5f3fc] shadow-xl shadow-cyan-950/15">
                <Radar className="h-7 w-7" />
              </div>
            </div>

            <div className="relative mt-6 flex h-[360px] items-center justify-center overflow-hidden rounded-[28px] border border-cyan-300/20 bg-[#05111f] text-[#eaf6ff] shadow-inner shadow-cyan-950/40 sm:mt-8 sm:h-[520px] sm:rounded-[36px] xl:h-[650px]">
              <div className="absolute h-[92%] max-h-[620px] w-[92%] max-w-[620px] rounded-full border border-cyan-300/20" />
              <div className="absolute h-[66%] max-h-[440px] w-[66%] max-w-[440px] rounded-full border border-cyan-300/20" />
              <div className="absolute h-[40%] max-h-[260px] w-[40%] max-w-[260px] rounded-full border border-cyan-300/20" />
              <div className="absolute h-full w-px bg-cyan-300/16" />
              <div className="absolute h-px w-full bg-cyan-300/16" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.16),transparent_35%)]" />

              <div className="z-10 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-300 text-[#061225] shadow-[0_0_45px_rgba(34,211,238,0.75)] sm:h-20 sm:w-20">
                <Ship className="h-8 w-8 sm:h-10 sm:w-10" />
              </div>

              <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur sm:bottom-8 sm:left-8 sm:right-auto sm:min-w-[280px] sm:p-5">
                <p className="text-sm font-black uppercase tracking-[0.16em] text-[#67e8f9]">
                  Live Bridge Status
                </p>
                <p className="mt-2 text-sm text-[#d8ecfb] sm:text-base">
                  {latestPosition?.location_name || status?.current_location || coordinates}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 sm:space-y-6">
            <Panel
              title="Captain Status"
              text={`${status?.operational_status || latestPosition?.operational_mode || "Status not logged"} at ${
                status?.current_location || latestPosition?.location_name || "current yacht position"
              }.`}
            />
            <Panel title="Real Position" text={`${coordinates} · ${positions.length} position records available.`} />
            <Panel
              title="Voyage"
              text={
                activeVoyage
                  ? `${activeVoyage.departure_port || "Departure"} to ${activeVoyage.arrival_port || "Arrival"} · ${
                      activeVoyage.status || "active"
                    }`
                  : "Add MMSI or create a voyage to activate route awareness."
              }
              warning={!activeVoyage}
            />
            <Panel
              title="Safety"
              text={
                criticalAlerts.length || dueAssets.length
                  ? `${criticalAlerts.length} critical alerts and ${dueAssets.length} engineering services need attention.`
                  : "No critical onboard alerts currently active."
              }
              warning={Boolean(criticalAlerts.length || dueAssets.length)}
            />
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

function hasPosition(position?: YachtPosition) {
  return (
    position?.latitude !== null &&
    position?.latitude !== undefined &&
    position?.longitude !== null &&
    position?.longitude !== undefined
  );
}

function Panel({
  title,
  text,
  warning = false,
}: {
  title: string;
  text: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-[26px] border p-5 shadow-xl shadow-cyan-950/7 backdrop-blur sm:rounded-[32px] sm:p-7 ${
        warning
          ? "border-amber-200 bg-amber-50/90"
          : "border-cyan-950/10 bg-white/88"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            warning ? "bg-amber-100 text-amber-700" : "bg-cyan-50 text-[#0e7490]"
          }`}
        >
          {warning ? <AlertTriangle className="h-6 w-6" /> : <Ship className="h-6 w-6" />}
        </div>
        <div>
          <h2 className="text-2xl font-black text-[#071629] sm:text-3xl">{title}</h2>
          <p className="mt-3 text-base leading-relaxed text-[#52677d] sm:text-lg">{text}</p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Anchor, Fuel, Loader2, Navigation, Radar, RefreshCw, Ship } from "lucide-react";
import { supabase } from "../../../lib/supabase";

type LiveVoyage = {
  title: string;
  departurePort: string;
  arrivalPort: string;
  eta: string;
  etaCalculated: string;
  status: string;
  source: "MarineTraffic";
};

type LiveVessel = {
  mmsi: string;
  shipName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  speedKnots?: number | null;
  heading?: number | null;
  course?: number | null;
  destination?: string | null;
  currentPort?: string | null;
  lastPort?: string | null;
  nextPort?: string | null;
  timestamp?: string | null;
  typeName?: string | null;
  flag?: string | null;
};

type VoyageResponse = {
  ok: boolean;
  configured?: boolean;
  source?: string;
  mmsi?: string;
  vessel?: LiveVessel;
  voyage?: LiveVoyage;
  error?: string;
};

export default function VoyagePage() {
  const params = useParams();
  const yachtId = String(params?.id || "");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mmsiInput, setMmsiInput] = useState("");
  const [savingMmsi, setSavingMmsi] = useState(false);
  const [data, setData] = useState<VoyageResponse | null>(null);

  const loadVoyage = useCallback(async () => {
    if (!yachtId) return;

    setRefreshing(true);
    try {
      const response = await fetch(`/api/marinetraffic/voyage?yachtId=${encodeURIComponent(yachtId)}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as VoyageResponse;
      setData(payload);
    } catch (error) {
      setData({
        ok: false,
        error: error instanceof Error ? error.message : "MarineTraffic voyage sync failed.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [yachtId]);

  useEffect(() => {
    loadVoyage();
  }, [loadVoyage]);

  async function saveMmsi() {
    if (!/^\d{9}$/.test(mmsiInput)) {
      alert("MMSI must be 9 digits.");
      return;
    }

    setSavingMmsi(true);
    const { error } = await supabase.from("yachts").update({ mmsi: mmsiInput }).eq("id", yachtId);
    setSavingMmsi(false);

    if (error) {
      alert(error.message);
      return;
    }

    await loadVoyage();
  }

  const vessel = data?.vessel;
  const voyage = data?.voyage;
  const position =
    vessel?.latitude !== null &&
    vessel?.latitude !== undefined &&
    vessel?.longitude !== null &&
    vessel?.longitude !== undefined
      ? `${vessel.latitude.toFixed(5)}, ${vessel.longitude.toFixed(5)}`
      : "Position not broadcast";

  return (
    <main className="min-h-screen bg-[#020817] p-6 pb-28 text-white sm:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 overflow-hidden rounded-[40px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(8,47,73,0.46),rgba(2,8,23,0.98))] shadow-2xl shadow-cyan-950/40">
          <div className="h-1.5 bg-[linear-gradient(90deg,#22d3ee,#d8b45f,#ffffff,#22d3ee)]" />
          <div className="p-8 sm:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-200">
                  BlueDeck VoyageOS
                </p>
                <h1 className="mt-4 text-5xl font-black leading-none sm:text-6xl">
                  MarineTraffic Voyage Sync
                </h1>
                <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
                  Enter a yacht MMSI once and BlueDeck pulls the live AIS record into voyage,
                  position and captain command screens automatically.
                </p>
              </div>

              <button
                onClick={loadVoyage}
                disabled={refreshing}
                className="bd-focus inline-flex items-center justify-center gap-3 rounded-full border border-cyan-300/30 bg-cyan-300 px-6 py-4 font-black text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:bg-white disabled:cursor-wait disabled:opacity-70"
              >
                {refreshing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                Refresh MarineTraffic
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 text-slate-300">
            Syncing MarineTraffic voyage...
          </div>
        ) : !data?.ok || !voyage ? (
          <div className="rounded-[36px] border border-amber-300/30 bg-amber-300/10 p-8 shadow-2xl shadow-black/20">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-300 text-slate-950">
              <Radar className="h-8 w-8" />
            </div>
            <h2 className="mt-6 text-4xl font-black">MarineTraffic voyage is waiting</h2>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-amber-50/80">
              {data?.error ||
                "Add a 9-digit MMSI number to this yacht and configure the MarineTraffic API key to activate automatic voyage sync."}
            </p>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-amber-100/70">
              No demo route is shown here.
            </p>

            <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={mmsiInput}
                inputMode="numeric"
                maxLength={9}
                placeholder="MMSI number (9 digits)"
                onChange={(event) => setMmsiInput(event.target.value.replace(/\D/g, "").slice(0, 9))}
                className="bd-focus rounded-2xl border border-white/15 bg-white px-5 py-4 font-semibold text-slate-950 placeholder:text-slate-500"
              />
              <button
                onClick={saveMmsi}
                disabled={savingMmsi}
                className="bd-focus inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 font-black text-slate-950 transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-70"
              >
                {savingMmsi && <Loader2 className="h-5 w-5 animate-spin" />}
                Save MMSI
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8 grid gap-5 md:grid-cols-4">
              <Stat title="Source" value={voyage.source} />
              <Stat title="MMSI" value={vessel?.mmsi || data.mmsi || "-"} />
              <Stat title="Speed" value={`${vessel?.speedKnots ?? 0} kn`} />
              <Stat title="ETA" value={voyage.eta || "Not broadcast"} />
            </div>

            <div className="grid gap-8 lg:grid-cols-[1.35fr_0.9fr]">
              <section className="rounded-[36px] border border-white/10 bg-white/[0.06] p-8 shadow-2xl shadow-black/25">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-300 text-slate-950">
                  <Navigation className="h-8 w-8" />
                </div>

                <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-200">
                  Active AIS Voyage
                </p>
                <h2 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">{voyage.title}</h2>
                <p className="mt-5 text-lg text-cyan-100">{voyage.status}</p>

                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  <Small icon={<Anchor />} title="Departure" value={voyage.departurePort} />
                  <Small icon={<Ship />} title="Arrival" value={voyage.arrivalPort} />
                  <Small icon={<Navigation />} title="Position" value={position} />
                  <Small icon={<Fuel />} title="Fuel" value="Awaiting fuel log" />
                </div>
              </section>

              <section className="rounded-[36px] border border-cyan-300/20 bg-cyan-300/[0.08] p-8 shadow-2xl shadow-cyan-950/20">
                <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-200">
                  Vessel Identity
                </p>
                <h2 className="mt-4 text-4xl font-black">
                  {vessel?.shipName || vessel?.mmsi || "AIS vessel"}
                </h2>

                <div className="mt-8 space-y-4">
                  <Detail label="Type" value={vessel?.typeName || "Not broadcast"} />
                  <Detail label="Flag" value={vessel?.flag || "Not broadcast"} />
                  <Detail label="Destination" value={vessel?.destination || "Not broadcast"} />
                  <Detail label="Last Port" value={vessel?.lastPort || "Not broadcast"} />
                  <Detail label="Current Port" value={vessel?.currentPort || "Not broadcast"} />
                  <Detail label="Heading" value={`${vessel?.heading ?? vessel?.course ?? 0}°`} />
                  <Detail label="Last AIS Update" value={vessel?.timestamp || "Not broadcast"} />
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/[0.06] p-6 shadow-xl shadow-black/20">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <h2 className="mt-4 break-words text-3xl font-black text-white">{value}</h2>
    </div>
  );
}

function Small({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="text-cyan-300">{icon}</div>
      <p className="mt-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <h3 className="mt-2 break-words text-2xl font-black text-white">{value}</h3>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
      <span className="text-slate-400">{label}</span>
      <span className="max-w-[65%] break-words text-right font-bold text-white">{value}</span>
    </div>
  );
}

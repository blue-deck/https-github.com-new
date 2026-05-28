"use client";

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

const systems: Array<[string, string, LucideIcon]> = [
  ["Course", "184°", Navigation],
  ["Speed", "GPS", Gauge],
  ["AIS", "Provider Required", Radar],
  ["Fuel", "Monitoring", Fuel],
  ["Sea", "Operational", Waves],
  ["GPS", "Browser Active", Satellite],
];

export default function BridgePage() {
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
            Professional bridge interface for GPS, AIS readiness, navigation awareness and captain operations.
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
                  Real AIS Status
                </p>
                <p className="mt-2 text-sm text-[#d8ecfb] sm:text-base">
                  Awaiting provider access
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 sm:space-y-6">
            <Panel title="Captain Status" text="Bridge systems are online and ready for navigation." />
            <Panel title="Real GPS" text="Use Live Navigation Map to display actual browser GPS position." />
            <Panel title="AIS Integration" text="Connect MarineTraffic, AISStream or Kpler account with active AIS endpoint." warning />
            <Panel title="Safety" text="No critical onboard alerts currently active." />
          </div>
        </div>
      </div>
    </main>
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

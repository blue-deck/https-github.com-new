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

const systems = [
  ["Course", "184°", Navigation],
  ["Speed", "GPS", Gauge],
  ["AIS", "Provider Required", Radar],
  ["Fuel", "Monitoring", Fuel],
  ["Sea", "Operational", Waves],
  ["GPS", "Browser Active", Satellite],
];

export default function BridgePage() {
  return (
    <main className="min-h-screen bg-[#020817] p-8 pb-28 text-white">
      <div className="mx-auto max-w-[1700px]">
        <div className="mb-12 rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
          <p className="text-cyan-300">BlueDeck BridgeOS</p>
          <h1 className="mt-3 text-6xl font-black">Captain Bridge</h1>
          <p className="mt-5 max-w-4xl text-xl text-gray-400">
            Professional bridge interface for GPS, AIS readiness, navigation awareness and captain operations.
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-3 xl:grid-cols-6">
          {systems.map(([title, value, Icon]: any) => (
            <div key={title} className="rounded-[30px] border border-white/10 bg-white/5 p-6">
              <Icon className="h-8 w-8 text-cyan-300" />
              <p className="mt-5 text-gray-400">{title}</p>
              <h2 className="mt-3 text-2xl font-black">{value}</h2>
            </div>
          ))}
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[40px] border border-white/10 bg-black/40 p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-300">Tactical Display</p>
                <h2 className="mt-2 text-5xl font-black">Navigation Radar</h2>
              </div>
              <Radar className="h-14 w-14 text-cyan-300" />
            </div>

            <div className="relative mt-10 flex h-[650px] items-center justify-center overflow-hidden rounded-[36px] bg-[#020817]">
              <div className="absolute h-[620px] w-[620px] rounded-full border border-cyan-500/20" />
              <div className="absolute h-[440px] w-[440px] rounded-full border border-cyan-500/20" />
              <div className="absolute h-[260px] w-[260px] rounded-full border border-cyan-500/20" />
              <div className="absolute h-full w-[1px] bg-cyan-500/20" />
              <div className="absolute h-[1px] w-full bg-cyan-500/20" />

              <div className="z-10 flex h-20 w-20 items-center justify-center rounded-full bg-cyan-400 text-black shadow-[0_0_45px_#06b6d4]">
                <Ship className="h-10 w-10" />
              </div>

              <div className="absolute bottom-8 left-8 rounded-2xl border border-white/10 bg-black/50 p-5">
                <p className="text-cyan-300">Real AIS Status</p>
                <p className="mt-2 text-gray-400">Awaiting provider access</p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
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

function Panel({ title, text, warning = false }: any) {
  return (
    <div className={`rounded-[32px] border p-8 ${warning ? "border-yellow-500/30 bg-yellow-500/10" : "border-white/10 bg-white/5"}`}>
      <div className="flex items-start gap-4">
        {warning ? <AlertTriangle className="h-8 w-8 text-yellow-300" /> : <Ship className="h-8 w-8 text-cyan-300" />}
        <div>
          <h2 className="text-3xl font-black">{title}</h2>
          <p className="mt-4 text-lg leading-relaxed text-gray-400">{text}</p>
        </div>
      </div>
    </div>
  );
}
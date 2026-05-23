"use client";

import { Wrench, Gauge, Battery, Droplets, Fan, AlertTriangle } from "lucide-react";

const systems = [
  { name: "Main Engines", status: "Operational", hours: "0 h", icon: Gauge },
  { name: "Generators", status: "Operational", hours: "0 h", icon: Wrench },
  { name: "Battery Bank", status: "Monitoring", hours: "100%", icon: Battery },
  { name: "Watermaker", status: "Ready", hours: "Standby", icon: Droplets },
  { name: "Air Conditioning", status: "Operational", hours: "Normal", icon: Fan },
  { name: "Bilge System", status: "Clear", hours: "No alarm", icon: AlertTriangle },
];

export default function EngineeringPage() {
  return (
    <main className="min-h-screen bg-[#020817] p-8 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
          <p className="text-cyan-300">BlueDeck EngineeringOS</p>
          <h1 className="mt-3 text-6xl font-black">Engineering Center</h1>
          <p className="mt-5 max-w-3xl text-xl text-gray-400">
            Technical monitoring, service planning and onboard engineering overview.
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-4">
          <Stat title="Critical Alerts" value="0" />
          <Stat title="Systems Online" value="6" />
          <Stat title="Service Due" value="0" />
          <Stat title="Engine Room" value="Normal" />
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {systems.map((system) => {
            const Icon = system.icon;

            return (
              <div key={system.name} className="rounded-[36px] border border-white/10 bg-white/5 p-8">
                <div className="flex items-start justify-between">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400 text-black">
                    <Icon className="h-8 w-8" />
                  </div>

                  <div className="rounded-full bg-green-500/20 px-4 py-2 text-sm text-green-300">
                    {system.status}
                  </div>
                </div>

                <h2 className="mt-8 text-4xl font-black">{system.name}</h2>

                <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-gray-400">Current Reading</p>
                  <h3 className="mt-3 text-3xl font-black text-cyan-300">{system.hours}</h3>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
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
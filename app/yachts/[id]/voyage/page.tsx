"use client";

import { Navigation, Anchor, Ship, Fuel } from "lucide-react";

const plans = [
  { title: "Zea Marina → Varkiza", status: "Planned", eta: "2h 30m", fuel: "420 L" },
  { title: "Varkiza → Kea", status: "Standby", eta: "4h 10m", fuel: "780 L" },
];

export default function VoyagePage() {
  return (
    <main className="min-h-screen bg-[#020817] p-8 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
          <p className="text-cyan-300">BlueDeck VoyageOS</p>
          <h1 className="mt-3 text-6xl font-black">Voyage & Marina Planner</h1>
          <p className="mt-5 max-w-3xl text-xl text-gray-400">
            Passage planning, fuel estimation, marina operations and voyage readiness.
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-4">
          <Stat title="Active Plan" value="1" />
          <Stat title="Departure" value="Zea" />
          <Stat title="Arrival" value="Varkiza" />
          <Stat title="Fuel Plan" value="420 L" />
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {plans.map((plan) => (
            <div key={plan.title} className="rounded-[36px] border border-white/10 bg-white/5 p-8">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400 text-black">
                <Navigation className="h-8 w-8" />
              </div>

              <h2 className="text-4xl font-black">{plan.title}</h2>
              <p className="mt-4 text-cyan-300">{plan.status}</p>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <Small icon={<Ship />} title="ETA" value={plan.eta} />
                <Small icon={<Fuel />} title="Fuel" value={plan.fuel} />
                <Small icon={<Anchor />} title="Marina" value="Ready" />
                <Small icon={<Navigation />} title="Route" value="Safe" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Stat({ title, value }: any) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
      <p className="text-gray-400">{title}</p>
      <h2 className="mt-4 text-3xl font-black">{value}</h2>
    </div>
  );
}

function Small({ icon, title, value }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="text-cyan-300">{icon}</div>
      <p className="mt-3 text-gray-400">{title}</p>
      <h3 className="mt-2 text-2xl font-black">{value}</h3>
    </div>
  );
}
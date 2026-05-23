"use client";

import { BLUEDECK } from "../../../config";
import {
  Settings,
  Database,
  Globe,
  Satellite,
  Shield,
  Wifi,
  Ship,
  CheckCircle,
} from "lucide-react";

const items = [
  ["Deployment", BLUEDECK.production.deploy, Globe],
  ["Database", BLUEDECK.production.database, Database],
  ["PWA", BLUEDECK.production.pwa ? "Enabled" : "Disabled", CheckCircle],
  ["Offline Mode", BLUEDECK.production.offline ? "Enabled" : "Disabled", Wifi],
  ["GPS", BLUEDECK.integrations.gps, Satellite],
  ["AIS", BLUEDECK.integrations.ais, Ship],
  ["Security", "Local access active", Shield],
];

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-[#020817] p-8 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
          <p className="text-cyan-300">BlueDeck System</p>
          <h1 className="mt-3 text-6xl font-black">Production Settings</h1>
          <p className="mt-5 max-w-3xl text-xl text-gray-400">
            Final production readiness, deployment, integrations and yacht system configuration.
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-4">
          <Stat title="Yacht" value={BLUEDECK.yachtName} />
          <Stat title="Captain" value={BLUEDECK.captain} />
          <Stat title="Flag" value={BLUEDECK.flag} />
          <Stat title="Mode" value={BLUEDECK.mode} />
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {items.map(([title, value, Icon]: any) => (
            <div key={title} className="rounded-[36px] border border-white/10 bg-white/5 p-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400 text-black">
                <Icon className="h-8 w-8" />
              </div>

              <h2 className="mt-8 text-4xl font-black">{title}</h2>
              <p className="mt-4 text-xl text-gray-400">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-[36px] border border-white/10 bg-white/5 p-8">
          <div className="flex items-center gap-4">
            <Settings className="h-12 w-12 text-cyan-300" />
            <div>
              <p className="text-cyan-300">Production Note</p>
              <h2 className="text-4xl font-black">Ready for Vercel deployment.</h2>
            </div>
          </div>

          <p className="mt-6 text-xl leading-relaxed text-gray-400">
            Real AIS, Starlink, NMEA2000 and payment systems require live provider credentials.
            The application shell, PWA, modules and yacht operating interface are ready.
          </p>
        </div>
      </div>
    </main>
  );
}

function Stat({ title, value }: any) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
      <p className="text-gray-400">{title}</p>
      <h2 className="mt-4 break-all text-3xl font-black">{value}</h2>
    </div>
  );
}
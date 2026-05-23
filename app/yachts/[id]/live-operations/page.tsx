"use client";

import {
  Shield,
  Radio,
  Navigation,
  Anchor,
  Bell,
  Waves,
  Activity,
} from "lucide-react";

const operations = [
  {
    title: "Navigation",
    value: "ACTIVE",
    icon: Navigation,
    color: "text-cyan-300",
  },
  {
    title: "AIS Traffic",
    value: "4 Targets",
    icon: Radio,
    color: "text-green-300",
  },
  {
    title: "Anchor Watch",
    value: "SAFE",
    icon: Anchor,
    color: "text-yellow-300",
  },
  {
    title: "Security",
    value: "SECURE",
    icon: Shield,
    color: "text-purple-300",
  },
  {
    title: "Sea State",
    value: "Moderate",
    icon: Waves,
    color: "text-blue-300",
  },
  {
    title: "Notifications",
    value: "0 Alerts",
    icon: Bell,
    color: "text-red-300",
  },
];

export default function LiveOperationsPage() {
  return (
    <main className="min-h-screen bg-[#020817] p-8 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
          <p className="text-cyan-300">BlueDeck OperationsOS</p>

          <h1 className="mt-3 text-6xl font-black">
            Live Operations Center
          </h1>

          <p className="mt-5 max-w-3xl text-xl text-gray-400">
            Real-time yacht command center with navigation, AIS,
            engineering and onboard operational monitoring.
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-3 xl:grid-cols-6">
          {operations.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="rounded-[32px] border border-white/10 bg-white/5 p-6"
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ${item.color}`}
                  >
                    <Icon className="h-7 w-7" />
                  </div>

                  <Activity className="h-5 w-5 text-green-400" />
                </div>

                <h2 className="mt-6 text-lg text-gray-400">
                  {item.title}
                </h2>

                <p className={`mt-2 text-2xl font-black ${item.color}`}>
                  {item.value}
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-8 xl:grid-cols-3">
          <div className="rounded-[36px] border border-white/10 bg-white/5 p-8 xl:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-300">Command Timeline</p>
                <h2 className="mt-2 text-4xl font-black">
                  Operations Feed
                </h2>
              </div>

              <div className="rounded-full bg-green-500/20 px-5 py-2 text-green-300">
                LIVE
              </div>
            </div>

            <div className="mt-10 space-y-5">
              <Feed
                title="AIS target updated"
                time="Now"
                status="Tracking nearby vessel"
              />

              <Feed
                title="GPS synchronized"
                time="2 min ago"
                status="Position stream stable"
              />

              <Feed
                title="Anchor monitoring active"
                time="5 min ago"
                status="No drift detected"
              />

              <Feed
                title="Engineering systems healthy"
                time="10 min ago"
                status="All systems operational"
              />
            </div>
          </div>

          <div className="rounded-[36px] border border-white/10 bg-white/5 p-8">
            <p className="text-cyan-300">System Status</p>

            <h2 className="mt-2 text-4xl font-black">
              Yacht Health
            </h2>

            <div className="mt-10 space-y-6">
              <Status title="Main Engines" value="Healthy" />
              <Status title="Generators" value="Online" />
              <Status title="Batteries" value="98%" />
              <Status title="Internet" value="Connected" />
              <Status title="Crew Network" value="Stable" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Feed({
  title,
  time,
  status,
}: {
  title: string;
  time: string;
  status: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold">{title}</h3>

        <span className="text-sm text-gray-400">{time}</span>
      </div>

      <p className="mt-3 text-gray-400">{status}</p>
    </div>
  );
}

function Status({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="text-gray-400">{title}</p>

      <div className="mt-3 flex items-center justify-between">
        <h3 className="text-2xl font-black">{value}</h3>

        <div className="h-3 w-3 rounded-full bg-green-400" />
      </div>
    </div>
  );
}
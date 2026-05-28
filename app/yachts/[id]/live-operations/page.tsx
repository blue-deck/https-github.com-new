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
    accent: "border-cyan-200 bg-cyan-50 text-[#0e7490]",
  },
  {
    title: "AIS Traffic",
    value: "4 Targets",
    icon: Radio,
    accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  {
    title: "Anchor Watch",
    value: "SAFE",
    icon: Anchor,
    accent: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    title: "Security",
    value: "SECURE",
    icon: Shield,
    accent: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  {
    title: "Sea State",
    value: "Moderate",
    icon: Waves,
    accent: "border-sky-200 bg-sky-50 text-sky-700",
  },
  {
    title: "Notifications",
    value: "0 Alerts",
    icon: Bell,
    accent: "border-rose-200 bg-rose-50 text-rose-700",
  },
];

export default function LiveOperationsPage() {
  return (
    <main className="min-h-screen px-4 py-6 pb-14 text-[#071629] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 overflow-hidden rounded-[30px] border border-white/70 bg-white/90 shadow-2xl shadow-cyan-950/10 backdrop-blur sm:mb-10 sm:rounded-[40px]">
          <div className="h-1.5 bg-[linear-gradient(90deg,#061225,#22d3ee,#d8b45f,#ef776f)]" />
          <div className="p-6 sm:p-10">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#0e7490]">
              BlueDeck OperationsOS
            </p>

            <h1 className="mt-3 text-4xl font-black leading-tight text-[#071629] sm:text-6xl">
              Live Operations Center
            </h1>

            <p className="mt-5 max-w-3xl text-base leading-relaxed text-[#52677d] sm:text-xl">
              Real-time yacht command center with navigation, AIS,
              engineering and onboard operational monitoring.
            </p>
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:mb-10 xl:grid-cols-6">
          {operations.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="rounded-[26px] border border-cyan-950/10 bg-white/88 p-5 shadow-xl shadow-cyan-950/7 backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${item.accent}`}
                  >
                    <Icon className="h-7 w-7" />
                  </div>

                  <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                    <Activity className="h-3.5 w-3.5" />
                    Live
                  </div>
                </div>

                <h2 className="mt-6 text-sm font-semibold uppercase tracking-[0.12em] text-[#607489]">
                  {item.title}
                </h2>

                <p className="mt-2 text-2xl font-black text-[#071629]">
                  {item.value}
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-3 xl:gap-8">
          <div className="rounded-[30px] border border-cyan-950/10 bg-white/92 p-5 shadow-2xl shadow-cyan-950/10 backdrop-blur sm:rounded-[36px] sm:p-8 xl:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#0e7490]">
                  Command Timeline
                </p>
                <h2 className="mt-2 text-3xl font-black text-[#071629] sm:text-4xl">
                  Operations Feed
                </h2>
              </div>

              <div className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2 text-sm font-black uppercase tracking-[0.12em] text-emerald-700">
                LIVE
              </div>
            </div>

            <div className="mt-7 space-y-4 sm:mt-10 sm:space-y-5">
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

          <div className="rounded-[30px] border border-cyan-950/10 bg-white/92 p-5 shadow-2xl shadow-cyan-950/10 backdrop-blur sm:rounded-[36px] sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#0e7490]">
              System Status
            </p>

            <h2 className="mt-2 text-3xl font-black text-[#071629] sm:text-4xl">
              Yacht Health
            </h2>

            <div className="mt-7 space-y-4 sm:mt-10 sm:space-y-5">
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
    <div className="rounded-[24px] border border-cyan-950/10 bg-[#f7fcff] p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xl font-black text-[#071629] sm:text-2xl">{title}</h3>

        <span className="w-fit rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-[#0e7490]">
          {time}
        </span>
      </div>

      <p className="mt-3 text-base leading-relaxed text-[#52677d]">{status}</p>
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
    <div className="rounded-2xl border border-cyan-950/10 bg-[#f7fcff] p-5 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#607489]">
        {title}
      </p>

      <div className="mt-3 flex items-center justify-between">
        <h3 className="text-2xl font-black text-[#071629]">{value}</h3>

        <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.55)]" />
      </div>
    </div>
  );
}

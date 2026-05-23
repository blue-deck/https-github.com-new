"use client";

import { Bell, CheckCircle, AlertTriangle, Info } from "lucide-react";

const notifications = [
  { title: "Navigation online", text: "Live GPS system is operational.", type: "info", icon: Info },
  { title: "Engineering healthy", text: "No critical engineering alerts.", type: "success", icon: CheckCircle },
  { title: "Crew ready", text: "Crew center status is operational.", type: "success", icon: CheckCircle },
  { title: "AIS provider pending", text: "Real AIS provider access is not connected yet.", type: "warning", icon: AlertTriangle },
];

export default function NotificationsPage() {
  return (
    <main className="min-h-screen bg-[#020817] p-8 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
          <p className="text-cyan-300">BlueDeck Alerts</p>
          <h1 className="mt-3 text-6xl font-black">Notifications Center</h1>
          <p className="mt-5 max-w-3xl text-xl text-gray-400">
            Operational notifications, alerts and yacht system messages.
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-4">
          <Stat title="Total" value="4" />
          <Stat title="Critical" value="0" />
          <Stat title="Warnings" value="1" />
          <Stat title="Status" value="Clear" />
        </div>

        <div className="space-y-6">
          {notifications.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.title} className="rounded-[32px] border border-white/10 bg-white/5 p-6">
                <div className="flex items-start gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400 text-black">
                    <Icon className="h-7 w-7" />
                  </div>

                  <div>
                    <h2 className="text-3xl font-black">{item.title}</h2>
                    <p className="mt-3 text-lg text-gray-400">{item.text}</p>
                  </div>
                </div>
              </div>
            );
          })}
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
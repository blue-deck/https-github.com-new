"use client";

import { BLUEDECK } from "../../../config";
import { Ship, MapPin, Shield, Utensils, Waves, Bell } from "lucide-react";

export default function OwnerPage() {
  return (
    <main className="min-h-screen bg-[#020817] p-8 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 rounded-[40px] border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-purple-900/10 p-10">
          <p className="text-amber-300">BlueDeck Owner Experience</p>
          <h1 className="mt-3 text-6xl font-black">Owner VIP App</h1>
          <p className="mt-5 max-w-3xl text-xl text-gray-400">
            Luxury owner dashboard for yacht status, comfort, privacy and onboard experience.
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-4">
          <Stat title="Yacht" value={BLUEDECK.yachtName} />
          <Stat title="Mode" value="Private" />
          <Stat title="Guest Comfort" value="Ready" />
          <Stat title="Privacy" value="Active" />
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <Card icon={<Ship />} title="Yacht Status" text="All primary yacht systems are operational." />
          <Card icon={<MapPin />} title="Location" text="Live GPS map is available in Navigation." />
          <Card icon={<Shield />} title="Security" text="Owner privacy and onboard security mode active." />
          <Card icon={<Utensils />} title="Guest Service" text="Chef, crew and interior readiness panel prepared." />
          <Card icon={<Waves />} title="Sea Experience" text="Beach club, tender and water toys workflow ready." />
          <Card icon={<Bell />} title="Owner Alerts" text="Critical notifications will appear here when active." />
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

function Card({ icon, title, text }: any) {
  return (
    <div className="rounded-[36px] border border-white/10 bg-white/5 p-8">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-400 text-black">
        {icon}
      </div>
      <h2 className="text-4xl font-black">{title}</h2>
      <p className="mt-5 text-xl leading-relaxed text-gray-400">{text}</p>
    </div>
  );
}
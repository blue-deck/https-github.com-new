"use client";

import {
  Bell,
  CalendarDays,
  Crown,
  type LucideIcon,
  MapPin,
  Martini,
  ShieldCheck,
  Ship,
  Utensils,
  Waves,
} from "lucide-react";
import { BLUEDECK } from "../../../config";

const ownerCards = [
  {
    icon: Ship,
    title: "Yacht Status",
    text: "All primary systems are ready for owner arrival.",
  },
  {
    icon: MapPin,
    title: "Location",
    text: "Current position and arrival details are available for the owner party.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy",
    text: "Private yacht mode is active with restricted operational visibility.",
  },
  {
    icon: Utensils,
    title: "Guest Service",
    text: "Interior, chef and service preparation are marked ready.",
  },
  {
    icon: Waves,
    title: "Water Experience",
    text: "Beach club, tender and water toys are prepared for use.",
  },
  {
    icon: Bell,
    title: "Owner Alerts",
    text: "Only meaningful owner-level updates appear here.",
  },
];

export default function OwnerPage() {
  return (
    <main className="min-h-screen px-5 pb-28 pt-8 text-[#eef7ff] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <section className="bd-panel rounded-3xl p-6 sm:p-8 lg:p-10">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr]">
            <div>
              <p className="bd-kicker">Owner Experience</p>
              <h1 className="mt-4 text-5xl font-semibold leading-tight text-white sm:text-7xl">
                Private Owner App
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#aeb8c8]">
                A calm luxury view for yacht readiness, privacy, guest comfort
                and the next owner moment. No operational clutter, only the
                information that matters.
              </p>
            </div>

            <div className="rounded-3xl border border-[#22d3ee]/20 bg-[#22d3ee]/10 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#22d3ee] text-[#020817]">
                  <Crown className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm text-[#67e8f9]">{BLUEDECK.yachtName}</p>
                  <h2 className="text-2xl font-semibold text-white">
                    Owner Arrival Ready
                  </h2>
                </div>
              </div>

              <div className="mt-7 space-y-3">
                <OwnerLine icon={CalendarDays} label="Next Moment" value="Sunset service" />
                <OwnerLine icon={Martini} label="Hospitality" value="Guest profile ready" />
                <OwnerLine icon={ShieldCheck} label="Privacy" value="Active" />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <Stat title="Yacht" value={BLUEDECK.yachtName} />
          <Stat title="Mode" value="Private" />
          <Stat title="Comfort" value="Ready" />
          <Stat title="Alerts" value="Clear" />
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ownerCards.map((card) => {
            const Icon = card.icon;

            return (
              <article key={card.title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#22d3ee]/15 text-[#22d3ee]">
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="mt-6 text-2xl font-semibold text-white">
                  {card.title}
                </h2>
                <p className="mt-3 leading-7 text-[#aeb8c8]">{card.text}</p>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function OwnerLine({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-[#22d3ee]" />
        <span className="text-[#aeb8c8]">{label}</span>
      </div>
      <span className="text-right font-semibold text-white">{value}</span>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
      <p className="text-sm text-[#aeb8c8]">{title}</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">{value}</h2>
    </div>
  );
}

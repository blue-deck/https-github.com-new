"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Ship,
  Radar,
  Shield,
  Cpu,
  Globe,
  Waves,
  Fuel,
  Users,
  ChevronRight,
} from "lucide-react";

export default function HomePage() {
  const features = [
    {
      icon: <Radar className="h-10 w-10" />,
      title: "Live Navigation",
      text: "Realtime GPS, AIS traffic and professional bridge tracking.",
    },
    {
      icon: <Cpu className="h-10 w-10" />,
      title: "AI Operations",
      text: "Predictive maintenance, smart alerts and operational intelligence.",
    },
    {
      icon: <Shield className="h-10 w-10" />,
      title: "Engineering",
      text: "Generator, engines, batteries and maintenance automation.",
    },
    {
      icon: <Users className="h-10 w-10" />,
      title: "Crew System",
      text: "Tasks, schedules, payroll and mobile crew workflows.",
    },
    {
      icon: <Fuel className="h-10 w-10" />,
      title: "Fuel Analytics",
      text: "Consumption tracking and voyage optimization.",
    },
    {
      icon: <Globe className="h-10 w-10" />,
      title: "Fleet Cloud",
      text: "Manage multiple yachts from one enterprise platform.",
    },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#020817] text-white">
      <section className="relative border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.2),transparent_50%)]" />

        <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            <div className="inline-flex items-center gap-3 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-5 py-3 text-cyan-300">
              <Ship className="h-5 w-5" />
              Enterprise Yacht Operating System
            </div>

            <h1 className="mt-8 max-w-5xl text-7xl font-black leading-tight">
              BlueDeck
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                {" "}
                YachtOS
              </span>
            </h1>

            <p className="mt-8 max-w-3xl text-2xl leading-relaxed text-gray-400">
              Enterprise-grade superyacht operating platform combining
              live navigation, AI operations, engineering systems,
              crew management and owner experience into one luxury interface.
            </p>

            <div className="mt-10 flex flex-wrap gap-5">
              <Link
                href="/login"
                className="rounded-2xl bg-cyan-400 px-8 py-5 text-lg font-bold text-black transition hover:scale-105"
              >
                Enter BlueDeck
              </Link>

              <Link
                href="/yachts"
                className="rounded-2xl border border-white/10 bg-white/5 px-8 py-5 text-lg font-bold transition hover:bg-white/10"
              >
                Open Fleet
              </Link>
            </div>
          </motion.div>

          <div className="mt-24 grid gap-6 lg:grid-cols-3">
            <GlassCard
              title="Live BridgeOS"
              value="Realtime"
              text="Professional bridge-grade live navigation and AIS intelligence."
            />

            <GlassCard
              title="AI Engine"
              value="Predictive"
              text="AI-driven maintenance and operational analytics."
            />

            <GlassCard
              title="Fleet Cloud"
              value="Enterprise"
              text="Luxury fleet management for owners and captains."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-32">
        <div className="max-w-4xl">
          <p className="text-cyan-400">Core Systems</p>

          <h2 className="mt-4 text-6xl font-black">
            Built for modern superyachts.
          </h2>

          <p className="mt-6 text-2xl leading-relaxed text-gray-400">
            BlueDeck combines navigation, engineering, operations,
            finance and crew systems into one unified platform.
          </p>
        </div>

        <div className="mt-20 grid gap-8 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              viewport={{ once: true }}
              className="group rounded-[32px] border border-white/10 bg-white/5 p-8 transition hover:border-cyan-500/30 hover:bg-cyan-500/5"
            >
              <div className="text-cyan-400">
                {feature.icon}
              </div>

              <h3 className="mt-6 text-3xl font-black">
                {feature.title}
              </h3>

              <p className="mt-4 text-lg leading-relaxed text-gray-400">
                {feature.text}
              </p>

              <div className="mt-8 flex items-center gap-2 text-cyan-300 opacity-0 transition group-hover:opacity-100">
                Explore
                <ChevronRight className="h-5 w-5" />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 bg-black/30">
        <div className="mx-auto grid max-w-7xl gap-16 px-6 py-28 lg:grid-cols-2">
          <div>
            <p className="text-cyan-400">Navigation Intelligence</p>

            <h2 className="mt-4 text-6xl font-black leading-tight">
              Professional bridge systems for captains.
            </h2>

            <p className="mt-8 text-xl leading-relaxed text-gray-400">
              Designed for real-world yacht operations with
              navigation awareness, operational analytics and
              enterprise fleet infrastructure.
            </p>

            <div className="mt-10 space-y-5">
              <Bullet text="Live GPS tracking" />
              <Bullet text="AIS traffic awareness" />
              <Bullet text="Collision prediction systems" />
              <Bullet text="Engineering monitoring" />
              <Bullet text="AI operational reports" />
              <Bullet text="Fleet-wide management" />
            </div>
          </div>

          <div className="rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-300">BridgeOS</p>
                <h3 className="mt-3 text-5xl font-black">
                  Live Systems
                </h3>
              </div>

              <Waves className="h-14 w-14 text-cyan-400" />
            </div>

            <div className="mt-12 space-y-5">
              <Metric title="AIS Targets" value="18" />
              <Metric title="Fuel Analytics" value="Realtime" />
              <Metric title="Engine Status" value="Operational" />
              <Metric title="Weather Routing" value="Active" />
              <Metric title="Fleet Sync" value="Online" />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-10 text-gray-500 lg:flex-row">
          <div className="flex items-center gap-3">
            <Ship className="h-6 w-6 text-cyan-400" />
            <span className="text-lg font-bold text-white">
              BlueDeck YachtOS
            </span>
          </div>

          <p>
            Enterprise Superyacht Operating Platform
          </p>
        </div>
      </footer>
    </main>
  );
}

function GlassCard({
  title,
  value,
  text,
}: {
  title: string;
  value: string;
  text: string;
}) {
  return (
    <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
      <p className="text-gray-400">{title}</p>

      <h3 className="mt-4 text-5xl font-black">
        {value}
      </h3>

      <p className="mt-5 text-lg leading-relaxed text-gray-400">
        {text}
      </p>
    </div>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-3 w-3 rounded-full bg-cyan-400" />
      <p className="text-lg text-gray-300">
        {text}
      </p>
    </div>
  );
}

function Metric({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="text-gray-400">{title}</p>

      <p className="text-2xl font-black text-white">
        {value}
      </p>
    </div>
  );
}
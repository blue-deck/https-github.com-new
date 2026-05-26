"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BlueDeckLogoLink } from "./components/BlueDeckLogo";
import {
  Anchor,
  ChevronRight,
  Crown,
  FileLock2,
  Radio,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";

const productAreas = [
  {
    icon: Crown,
    title: "Owner Experience",
    text: "A quiet private view for yacht readiness, location, privacy, guest comfort and concierge moments.",
  },
  {
    icon: Radio,
    title: "Captain Console",
    text: "Daily command center for voyage planning, alerts, crew status, documents and live operations.",
  },
  {
    icon: Users,
    title: "Crew Mobile",
    text: "Focused task lists, checklists and shift workflows for fast onboard execution.",
  },
  {
    icon: Wrench,
    title: "Engineering",
    text: "Maintenance, machinery readiness, fuel, spares and technical handover in one operational view.",
  },
];

const trustPoints = [
  "Role-based access",
  "Offline-ready PWA",
  "Document vault",
  "Private yacht mode",
  "Fleet-ready architecture",
  "Audit-ready activity history",
];

export default function HomePage() {
  return (
    <main className="bd-ocean-shell bd-home-shell min-h-screen overflow-hidden text-[#061831]">
      <header className="bd-home-header border-b border-cyan-100/10 bg-[#020817]/96 shadow-2xl shadow-slate-950/20 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-5 sm:px-8 lg:px-12">
            <BlueDeckLogoLink
              priority
              className="h-11 w-36 rounded-none border-0 bg-transparent shadow-none sm:h-12 sm:w-44"
              imageClassName="object-contain p-0"
            />

            <nav className="hidden items-center gap-8 rounded-full border border-white/10 bg-white/6 px-8 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/78 backdrop-blur-xl lg:flex">
              <a href="#platform" className="bd-focus hover:text-cyan-200">
                Yachts
              </a>
              <a href="#roles" className="bd-focus hover:text-cyan-200">
                Services
              </a>
              <a href="#trust" className="bd-focus hover:text-cyan-200">
                Management
              </a>
              <a href="#trust" className="bd-focus hover:text-cyan-200">
                Trust
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="bd-focus rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-bold text-white/90 backdrop-blur-xl transition hover:bg-white/16"
              >
                Login
              </Link>
              <Link
                href="/login?mode=signup"
                className="bd-focus rounded-full bg-cyan-200 px-5 py-3 text-sm font-bold text-[#020817] shadow-xl shadow-cyan-400/15 transition hover:bg-white"
              >
                Sign up
              </Link>
            </div>
        </div>
      </header>

      <section className="relative min-h-[calc(100vh-80px)]">
        <div className="bd-ocean-content mx-auto flex min-h-[calc(100vh-80px)] max-w-[1500px] flex-col justify-center px-5 sm:px-8 lg:px-12">
          <div className="flex items-center pb-20 pt-16 lg:min-h-[72vh]">
            <motion.div
              initial={{ opacity: 0, y: 34 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-4xl"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.42em] text-[#526b83]">
                Own the experience
              </p>

              <h1 className="bd-serif mt-7 text-5xl leading-[1.02] tracking-[-0.02em] text-[#071f3c] sm:text-6xl lg:text-7xl xl:text-8xl">
                Manage Your Yacht.
                <br />
                Live Your Freedom.
              </h1>

              <p className="mt-8 max-w-xl text-lg leading-8 text-[#61758a]">
                BlueDeck brings yacht management, crew workflows, documents,
                contracts and readiness into one calm private command platform.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/login?mode=signup"
                  className="bd-focus inline-flex items-center justify-center gap-3 rounded-full bg-[#061831] px-8 py-4 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-2xl shadow-cyan-950/18 transition hover:bg-cyan-800"
                >
                  Create Account
                  <ChevronRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/login"
                  className="bd-focus inline-flex items-center justify-center gap-3 rounded-full border border-[#061831]/22 bg-white/18 px-8 py-4 text-xs font-bold uppercase tracking-[0.18em] text-[#061831] backdrop-blur-xl transition hover:bg-white/70"
                >
                  View Your Yacht
                  <Anchor className="h-5 w-5" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="platform" className="bd-ocean-content mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="bd-kicker">Platform</p>
            <h2 className="bd-serif mt-4 text-4xl font-normal leading-tight text-[#071f3c] sm:text-6xl">
              Built around the way a private yacht actually runs.
            </h2>
          </div>
          <p className="text-lg leading-8 text-[#61758a]">
            BlueDeck separates the experience by role, keeps the daily view
            simple, and brings advanced modules one level deeper. The result is
            less noise for owners, faster action for crew and clearer control
            for captains.
          </p>
        </div>

        <div id="roles" className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {productAreas.map((area) => {
            const Icon = area.icon;

            return (
              <article key={area.title} className="bd-glass-card rounded-[28px] p-6 transition hover:-translate-y-1 hover:bg-white/90">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200 bg-white/70 text-cyan-700">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-[#071f3c]">
                  {area.title}
                </h3>
                <p className="mt-3 leading-7 text-[#61758a]">{area.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="trust" className="bd-ocean-content border-y border-[#061831]/10 bg-white/30 backdrop-blur">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
          <div>
            <p className="bd-kicker">Trust Layer</p>
            <h2 className="bd-serif mt-4 text-4xl font-normal leading-tight text-[#071f3c] sm:text-6xl">
              Luxury should feel effortless. Operations should be traceable.
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {trustPoints.map((point) => (
              <div key={point} className="flex items-center gap-3 rounded-2xl border border-[#061831]/10 bg-white/60 p-4 shadow-sm backdrop-blur">
                <FileLock2 className="h-5 w-5 text-cyan-700" />
                <span className="font-medium text-[#071f3c]">{point}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bd-ocean-content mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-14 sm:px-8 md:flex-row md:items-center lg:px-10">
        <div>
          <p className="bd-kicker">BlueDeck YachtOS</p>
          <h2 className="bd-serif mt-3 text-4xl font-normal text-[#071f3c]">
            Ready for real captain, owner and crew workflows.
          </h2>
        </div>
        <Link
          href="/login?mode=signup"
          className="bd-focus inline-flex items-center justify-center gap-2 rounded-full bg-[#061831] px-7 py-4 font-bold text-white shadow-xl shadow-cyan-950/16 transition hover:bg-cyan-800"
        >
          Join BlueDeck
          <Sparkles className="h-5 w-5" />
        </Link>
      </section>
    </main>
  );
}

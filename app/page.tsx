"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Anchor,
  ChevronRight,
  Crown,
  FileLock2,
  Radio,
  Ship,
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
    <main className="bd-shell min-h-screen overflow-hidden text-[#eef7ff]">
      <section className="relative min-h-screen border-b border-white/10">
        <Image
          src="/bluedeck-hero-v2.png"
          alt="Luxury superyacht bridge with digital navigation systems"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,9,20,0.96)_0%,rgba(5,9,20,0.82)_38%,rgba(5,9,20,0.28)_72%,rgba(5,9,20,0.66)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-[linear-gradient(180deg,rgba(5,9,20,0),#020817)]" />

        <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-between px-5 py-6 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between">
            <Link href="/" className="bd-focus flex items-center gap-3 rounded-full">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#22d3ee]/35 bg-[#22d3ee]/15 text-[#22d3ee]">
                <Ship className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-[#22d3ee]">
                  BlueDeck
                </span>
                <span className="block text-xs text-[#aeb8c8]">
                  YachtOS
                </span>
              </span>
            </Link>

            <nav className="hidden items-center gap-2 rounded-full border border-white/10 bg-black/25 p-1 backdrop-blur-xl md:flex">
              <a href="#platform" className="bd-focus rounded-full px-4 py-2 text-sm text-[#d8deea] hover:bg-white/10">
                Platform
              </a>
              <a href="#roles" className="bd-focus rounded-full px-4 py-2 text-sm text-[#d8deea] hover:bg-white/10">
                Roles
              </a>
              <a href="#trust" className="bd-focus rounded-full px-4 py-2 text-sm text-[#d8deea] hover:bg-white/10">
                Trust
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="bd-focus rounded-full border border-white/15 bg-white/[0.08] px-5 py-3 text-sm font-bold text-white backdrop-blur-xl transition hover:bg-white/[0.14]"
              >
                Login
              </Link>
              <Link
                href="/login?mode=signup"
                className="bd-focus rounded-full bg-[#eef7ff] px-5 py-3 text-sm font-bold text-[#020817] transition hover:bg-[#22d3ee]"
              >
                Sign up
              </Link>
            </div>
          </header>

          <div className="flex items-end pb-12 pt-24 lg:pb-20">
            <motion.div
              initial={{ opacity: 0, y: 34 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-4xl"
            >
              <p className="bd-kicker">Private Superyacht Operating System</p>

              <h1 className="mt-5 text-5xl font-semibold leading-[1.02] text-white sm:text-7xl lg:text-8xl">
                BlueDeck
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#d8deea] sm:text-xl">
                A premium command platform for owners, captains and crew:
                live bridge intelligence, yacht readiness, private owner
                experience and operational control in one calm interface.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login?mode=signup"
                  className="bd-focus inline-flex items-center justify-center gap-2 rounded-full bg-[#22d3ee] px-7 py-4 font-bold text-[#020817] transition hover:bg-[#eef7ff]"
                >
                  Create Account
                  <ChevronRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/login"
                  className="bd-focus inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-7 py-4 font-bold text-white backdrop-blur-xl transition hover:bg-white/[0.14]"
                >
                  Login
                  <Anchor className="h-5 w-5" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="platform" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="bd-kicker">Platform</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Built around the way a private yacht actually runs.
            </h2>
          </div>
          <p className="text-lg leading-8 text-[#aeb8c8]">
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
              <article key={area.title} className="bd-panel-soft rounded-2xl p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#22d3ee]/15 text-[#22d3ee]">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-white">
                  {area.title}
                </h3>
                <p className="mt-3 leading-7 text-[#aeb8c8]">{area.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="trust" className="border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
          <div>
            <p className="bd-kicker">Trust Layer</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Luxury should feel effortless. Operations should be traceable.
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {trustPoints.map((point) => (
              <div key={point} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                <FileLock2 className="h-5 w-5 text-[#22d3ee]" />
                <span className="font-medium text-[#eef7ff]">{point}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-14 sm:px-8 md:flex-row md:items-center lg:px-10">
        <div>
          <p className="bd-kicker">BlueDeck YachtOS</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">
            Ready for real captain, owner and crew workflows.
          </h2>
        </div>
        <Link
          href="/login?mode=signup"
          className="bd-focus inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-4 font-bold text-[#020817] transition hover:bg-[#22d3ee]"
        >
          Join BlueDeck
          <Sparkles className="h-5 w-5" />
        </Link>
      </section>
    </main>
  );
}

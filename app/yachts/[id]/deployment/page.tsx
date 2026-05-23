"use client";

import { Rocket, Globe, Database, Shield, Smartphone, CheckCircle } from "lucide-react";

const steps = [
  ["Vercel Deploy", "Push project to GitHub, import into Vercel and deploy.", Rocket],
  ["Environment Variables", "Add Supabase URL and anon key in Vercel project settings.", Shield],
  ["Domain", "Connect custom domain from Vercel Domains.", Globe],
  ["Database", "Keep Supabase project active and policies configured.", Database],
  ["PWA", "Manifest and offline shell are already prepared.", Smartphone],
  ["Production QA", "Test navigation, crew, engineering, reports and live GPS.", CheckCircle],
];

export default function DeploymentPage() {
  return (
    <main className="min-h-screen bg-[#020817] p-8 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
          <p className="text-cyan-300">BlueDeck Production</p>
          <h1 className="mt-3 text-6xl font-black">Deployment Center</h1>
          <p className="mt-5 max-w-3xl text-xl text-gray-400">
            Final production checklist for Vercel, domain, Supabase and mobile PWA deployment.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {steps.map(([title, text, Icon]: any) => (
            <div key={title} className="rounded-[36px] border border-white/10 bg-white/5 p-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400 text-black">
                <Icon className="h-8 w-8" />
              </div>
              <h2 className="mt-8 text-4xl font-black">{title}</h2>
              <p className="mt-5 text-xl leading-relaxed text-gray-400">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
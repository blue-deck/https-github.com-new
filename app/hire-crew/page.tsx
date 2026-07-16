import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  ClipboardCheck,
  FileCheck2,
  Handshake,
  Search,
  ShieldCheck,
  Ship,
  Users,
} from "lucide-react";
import { PublicPageShell } from "../components/PublicSiteChrome";

export const metadata: Metadata = {
  title: "Hire Professional Yacht Crew",
  description:
    "Post structured yacht jobs, review BlueDeck crew applications and connect the successful hire to invitations, contracts and onboarding.",
  alternates: { canonical: "/hire-crew" },
};

const hiringSteps = [
  {
    icon: BriefcaseBusiness,
    title: "Create a complete role",
    text: "Capture position, department, vessel profile, contract, location, dates, salary visibility and real requirements.",
  },
  {
    icon: Search,
    title: "Review consistent applications",
    text: "Compare candidates against the same structured job criteria and a professional BlueDeck profile.",
  },
  {
    icon: Users,
    title: "Move candidates through one pipeline",
    text: "Keep new, reviewing, shortlisted, interview, offer and hired decisions visible to the hiring team.",
  },
  {
    icon: Handshake,
    title: "Confirm the successful hire",
    text: "Record the final hiring decision while preserving the job and candidate history.",
  },
  {
    icon: Ship,
    title: "Invite to the yacht",
    text: "Connect the hire to the existing BlueDeck yacht membership and crew invitation workflow.",
  },
  {
    icon: ClipboardCheck,
    title: "Onboard into YACHT-OS",
    text: "Continue with contracts, documents, crew lists, onboarding checklists and operational readiness.",
  },
];

export default function HireCrewPage() {
  return (
    <PublicPageShell
      eyebrow="For yacht employers"
      title="Recruit the right crew. Keep the successful hire connected."
      intro="BlueDeck combines a professional yacht recruitment desk with the operational platform already used for crew profiles, yacht invitations, contracts, documents and checklists."
    >
      <section className="bd-section pt-5">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {hiringSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <article key={step.title} className="bd-editorial-card">
                <div className="flex items-center justify-between">
                  <Icon className="h-7 w-7 text-cyan-700" />
                  <span className="text-xs font-black tracking-[0.18em] text-[#9aabb9]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h2 className="mt-7 text-2xl font-bold tracking-[-0.025em] text-[#071f3c]">
                  {step.title}
                </h2>
                <p className="mt-4 leading-7 text-[#5b7088]">{step.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bd-deep-band">
        <div className="mx-auto grid max-w-[1500px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:px-12">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-200">
              Trust before volume
            </p>
            <h2 className="mt-5 text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl">
              A professional marketplace protects both sides.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              [BadgeCheck, "Employer and yacht context"],
              [ShieldCheck, "Private candidate data controls"],
              [FileCheck2, "Structured requirements and records"],
              [ClipboardCheck, "Traceable hiring decisions"],
            ].map(([Icon, label]) => {
              const TrustIcon = Icon as typeof BadgeCheck;
              return (
                <div key={String(label)} className="flex items-center gap-3 border-b border-white/12 py-4 text-white/78">
                  <TrustIcon className="h-5 w-5 shrink-0 text-cyan-200" />
                  <span className="font-bold">{String(label)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-20 sm:px-8 lg:px-12">
        <div className="bd-cta-band">
          <div>
            <p className="bd-kicker">Launch your hiring desk</p>
            <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.04em] text-[#071f3c] sm:text-5xl">
              Publish a trusted yacht role and manage every candidate in one professional workspace.
            </h2>
          </div>
          <Link href="/hiring" className="bd-primary-cta shrink-0">
            Open hiring desk
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  ClipboardCheck,
  FileText,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { PublicPageShell } from "../components/PublicSiteChrome";

export const metadata: Metadata = {
  title: "For Yacht Crew",
  description:
    "Build a professional BlueDeck crew profile, find yacht jobs, apply once and keep applications, contracts and onboard work connected.",
  alternates: { canonical: "/for-crew" },
};

const benefits = [
  {
    icon: UserRound,
    title: "One professional identity",
    text: "Maintain your experience, preferred positions, skills, languages, references and BlueDeck CV in one place.",
  },
  {
    icon: Search,
    title: "Clear, structured opportunities",
    text: "Search by role, department, location, contract type and vessel details without guessing what the job involves.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Applications you can track",
    text: "See every submission and status in one private application centre instead of losing progress across messages.",
  },
  {
    icon: FileText,
    title: "Documents and contracts stay connected",
    text: "A successful placement can continue into the BlueDeck invitation, document and contract workflows you already use.",
  },
  {
    icon: ClipboardCheck,
    title: "Ready for the first day onboard",
    text: "Once hired, join the yacht workspace and move into onboarding, checklists and operational records.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy by design",
    text: "Public career pages use limited professional data. Sensitive contact and document details remain controlled.",
  },
];

export default function ForCrewPage() {
  return (
    <PublicPageShell
      eyebrow="For yacht crew"
      title="Your next role deserves a professional career system."
      intro="BlueDeck gives yacht crew a clear path from profile to application, offer, contract and onboard work—without rebuilding the same information at every step."
    >
      <section className="bd-section pt-5">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <article key={benefit.title} className="bd-editorial-card">
                <Icon className="h-7 w-7 text-cyan-700" />
                <h2 className="mt-7 text-2xl font-bold tracking-[-0.025em] text-[#071f3c]">
                  {benefit.title}
                </h2>
                <p className="mt-4 leading-7 text-[#5b7088]">{benefit.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 pb-20 sm:px-8 lg:px-12">
        <div className="bd-jobs-final-cta">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">
              Free for crew
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.04em] text-white sm:text-6xl">
              Build your profile once. Use it across your BlueDeck career.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/65">
              BlueDeck applications are free for crew during launch and your existing YACHT-OS
              features remain part of the same account.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/jobs" className="bd-primary-cta bd-primary-cta-light">
              Browse jobs
              <Search className="h-5 w-5" />
            </Link>
            <Link href="/login?mode=signup" className="bd-secondary-cta bd-secondary-cta-dark">
              Create crew profile
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}

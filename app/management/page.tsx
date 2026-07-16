import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Handshake,
  Search,
  Ship,
  Users,
} from "lucide-react";
import { PublicPageShell } from "../components/PublicSiteChrome";

export const metadata: Metadata = {
  title: "Yacht Crew Management & Recruitment",
  description:
    "Plan roles, recruit professional yacht crew and connect each successful hire to BlueDeck contracts, onboarding and operational workflows.",
  alternates: { canonical: "/management" },
  openGraph: {
    title: "Yacht Crew Management & Recruitment | BlueDeck",
    description:
      "A connected management workflow from workforce need and job publication to hiring, onboarding and yacht readiness.",
    url: "/management",
    type: "website",
  },
};

const managementWorkflow = [
  {
    icon: Search,
    title: "Define the workforce need",
    text: "Start with the actual yacht program, department, position, timing, contract and operational expectations.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Publish a complete opportunity",
    text: "Present crew with a structured role that makes the vessel context and requirements clear.",
  },
  {
    icon: Users,
    title: "Review one consistent pipeline",
    text: "Keep applicants, review decisions, shortlist, interview, offer and final outcome visible in one workspace.",
  },
  {
    icon: Handshake,
    title: "Confirm the hire",
    text: "Preserve the relationship between the role, the selected candidate and the responsible employer.",
  },
  {
    icon: FileText,
    title: "Move into contracts and yacht access",
    text: "Continue into invitations, membership, documents and contract workflows with the same BlueDeck identity.",
  },
  {
    icon: ClipboardCheck,
    title: "Onboard and operate",
    text: "Bring the new crew member into checklists, crew lists, readiness, maintenance and daily yacht operations.",
  },
];

const managementLanes = [
  {
    title: "Recruitment desk",
    text: "Employer profile, structured jobs, applicant pipeline and hiring decisions.",
  },
  {
    title: "Crew administration",
    text: "Professional profiles, invitations, yacht membership, hierarchy and crew records.",
  },
  {
    title: "Contracts & compliance",
    text: "Documents, expiry awareness, contracts, signature and connected records.",
  },
  {
    title: "Operational readiness",
    text: "Tasks, checklists, reports, logs, maintenance, inventory and yacht status.",
  },
];

export default function ManagementPage() {
  return (
    <PublicPageShell
      eyebrow="Recruitment-led yacht management"
      title="Build the crew pipeline and the onboard operation in one system."
      intro="BlueDeck puts professional hiring at the front of crew management, then protects the operational continuity yacht owners, captains and management teams need after the offer is accepted."
    >
      <section className="bd-section pt-5">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="bd-deep-card h-fit lg:sticky lg:top-28">
            <Ship className="h-8 w-8 text-cyan-200" />
            <p className="mt-7 text-xs font-black uppercase tracking-[0.28em] text-cyan-200">
              The connected model
            </p>
            <h2 className="bd-serif mt-4 text-4xl leading-tight text-white">
              Recruit once. Carry the trusted record forward.
            </h2>
            <p className="mt-5 leading-8 text-white/62">
              Hiring information should not disappear into email after the
              decision. BlueDeck keeps the role, candidate and yacht relationship
              connected to the operational workspace.
            </p>
            <Link
              href="/hire-crew"
              className="mt-8 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-200"
            >
              Explore the hiring model
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4">
            {managementWorkflow.map((step, index) => {
              const Icon = step.icon;
              return (
                <article
                  key={step.title}
                  className="grid gap-4 rounded-3xl border border-[#071f3c]/10 bg-white p-6 shadow-[0_20px_60px_rgba(7,31,60,0.055)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-800">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-xl font-black text-[#071f3c]">
                      {step.title}
                    </h3>
                    <p className="mt-2 leading-7 text-[#5b7088]">
                      {step.text}
                    </p>
                  </div>
                  <span className="text-xs font-black tracking-[0.16em] text-[#9aabb9]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-[#071f3c]/10 bg-white">
        <div className="mx-auto max-w-[1500px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="bd-kicker">Management coverage</p>
              <h2 className="mt-4 text-4xl font-black tracking-[-0.045em] text-[#071f3c] sm:text-6xl">
                Every existing YACHT-OS capability stays in place.
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-[#5b7088] lg:justify-self-end">
              Recruitment becomes the first connected stage; it does not replace
              the crew, document, contract, checklist and operational tools
              already built into BlueDeck.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {managementLanes.map((lane) => (
              <article key={lane.title} className="bd-editorial-card">
                <CheckCircle2 className="h-6 w-6 text-cyan-700" />
                <h3 className="mt-6 text-2xl font-black text-[#071f3c]">
                  {lane.title}
                </h3>
                <p className="mt-3 leading-7 text-[#5b7088]">
                  {lane.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
        <div className="bd-jobs-final-cta">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">
              BlueDeck hiring workspace
            </p>
            <h2 className="mt-4 max-w-4xl text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl">
              Turn the next vacancy into a connected onboard relationship.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/hiring"
              className="bd-primary-cta bd-primary-cta-light"
            >
              Open hiring desk
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/login"
              className="bd-secondary-cta bd-secondary-cta-dark"
            >
              Sign in to YACHT-OS
            </Link>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}

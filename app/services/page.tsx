import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Handshake,
  Radio,
  Search,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { PublicPageShell } from "../components/PublicSiteChrome";

export const metadata: Metadata = {
  title: "Yacht Recruitment & YACHT-OS Services",
  description:
    "Find yacht jobs, recruit professional crew and connect every successful hire to BlueDeck profiles, contracts, onboarding and yacht operations.",
  alternates: { canonical: "/services" },
  openGraph: {
    title: "Yacht Recruitment & YACHT-OS Services | BlueDeck",
    description:
      "Professional yacht recruitment and connected crew operations in one BlueDeck workflow.",
    url: "/services",
    type: "website",
  },
};

const recruitmentServices = [
  {
    icon: Search,
    title: "Yacht jobs discovery",
    text: "A focused public board where crew can explore published roles by position, department, contract type and location.",
    href: "/jobs",
    action: "Browse yacht jobs",
  },
  {
    icon: UserRoundCheck,
    title: "Professional crew applications",
    text: "Candidates apply from a structured BlueDeck profile and keep every private application and status in one career centre.",
    href: "/for-crew",
    action: "See the crew journey",
  },
  {
    icon: BriefcaseBusiness,
    title: "Employer hiring workspace",
    text: "Verified employers can prepare complete roles, review candidates and manage the path from application to hiring decision.",
    href: "/hire-crew",
    action: "Explore crew hiring",
  },
  {
    icon: Handshake,
    title: "Hire-to-onboard continuity",
    text: "The successful candidate can continue into yacht invitations, contracts, documents and onboarding without rebuilding their record.",
    href: "/hiring",
    action: "Open the hiring desk",
  },
];

const yachtOsServices = [
  {
    icon: Users,
    title: "Crew profiles & yacht membership",
    text: "Maintain professional crew identities, yacht access, invitations, hierarchy and connected working relationships.",
  },
  {
    icon: FileText,
    title: "Documents & contracts",
    text: "Keep crew documents, operational records, contract preparation and signature workflows connected to the right people and yacht.",
  },
  {
    icon: ClipboardCheck,
    title: "Tasks, checklists & proof",
    text: "Build recurring or one-time workflows, assign responsibility and retain completion evidence for daily yacht operations.",
  },
  {
    icon: Radio,
    title: "Readiness & live operations",
    text: "Bring yacht status, alerts, logs, maintenance, inventory and operational awareness into one controlled workspace.",
  },
  {
    icon: FileCheck2,
    title: "Crew lists & reporting",
    text: "Use the same trusted records for crew lists, reports, timelines, onboarding and operational handovers.",
  },
  {
    icon: ShieldCheck,
    title: "Protected access & data controls",
    text: "Keep public recruitment data limited while private crew, employer and yacht records remain permission-scoped.",
  },
];

export default function ServicesPage() {
  return (
    <PublicPageShell
      eyebrow="BlueDeck platform services"
      title="Recruit exceptional crew. Keep the whole yacht operation connected."
      intro="BlueDeck starts with professional yacht jobs and hiring, then carries the successful relationship into the YACHT-OS tools already built for profiles, contracts, documents, checklists and daily operations."
    >
      <section className="bd-section pt-5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="bd-kicker">Recruitment first</p>
            <h2 className="mt-4 max-w-4xl text-4xl font-black tracking-[-0.045em] text-[#071f3c] sm:text-6xl">
              One professional path from opportunity to signed-on crew.
            </h2>
          </div>
          <p className="max-w-xl text-lg leading-8 text-[#5b7088]">
            Crew and employers work from consistent records, clear status and
            one connected account—not fragmented messages and repeated forms.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {recruitmentServices.map((service, index) => {
            const Icon = service.icon;
            return (
              <Link
                key={service.title}
                href={service.href}
                className="bd-feature-panel group"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#07182d] text-cyan-200">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="text-xs font-black tracking-[0.18em] text-[#9aabb9]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-7 text-3xl font-black tracking-[-0.03em] text-[#071f3c]">
                  {service.title}
                </h3>
                <p className="mt-4 max-w-xl leading-7 text-[#5b7088]">
                  {service.text}
                </p>
                <span className="mt-7 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-cyan-800">
                  {service.action}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="bd-deep-band">
        <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-8 lg:px-12">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-200">
                BlueDeck YACHT-OS
              </p>
              <h2 className="mt-5 text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl">
                Hiring is the beginning—not the end of the workflow.
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-white/65 lg:justify-self-end">
              Every established BlueDeck operational capability remains part of
              the platform and becomes more useful when it starts with a trusted
              recruitment record.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {yachtOsServices.map((service) => {
              const Icon = service.icon;
              return (
                <article
                  key={service.title}
                  className="rounded-3xl border border-white/12 bg-white/7 p-6 backdrop-blur-sm"
                >
                  <Icon className="h-6 w-6 text-cyan-200" />
                  <h3 className="mt-6 text-xl font-black text-white">
                    {service.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-white/62">
                    {service.text}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
        <div className="bd-cta-band">
          <div>
            <p className="bd-kicker">Choose your starting point</p>
            <h2 className="bd-serif mt-3 max-w-4xl text-4xl text-[#071f3c] sm:text-5xl">
              Search for your next role or build your hiring pipeline.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/jobs" className="bd-primary-cta">
              Find yacht jobs
              <Search className="h-5 w-5" />
            </Link>
            <Link href="/hiring" className="bd-secondary-cta">
              Open hiring workspace
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}

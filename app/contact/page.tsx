import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  LifeBuoy,
  Mail,
  MapPin,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { PublicPageShell } from "../components/PublicSiteChrome";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact BlueDeck about yacht jobs, crew hiring, employer access, partnerships or connected YACHT-OS operations.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact BlueDeck | Yacht Jobs & Crew Hiring",
    description:
      "Get the right BlueDeck route for crew careers, yacht employers, hiring access and platform support.",
    url: "/contact",
    type: "website",
  },
};

const contactRoutes = [
  {
    icon: UserRound,
    title: "Yacht crew & candidates",
    text: "Search published roles, complete your crew profile and track your private applications.",
    href: "/jobs",
    action: "Browse yacht jobs",
  },
  {
    icon: Building2,
    title: "Yacht employers",
    text: "Understand the recruitment workflow, employer verification and the path from job post to onboarding.",
    href: "/hire-crew",
    action: "Explore hiring crew",
  },
  {
    icon: BriefcaseBusiness,
    title: "Hiring workspace",
    text: "Already preparing roles or reviewing applicants? Continue in the protected employer workspace.",
    href: "/hiring",
    action: "Open hiring desk",
  },
  {
    icon: LifeBuoy,
    title: "Platform & YACHT-OS support",
    text: "For account, access, yacht workspace or operational workflow questions, contact the BlueDeck team directly.",
    href: "mailto:info@bluedeck.app?subject=BlueDeck%20Platform%20Support",
    action: "Email platform support",
  },
];

export default function ContactPage() {
  return (
    <PublicPageShell
      eyebrow="Contact BlueDeck"
      title="Start with the right route. Reach the team when you need us."
      intro="Whether you are looking for your next yacht role, recruiting crew or connecting a successful hire to YACHT-OS, BlueDeck keeps the next step clear."
    >
      <section className="bd-section pt-5">
        <div className="grid gap-5 md:grid-cols-2">
          {contactRoutes.map((route) => {
            const Icon = route.icon;
            const external = route.href.startsWith("mailto:");

            return (
              <Link
                key={route.title}
                href={route.href}
                className="bd-feature-panel group"
                {...(external ? { prefetch: false } : {})}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#07182d] text-cyan-200">
                  <Icon className="h-6 w-6" />
                </span>
                <h2 className="mt-7 text-3xl font-black tracking-[-0.03em] text-[#071f3c]">
                  {route.title}
                </h2>
                <p className="mt-4 max-w-xl leading-7 text-[#5b7088]">
                  {route.text}
                </p>
                <span className="mt-7 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-cyan-800">
                  {route.action}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 pb-16 sm:px-8 lg:px-12 lg:pb-20">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bd-deep-card">
            <Mail className="h-7 w-7 text-cyan-200" />
            <p className="mt-7 text-xs font-black uppercase tracking-[0.28em] text-cyan-200">
              Direct contact
            </p>
            <h2 className="bd-serif mt-4 text-4xl leading-tight text-white">
              A real question deserves a direct answer.
            </h2>
            <p className="mt-5 max-w-xl leading-8 text-white/62">
              Include whether your enquiry relates to crew careers, hiring,
              employer verification, partnerships or a yacht workspace so it can
              be routed correctly.
            </p>
            <a
              href="mailto:info@bluedeck.app"
              className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-full bg-white px-6 text-sm font-black text-[#07182d] transition hover:-translate-y-0.5 hover:bg-cyan-50"
            >
              info@bluedeck.app
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="grid gap-4">
            <ContactLine
              icon={<Mail className="h-5 w-5" />}
              title="Email"
              text="info@bluedeck.app"
            />
            <ContactLine
              icon={<MapPin className="h-5 w-5" />}
              title="Operating focus"
              text="Professional yacht recruitment, crew careers and connected yacht operations."
            />
            <ContactLine
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Account and data access"
              text="Private candidate, employer and yacht records require the correct authenticated account."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-[#071f3c]/10 bg-white">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-5 py-12 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <div>
            <p className="bd-kicker">Looking for an immediate next step?</p>
            <h2 className="mt-3 text-3xl font-black text-[#071f3c]">
              Search for work or start building the crew pipeline.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/jobs" className="bd-primary-cta">
              Find yacht jobs
              <Search className="h-5 w-5" />
            </Link>
            <Link href="/hire-crew" className="bd-secondary-cta">
              Hire yacht crew
            </Link>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}

function ContactLine({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="bd-editorial-card flex items-start gap-4">
      <span className="mt-1 text-cyan-700">{icon}</span>
      <div>
        <h2 className="text-xl font-black text-[#071f3c]">{title}</h2>
        <p data-i18n-ignore className="mt-2 leading-7 text-[#5b7088]">
          {text}
        </p>
      </div>
    </div>
  );
}

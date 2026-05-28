import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Crown,
  FileText,
  Radio,
  ShieldCheck,
  Ship,
  Users,
} from "lucide-react";
import { PublicFooter, PublicHeader } from "./components/PublicSiteChrome";

const servicePillars = [
  {
    icon: Ship,
    title: "Yacht Management",
    text: "A private workspace for vessel data, documents, readiness, crew status and operational records.",
  },
  {
    icon: Users,
    title: "Crew Operations",
    text: "Crew profiles, invitations, contracts, document expiry alerts and onboard checklist workflows.",
  },
  {
    icon: Crown,
    title: "Owner Experience",
    text: "A calm owner view focused on privacy, guest comfort, readiness, location and high-level confidence.",
  },
  {
    icon: Radio,
    title: "Bridge Readiness",
    text: "Navigation, watch, passage, arrival and departure workflows structured for captain-grade oversight.",
  },
];

const websiteSections = [
  "Private account and role-based access",
  "Crew CV, document vault and expiry monitoring",
  "Captain invitations, yacht contracts and mobile signing",
  "Checklist System with crew progress and proof records",
  "IMO crew list, yacht documents and operational history",
  "Owner, captain and crew areas connected under one brand",
];

export default function HomePage() {
  return (
    <main className="bd-site-shell min-h-screen overflow-hidden pt-[92px] text-[#071f3c]">
      <PublicHeader />

      <section className="bd-home-hero">
        <div className="mx-auto flex min-h-[calc(100vh-92px)] max-w-[1500px] items-center px-5 py-16 sm:px-8 lg:px-12">
          <div className="max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.42em] text-[#58718c]">
              Own the experience
            </p>
            <h1 className="bd-serif mt-7 text-5xl leading-[1.02] text-[#071f3c] sm:text-7xl lg:text-8xl">
              Manage Your Yacht.
              <br />
              Live Your Freedom.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-[#526b83]">
              BlueDeck brings yacht management, crew workflows, documents,
              contracts and operational readiness into one elegant private website.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link href="/login?mode=signup" className="bd-primary-cta">
                Create Account
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/services" className="bd-secondary-cta">
                Explore Services
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="yacht-platform" className="bd-section">
        <div className="grid gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
          <div>
            <p className="bd-kicker">BlueDeck Platform</p>
            <h2 className="bd-serif mt-4 text-4xl leading-tight text-[#071f3c] sm:text-6xl">
              A yacht website that works like a private operations office.
            </h2>
          </div>
          <p className="text-lg leading-8 text-[#5b7088]">
            BlueDeck is designed for the real structure of a yacht: owner,
            captain, officers, departments and crew. The public site stays calm
            and premium; secure areas open only after login.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {servicePillars.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="bd-editorial-card">
                <Icon className="h-7 w-7 text-cyan-700" />
                <h3 className="mt-7 text-2xl font-semibold text-[#071f3c]">{item.title}</h3>
                <p className="mt-4 leading-7 text-[#5b7088]">{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bd-deep-band">
        <div className="mx-auto grid max-w-[1500px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-12">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.36em] text-cyan-200">Private YachtOS</p>
            <h2 className="bd-serif mt-5 text-4xl leading-tight text-white sm:text-6xl">
              Built for traceable operations without losing the luxury feeling.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {websiteSections.map((item) => (
              <div key={item} className="flex items-start gap-3 border-b border-white/12 pb-4 text-white/78">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
                <span className="leading-7">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bd-section">
        <div className="grid gap-6 lg:grid-cols-3">
          <FeaturePanel
            icon={<ClipboardCheck className="h-7 w-7" />}
            title="Checklist System"
            text="Assign duties, track completion, inspect before/after proof and keep records clear."
            href="/login"
          />
          <FeaturePanel
            icon={<FileText className="h-7 w-7" />}
            title="Document Control"
            text="Crew documents, yacht papers, contracts and expiry alerts organized in one secure flow."
            href="/services"
          />
          <FeaturePanel
            icon={<ShieldCheck className="h-7 w-7" />}
            title="Trust & Privacy"
            text="Account-based access, privacy-focused structure and professional legal pages."
            href="/trust"
          />
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 pb-20 sm:px-8 lg:px-12">
        <div className="bd-cta-band">
          <div>
            <p className="bd-kicker">Start BlueDeck</p>
            <h2 className="bd-serif mt-4 text-4xl leading-tight text-[#071f3c] sm:text-6xl">
              Open a private account and build your yacht workspace.
            </h2>
          </div>
          <Link href="/login?mode=signup" className="bd-primary-cta shrink-0">
            Sign up
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

function FeaturePanel({
  icon,
  title,
  text,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  href: string;
}) {
  return (
    <Link href={href} className="bd-feature-panel">
      <span className="text-cyan-700">{icon}</span>
      <h3 className="mt-6 text-3xl font-semibold text-[#071f3c]">{title}</h3>
      <p className="mt-4 leading-7 text-[#5b7088]">{text}</p>
      <span className="mt-8 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-cyan-800">
        View details
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

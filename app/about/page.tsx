import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Compass,
  Handshake,
  Search,
  ShieldCheck,
  Ship,
  Users,
} from "lucide-react";
import { PublicPageShell } from "../components/PublicSiteChrome";

export const metadata: Metadata = {
  title: "About",
  description:
    "BlueDeck connects professional yacht jobs and crew hiring with profiles, contracts, onboarding and daily yacht operations.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About BlueDeck | Yacht Careers & Connected Operations",
    description:
      "A professional yacht recruitment platform built to continue from first application into real onboard operations.",
    url: "/about",
    type: "website",
  },
};

const connectedJourney = [
  {
    icon: Search,
    title: "Discover",
    text: "Crew find structured, published yacht opportunities.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Apply",
    text: "Candidates use one professional BlueDeck profile.",
  },
  {
    icon: Users,
    title: "Select",
    text: "Employers manage a clear, consistent hiring pipeline.",
  },
  {
    icon: Handshake,
    title: "Hire",
    text: "The decision remains connected to the role and candidate.",
  },
  {
    icon: Ship,
    title: "Onboard",
    text: "The hire moves into invitations, contracts and yacht access.",
  },
  {
    icon: Compass,
    title: "Operate",
    text: "Crew continue into YACHT-OS workflows and readiness.",
  },
];

const principles = [
  {
    icon: CheckCircle2,
    title: "Professional clarity",
    text: "Roles, profiles and decisions should be structured enough to understand without unnecessary back-and-forth.",
  },
  {
    icon: ShieldCheck,
    title: "Trust and controlled visibility",
    text: "Public career information stays limited while private crew, employer and yacht records remain protected.",
  },
  {
    icon: Ship,
    title: "Operational continuity",
    text: "A successful placement should become a real onboard relationship—not a disconnected recruitment file.",
  },
];

export default function AboutPage() {
  return (
    <PublicPageShell
      eyebrow="About BlueDeck"
      title="The professional connection between yacht careers and yacht operations."
      intro="BlueDeck was built around a simple idea: finding the right person and running the yacht with that person should belong to the same trusted system."
    >
      <section id="vision" className="bd-section pt-5">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="bd-editorial-card">
            <p className="bd-kicker">Our vision</p>
            <h2 className="bd-serif mt-4 max-w-4xl text-4xl leading-tight text-[#071f3c] sm:text-5xl">
              Make yacht recruitment more credible, more efficient and
              genuinely connected to life onboard.
            </h2>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-[#5b7088]">
              Crew should be able to build one professional identity, discover
              suitable roles and understand each application. Employers should
              be able to hire from consistent information and continue directly
              into the operational tools their yacht needs.
            </p>
          </article>

          <article className="bd-deep-card">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">
              Our mission
            </p>
            <p className="bd-serif mt-5 text-3xl leading-tight text-white sm:text-4xl">
              Turn every trusted placement into a smoother, safer and more
              prepared yacht operation.
            </p>
            <div className="mt-8 border-t border-white/12 pt-6 text-sm leading-7 text-white/62">
              Yacht jobs first. Professional hiring next. Profiles, contracts,
              onboarding and YACHT-OS continuing from the same record.
            </div>
          </article>
        </div>
      </section>

      <section className="border-y border-[#071f3c]/10 bg-white">
        <div className="mx-auto max-w-[1500px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
          <p className="bd-kicker">One connected lifecycle</p>
          <h2 className="mt-4 max-w-4xl text-4xl font-black tracking-[-0.045em] text-[#071f3c] sm:text-6xl">
            From first search to the first day onboard—and beyond.
          </h2>

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {connectedJourney.map((step, index) => {
              const Icon = step.icon;
              return (
                <article
                  key={step.title}
                  className="rounded-3xl border border-[#071f3c]/10 bg-[#f7fafc] p-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#07182d] text-cyan-200">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-black tracking-[0.16em] text-[#9aabb9]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-6 text-2xl font-black text-[#071f3c]">
                    {step.title}
                  </h3>
                  <p className="mt-3 leading-7 text-[#5b7088]">
                    {step.text}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bd-section">
        <div className="grid gap-5 md:grid-cols-3">
          {principles.map((principle) => {
            const Icon = principle.icon;
            return (
              <article key={principle.title} className="bd-editorial-card">
                <Icon className="h-7 w-7 text-cyan-700" />
                <h2 className="mt-7 text-2xl font-black text-[#071f3c]">
                  {principle.title}
                </h2>
                <p className="mt-4 leading-7 text-[#5b7088]">
                  {principle.text}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 pb-20 sm:px-8 lg:px-12">
        <div className="bd-cta-band">
          <div>
            <p className="bd-kicker">Start with BlueDeck</p>
            <h2 className="bd-serif mt-3 max-w-3xl text-4xl text-[#071f3c] sm:text-5xl">
              Build your career or bring the right crew on board.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/jobs" className="bd-primary-cta">
              Browse yacht jobs
              <ArrowRight className="h-5 w-5" />
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

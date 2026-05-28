import Link from "next/link";
import { ArrowRight, ClipboardCheck, FileText, Radio, ShieldCheck, Ship, Users } from "lucide-react";
import { PublicPageShell } from "../components/PublicSiteChrome";

const services = [
  {
    icon: Ship,
    title: "Private Yacht Workspace",
    text: "Centralize yacht profile, flag, operating details, readiness, documents and connected crew records.",
  },
  {
    icon: Users,
    title: "Crew Profile & CV",
    text: "Crew members can create professional profiles, upload documents, manage expiry dates and build a clean CV.",
  },
  {
    icon: ClipboardCheck,
    title: "Checklist System",
    text: "Captains and authorized crew assign structured yacht checklists through the onboard hierarchy.",
  },
  {
    icon: FileText,
    title: "Contracts & Crew Lists",
    text: "Assign yacht contracts, collect acceptance and generate operational crew information from saved profile data.",
  },
  {
    icon: Radio,
    title: "Bridge & Operations",
    text: "Organize bridge, departure, arrival, watchkeeping and daily operational readiness in a dedicated workspace.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Alerts",
    text: "Track document expiry windows and keep personal and yacht records visible before they become critical.",
  },
];

export default function ServicesPage() {
  return (
    <PublicPageShell
      eyebrow="Services"
      title="Everything a private yacht team needs, without operational noise."
      intro="BlueDeck separates each workflow into a professional website structure: public brand pages, secure account access and private role-based yacht workspaces."
    >
      <section className="bd-section pt-4">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {services.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="bd-editorial-card">
                <Icon className="h-7 w-7 text-cyan-700" />
                <h2 className="mt-7 text-2xl font-semibold text-[#071f3c]">{item.title}</h2>
                <p className="mt-4 leading-7 text-[#5b7088]">{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 pb-20 sm:px-8 lg:px-12">
        <div className="bd-cta-band">
          <div>
            <p className="bd-kicker">Secure account</p>
            <h2 className="bd-serif mt-3 text-4xl text-[#071f3c]">
              Build the workflow inside your own BlueDeck profile.
            </h2>
          </div>
          <Link href="/login?mode=signup" className="bd-primary-cta">
            Create account
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
}

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { PublicPageShell } from "../components/PublicSiteChrome";

const workflow = [
  "Owner, captain, management and crew accounts are separated by role.",
  "Crew members maintain their own profile, documents, portfolio and CV.",
  "Captains invite crew into a yacht workspace and assign contracts or checklist duties.",
  "Checklist progress, timestamps and proof images stay attached to the yacht record.",
  "Document expiry alerts keep operational risk visible before it becomes urgent.",
];

export default function ManagementPage() {
  return (
    <PublicPageShell
      eyebrow="Management"
      title="A calmer way to manage crew, documents and vessel operations."
      intro="BlueDeck is built around real yacht hierarchy and daily operations. It keeps the public brand experience elegant while giving secure users the tools they need behind login."
    >
      <section className="bd-section pt-4">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="bd-editorial-card">
            <p className="bd-kicker">Operating Model</p>
            <h2 className="bd-serif mt-4 text-4xl leading-tight text-[#071f3c]">
              From crew profile to captain command, the flow stays connected.
            </h2>
            <p className="mt-5 leading-8 text-[#5b7088]">
              The platform avoids scattered files and chat-based follow-up by keeping
              each action connected to an account, yacht, role and date.
            </p>
          </div>

          <div className="grid gap-4">
            {workflow.map((item) => (
              <div key={item} className="flex items-start gap-4 border-b border-[#071f3c]/10 pb-5">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-cyan-700" />
                <p className="text-lg leading-8 text-[#40566f]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 pb-20 sm:px-8 lg:px-12">
        <div className="bd-deep-card">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-200">Captain Workspace</p>
          <h2 className="bd-serif mt-4 max-w-4xl text-4xl leading-tight text-white sm:text-6xl">
            Invite crew, manage contracts and open the Checklist System from one yacht workspace.
          </h2>
          <Link href="/login" className="mt-8 inline-flex items-center gap-3 font-black uppercase tracking-[0.16em] text-cyan-200">
            Login to workspace
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
}

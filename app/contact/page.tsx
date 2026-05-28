import Link from "next/link";
import { ArrowRight, Mail, MapPin, ShieldCheck } from "lucide-react";
import { PublicPageShell } from "../components/PublicSiteChrome";

export default function ContactPage() {
  return (
    <PublicPageShell
      eyebrow="Contact"
      title="Speak with BlueDeck about your yacht workspace."
      intro="For account, privacy, onboarding or yacht workspace questions, contact BlueDeck directly. The secure platform remains available through login."
    >
      <section className="bd-section pt-4">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bd-deep-card">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-200">Direct contact</p>
            <h2 className="bd-serif mt-4 text-4xl leading-tight text-white">
              A premium system should be easy to reach.
            </h2>
            <a href="mailto:info@bluedeck.app" className="mt-8 inline-flex items-center gap-3 rounded-full bg-white px-6 py-4 font-black text-[#07182d]">
              Email BlueDeck
              <Mail className="h-5 w-5" />
            </a>
          </div>

          <div className="grid gap-4">
            <ContactLine icon={<Mail className="h-5 w-5" />} title="Email" text="info@bluedeck.app" />
            <ContactLine icon={<MapPin className="h-5 w-5" />} title="Operations" text="Private yacht management and crew workflows" />
            <ContactLine icon={<ShieldCheck className="h-5 w-5" />} title="Account Access" text="Existing users can manage profile, settings and yacht modules after login." />
            <Link href="/login" className="bd-feature-panel">
              <h3 className="text-3xl font-semibold text-[#071f3c]">Already have an account?</h3>
              <span className="mt-6 inline-flex items-center gap-3 font-black uppercase tracking-[0.16em] text-cyan-800">
                Login to BlueDeck
                <ArrowRight className="h-5 w-5" />
              </span>
            </Link>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}

function ContactLine({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="bd-editorial-card flex items-start gap-4">
      <span className="text-cyan-700">{icon}</span>
      <div>
        <h2 className="text-xl font-semibold text-[#071f3c]">{title}</h2>
        <p className="mt-2 leading-7 text-[#5b7088]">{text}</p>
      </div>
    </div>
  );
}

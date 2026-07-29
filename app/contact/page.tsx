"use client";

import Link from "next/link";
import { ArrowRight, Mail, MapPin, ShieldCheck } from "lucide-react";
import { useLanguage } from "../components/LanguageProvider";
import { PublicPageShell } from "../components/PublicSiteChrome";

export default function ContactPage() {
  const { t } = useLanguage();

  return (
    <PublicPageShell
      eyebrow={t("contact.eyebrow")}
      title={t("contact.title")}
      intro={t("contact.intro")}
    >
      <section className="bd-section pt-4">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bd-deep-card">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-200">{t("contact.direct")}</p>
            <h2 className="bd-serif mt-4 text-4xl leading-tight text-white">
              {t("contact.directTitle")}
            </h2>
            <a href="mailto:info@bluedeck.app" className="bd-focus mt-8 inline-flex min-h-12 items-center gap-3 rounded-xl bg-white px-5 py-3 font-bold text-[#07182d]">
              {t("contact.emailBlueDeck")}
              <Mail className="h-5 w-5" />
            </a>
          </div>

          <div className="grid gap-4">
            <ContactLine icon={<MapPin className="h-5 w-5" />} title={t("contact.operationsTitle")} text={t("contact.operationsText")} />
            <ContactLine icon={<ShieldCheck className="h-5 w-5" />} title={t("contact.accessTitle")} text={t("contact.accessText")} />
            <Link href="/login" className="bd-feature-panel">
              <h3 className="text-3xl font-semibold text-[#071f3c]">{t("contact.haveAccount")}</h3>
              <span className="mt-6 inline-flex items-center gap-3 font-black uppercase tracking-[0.16em] text-cyan-800">
                {t("contact.loginBlueDeck")}
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

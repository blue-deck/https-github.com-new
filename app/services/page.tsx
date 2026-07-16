"use client";

import Link from "next/link";
import { ArrowRight, ClipboardCheck, FileText, Radio, ShieldCheck, Ship, Users } from "lucide-react";
import { type TranslationKey } from "../lib/i18n";
import { useLanguage } from "../components/LanguageProvider";
import { PublicPageShell } from "../components/PublicSiteChrome";

const services = [
  {
    icon: Ship,
    titleKey: "services.item1.title",
    textKey: "services.item1.text",
  },
  {
    icon: Users,
    titleKey: "services.item2.title",
    textKey: "services.item2.text",
  },
  {
    icon: ClipboardCheck,
    titleKey: "services.item3.title",
    textKey: "services.item3.text",
  },
  {
    icon: FileText,
    titleKey: "services.item4.title",
    textKey: "services.item4.text",
  },
  {
    icon: Radio,
    titleKey: "services.item5.title",
    textKey: "services.item5.text",
  },
  {
    icon: ShieldCheck,
    titleKey: "services.item6.title",
    textKey: "services.item6.text",
  },
] satisfies Array<{ icon: typeof Ship; titleKey: TranslationKey; textKey: TranslationKey }>;

export default function ServicesPage() {
  const { t } = useLanguage();

  return (
    <PublicPageShell
      eyebrow={t("services.eyebrow")}
      title={t("services.title")}
      intro={t("services.intro")}
    >
      <section className="bd-section pt-4">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {services.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.titleKey} className="bd-editorial-card">
                <Icon className="h-7 w-7 text-cyan-700" />
                <h2 className="mt-7 text-2xl font-semibold text-[#071f3c]">{t(item.titleKey)}</h2>
                <p className="mt-4 leading-7 text-[#5b7088]">{t(item.textKey)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 pb-20 sm:px-8 lg:px-12">
        <div className="bd-cta-band">
          <div>
            <p className="bd-kicker">{t("services.secureAccount")}</p>
            <h2 className="bd-serif mt-3 text-4xl text-[#071f3c]">
              {t("services.ctaTitle")}
            </h2>
          </div>
          <Link href="/login?mode=signup" className="bd-primary-cta">
            {t("home.createAccount")}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
}

"use client";

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
import { type TranslationKey } from "./lib/i18n";
import { PublicFooter, PublicHeader } from "./components/PublicSiteChrome";
import { useLanguage } from "./components/LanguageProvider";

const servicePillars = [
  {
    icon: Ship,
    titleKey: "home.pillar1.title",
    textKey: "home.pillar1.text",
  },
  {
    icon: Users,
    titleKey: "home.pillar2.title",
    textKey: "home.pillar2.text",
  },
  {
    icon: Crown,
    titleKey: "home.pillar3.title",
    textKey: "home.pillar3.text",
  },
  {
    icon: Radio,
    titleKey: "home.pillar4.title",
    textKey: "home.pillar4.text",
  },
] satisfies Array<{ icon: typeof Ship; titleKey: TranslationKey; textKey: TranslationKey }>;

const websiteSections = [
  "home.section1",
  "home.section2",
  "home.section3",
  "home.section4",
  "home.section5",
  "home.section6",
] satisfies TranslationKey[];

export default function HomePageClient() {
  const { t } = useLanguage();

  return (
    <main className="bd-site-shell min-h-screen overflow-hidden text-[#071f3c]">
      <PublicHeader />

      <section className="bd-home-hero">
        <div className="mx-auto flex min-h-[calc(100dvh-var(--public-header-height))] max-w-[1500px] items-center px-5 py-16 sm:px-8 lg:px-12">
          <div className="max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.42em] text-[#58718c]">
              {t("home.eyebrow")}
            </p>
            <h1 className="bd-serif mt-7 text-5xl leading-[1.02] text-[#071f3c] sm:text-7xl lg:text-8xl">
              {t("home.title1")}
              <br />
              {t("home.title2")}
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-[#526b83]">
              {t("home.intro")}
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link href="/login?mode=signup" className="bd-primary-cta">
                {t("home.createAccount")}
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/services" className="bd-secondary-cta">
                {t("home.exploreServices")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="yacht-platform" className="bd-section">
        <div className="grid gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
          <div>
            <p className="bd-kicker">{t("home.platformEyebrow")}</p>
            <h2 className="bd-serif mt-4 text-4xl leading-tight text-[#071f3c] sm:text-6xl">
              {t("home.platformTitle")}
            </h2>
          </div>
          <p className="text-lg leading-8 text-[#5b7088]">
            {t("home.platformIntro")}
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {servicePillars.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.titleKey} className="bd-editorial-card">
                <Icon className="h-7 w-7 text-cyan-700" />
                <h3 className="mt-7 text-2xl font-semibold text-[#071f3c]">{t(item.titleKey)}</h3>
                <p className="mt-4 leading-7 text-[#5b7088]">{t(item.textKey)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bd-deep-band">
        <div className="mx-auto grid max-w-[1500px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-12">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.36em] text-cyan-200">{t("home.deepEyebrow")}</p>
            <h2 className="bd-serif mt-5 text-4xl leading-tight text-white sm:text-6xl">
              {t("home.deepTitle")}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {websiteSections.map((itemKey) => (
              <div key={itemKey} className="flex items-start gap-3 border-b border-white/12 pb-4 text-white/78">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
                <span className="leading-7">{t(itemKey)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bd-section">
        <div className="grid gap-6 lg:grid-cols-3">
          <FeaturePanel
            icon={<ClipboardCheck className="h-7 w-7" />}
            titleKey="home.feature1.title"
            textKey="home.feature1.text"
            href="/login"
          />
          <FeaturePanel
            icon={<FileText className="h-7 w-7" />}
            titleKey="home.feature2.title"
            textKey="home.feature2.text"
            href="/services"
          />
          <FeaturePanel
            icon={<ShieldCheck className="h-7 w-7" />}
            titleKey="home.feature3.title"
            textKey="home.feature3.text"
            href="/trust"
          />
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 pb-20 sm:px-8 lg:px-12">
        <div className="bd-cta-band">
          <div>
            <p className="bd-kicker">{t("home.startEyebrow")}</p>
            <h2 className="bd-serif mt-4 text-4xl leading-tight text-[#071f3c] sm:text-6xl">
              {t("home.startTitle")}
            </h2>
          </div>
          <Link href="/login?mode=signup" className="bd-primary-cta shrink-0">
            {t("auth.signUp")}
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
  titleKey,
  textKey,
  href,
}: {
  icon: React.ReactNode;
  titleKey: TranslationKey;
  textKey: TranslationKey;
  href: string;
}) {
  const { t } = useLanguage();

  return (
    <Link href={href} className="bd-feature-panel">
      <span className="text-cyan-700">{icon}</span>
      <h3 className="mt-6 text-3xl font-semibold text-[#071f3c]">{t(titleKey)}</h3>
      <p className="mt-4 leading-7 text-[#5b7088]">{t(textKey)}</p>
      <span className="mt-8 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-cyan-800">
        {t("home.viewDetails")}
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

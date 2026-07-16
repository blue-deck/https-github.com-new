"use client";

import Link from "next/link";
import {
  Anchor,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Crown,
  FileCheck2,
  FileText,
  Handshake,
  MapPin,
  Search,
  Send,
  Ship,
  Users,
  Wrench,
  UtensilsCrossed,
} from "lucide-react";
import { HomeJobsPreview } from "./components/HomeJobsPreview";
import { PublicFooter, PublicHeader } from "./components/PublicSiteChrome";
import { useLanguage } from "./components/LanguageProvider";
import type { TranslationKey } from "./lib/i18n";

const trustPoints = [
  { icon: BadgeCheck, key: "home.trustApply" },
  { icon: Users, key: "home.trustProfile" },
  { icon: Ship, key: "home.trustOnboard" },
] satisfies Array<{ icon: typeof BadgeCheck; key: TranslationKey }>;

const departments = [
  {
    labelKey: "home.categoryDeck",
    value: "Deck",
    icon: Anchor,
    note: "Deckhand · Bosun · Officer",
    queryKey: "department",
  },
  {
    labelKey: "home.categoryInterior",
    value: "Interior",
    icon: Users,
    note: "Stewardess · Purser · Housekeeping",
    queryKey: "department",
  },
  {
    labelKey: "home.categoryEngineering",
    value: "Engineering",
    icon: Wrench,
    note: "Engineer · ETO · Technical",
    queryKey: "department",
  },
  {
    labelKey: "home.categoryGalley",
    value: "Galley",
    icon: UtensilsCrossed,
    note: "Chef · Sous Chef · Crew Cook",
    queryKey: "department",
  },
  {
    labelKey: "home.categoryLeadership",
    value: "Command",
    icon: Crown,
    note: "Captain · Chief Officer · Management",
    queryKey: "department",
  },
  {
    labelKey: "home.categoryShore",
    value: "Shore-based",
    icon: Building2,
    note: "Recruitment · Operations · Administration",
    queryKey: "q",
  },
] satisfies Array<{
  labelKey: TranslationKey;
  value: string;
  icon: typeof Anchor;
  note: string;
  queryKey: "department" | "q";
}>;

const workflow = [
  { icon: Send, key: "home.workflow1" },
  { icon: Users, key: "home.workflow2" },
  { icon: Search, key: "home.workflow3" },
  { icon: Handshake, key: "home.workflow4" },
  { icon: Ship, key: "home.workflow5" },
  { icon: ClipboardCheck, key: "home.workflow6" },
] satisfies Array<{ icon: typeof Send; key: TranslationKey }>;

const yachtOsFeatures = [
  {
    icon: Users,
    title: "Professional crew profiles",
    text: "Experience, skills, availability, references and a clean BlueDeck CV.",
  },
  {
    icon: FileCheck2,
    title: "Documents & compliance",
    text: "Crew documents, yacht records and expiry awareness kept in one controlled flow.",
  },
  {
    icon: FileText,
    title: "Contracts & invitations",
    text: "Move a successful candidate into the existing yacht invitation and contract workflow.",
  },
  {
    icon: ClipboardCheck,
    title: "Onboard readiness",
    text: "Connect the new hire to checklists, proof records, crew lists and daily operations.",
  },
];

export default function HomePageClient() {
  const { t } = useLanguage();

  return (
    <main className="bd-site-shell min-h-screen overflow-hidden text-[#071f3c]">
      <PublicHeader />

      <section className="bd-jobs-home-hero">
        <div className="bd-jobs-home-hero-grid">
          <div className="bd-jobs-home-copy">
            <div className="bd-jobs-home-eyebrow">
              <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_0_5px_rgba(34,211,238,0.12)]" />
              {t("home.jobsEyebrow")}
            </div>
            <h1 className="bd-serif mt-6 text-[clamp(3.25rem,7vw,7.2rem)] leading-[0.92] tracking-[-0.055em] text-[#071f3c]">
              {t("home.jobsTitle1")}
              <span className="mt-2 block text-[#0d5d91]">{t("home.jobsTitle2")}</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#526b83] sm:text-xl">
              {t("home.jobsIntro")}
            </p>

            <form action="/jobs" method="get" className="bd-home-job-search">
              <label className="bd-home-job-search-field">
                <span>{t("home.searchRole")}</span>
                <span className="flex items-center gap-3">
                  <Search className="h-5 w-5 shrink-0 text-[#0e7490]" />
                  <input
                    name="q"
                    type="search"
                    placeholder={t("home.searchRolePlaceholder")}
                    autoComplete="off"
                  />
                </span>
              </label>
              <label className="bd-home-job-search-field">
                <span>{t("home.searchLocation")}</span>
                <span className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 shrink-0 text-[#0e7490]" />
                  <input
                    name="location"
                    type="search"
                    placeholder={t("home.searchLocationPlaceholder")}
                    autoComplete="off"
                  />
                </span>
              </label>
              <label className="bd-home-job-search-field bd-home-job-search-select">
                <span>{t("home.searchContract")}</span>
                <select name="employment" defaultValue="">
                  <option value="">{t("home.searchAllContracts")}</option>
                  <option value="permanent">Permanent</option>
                  <option value="temporary">Temporary</option>
                  <option value="seasonal">Seasonal</option>
                  <option value="rotational">Rotational</option>
                  <option value="delivery">Delivery</option>
                  <option value="daywork">Daywork</option>
                  <option value="freelance">Freelance</option>
                </select>
              </label>
              <button type="submit" className="bd-home-job-search-button">
                <Search className="h-5 w-5" />
                {t("home.searchJobs")}
              </button>
            </form>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/jobs" className="bd-primary-cta">
                {t("home.browseAllJobs")}
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/hire-crew" className="bd-secondary-cta">
                {t("nav.hireCrew")}
              </Link>
            </div>
          </div>

          <div className="bd-jobs-home-visual" aria-label="BlueDeck recruitment to yacht operations workflow">
            <div className="bd-jobs-home-photo" />
            <div className="bd-jobs-flow-card bd-jobs-flow-card-top">
              <span className="bd-jobs-flow-icon">
                <BriefcaseBusiness className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0e7490]">
                  BlueDeck Jobs
                </p>
                <p className="mt-1 font-extrabold text-[#071f3c]">Search · Apply · Hire</p>
              </div>
            </div>
            <div className="bd-jobs-flow-card bd-jobs-flow-card-bottom">
              <span className="bd-jobs-flow-icon bd-jobs-flow-icon-dark">
                <Compass className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0e7490]">
                  BlueDeck YACHT-OS
                </p>
                <p className="mt-1 font-extrabold text-[#071f3c]">Invite · Contract · Onboard</p>
              </div>
            </div>
            <div className="bd-jobs-home-orbit" aria-hidden>
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </div>
      </section>

      <section className="bd-jobs-trust-strip">
        <div className="mx-auto grid max-w-[1500px] gap-4 px-5 py-5 sm:px-8 md:grid-cols-3 lg:px-12">
          {trustPoints.map((point) => {
            const Icon = point.icon;
            return (
              <div key={point.key} className="flex items-center justify-center gap-3 text-sm font-extrabold text-[#173f5a] md:justify-start">
                <Icon className="h-5 w-5 text-[#0e7490]" />
                {t(point.key)}
              </div>
            );
          })}
        </div>
      </section>

      <section className="bd-section">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="bd-kicker">{t("home.latestEyebrow")}</p>
            <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.045em] text-[#071f3c] sm:text-6xl">
              {t("home.latestTitle")}
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5b7088]">
              {t("home.latestIntro")}
            </p>
          </div>
          <Link href="/jobs" className="bd-secondary-cta shrink-0">
            {t("home.browseAllJobs")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-10">
          <HomeJobsPreview />
        </div>
      </section>

      <section className="bd-jobs-category-band">
        <div className="bd-section">
          <p className="bd-kicker">{t("home.categoriesEyebrow")}</p>
          <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.045em] text-[#071f3c] sm:text-6xl">
            {t("home.categoriesTitle")}
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((department) => {
              const Icon = department.icon;
              return (
                <Link
                  key={department.value}
                  href={`/jobs?${department.queryKey}=${encodeURIComponent(department.value)}`}
                  className="bd-job-category-card group"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#071631] text-cyan-200 transition group-hover:bg-[#0e7490]">
                    <Icon className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-xl font-black tracking-[-0.025em] text-[#071f3c]">
                      {t(department.labelKey)}
                    </h3>
                    <p data-i18n-ignore className="mt-1 truncate text-sm font-semibold text-[#6b7f95]">
                      {department.note}
                    </p>
                  </div>
                  <ArrowRight className="ml-auto h-5 w-5 shrink-0 text-[#0e7490] transition group-hover:translate-x-1" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bd-section">
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="bd-audience-panel bd-audience-panel-crew">
            <div className="relative z-10">
              <span className="bd-audience-icon">
                <Users className="h-7 w-7" />
              </span>
              <p className="bd-kicker mt-8">{t("home.forCrewEyebrow")}</p>
              <h2 className="mt-4 max-w-xl text-4xl font-black tracking-[-0.045em] text-[#071f3c] sm:text-5xl">
                {t("home.forCrewTitle")}
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-[#526b83]">
                {t("home.forCrewText")}
              </p>
              <Link href="/for-crew" className="bd-primary-cta mt-8">
                {t("home.learnCrew")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>

          <article className="bd-audience-panel bd-audience-panel-employer">
            <div className="relative z-10">
              <span className="bd-audience-icon bd-audience-icon-dark">
                <Building2 className="h-7 w-7" />
              </span>
              <p className="mt-8 text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
                {t("home.forEmployersEyebrow")}
              </p>
              <h2 className="mt-4 max-w-xl text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">
                {t("home.forEmployersTitle")}
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-white/68">
                {t("home.forEmployersText")}
              </p>
              <Link href="/hire-crew" className="bd-primary-cta bd-primary-cta-light mt-8">
                {t("home.learnHiring")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="bd-deep-band">
        <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-cyan-200">
                {t("home.workflowEyebrow")}
              </p>
              <h2 className="mt-5 text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl">
                {t("home.workflowTitle")}
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-white/62 lg:justify-self-end">
              BlueDeck is designed so recruitment records do not become another disconnected file.
              The successful hire can continue into the yacht systems already in place.
            </p>
          </div>

          <div className="bd-job-workflow mt-12">
            {workflow.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.key} className="bd-job-workflow-step">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-cyan-200">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-black tracking-[0.18em] text-white/35">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="mt-6 font-extrabold leading-7 text-white">{t(step.key)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="yacht-platform" className="bd-section">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="bd-kicker">{t("home.yachtOsEyebrow")}</p>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.045em] text-[#071f3c] sm:text-6xl">
              {t("home.yachtOsTitle")}
            </h2>
          </div>
          <p className="text-lg leading-8 text-[#5b7088]">{t("home.yachtOsIntro")}</p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {yachtOsFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="bd-editorial-card">
                <Icon className="h-7 w-7 text-cyan-700" />
                <h3 className="mt-7 text-2xl font-semibold text-[#071f3c]">{feature.title}</h3>
                <p className="mt-4 leading-7 text-[#5b7088]">{feature.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 pb-20 sm:px-8 lg:px-12">
        <div className="bd-jobs-final-cta">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">
              {t("home.finalEyebrow")}
            </p>
            <h2 className="mt-4 max-w-4xl text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl">
              {t("home.finalTitle")}
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/jobs" className="bd-primary-cta bd-primary-cta-light">
              {t("home.searchJobs")}
              <Search className="h-5 w-5" />
            </Link>
            <Link href="/hiring" className="bd-secondary-cta bd-secondary-cta-dark">
              {t("nav.postJob")}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

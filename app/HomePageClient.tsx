"use client";

import { getImageProps } from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Search,
  ShieldCheck,
} from "lucide-react";
import { PublicFooter, PublicHeader } from "./components/PublicSiteChrome";
import { useLanguage } from "./components/LanguageProvider";
import { parsePublicJobCards, type PublicJobCard } from "./jobs/job-data";
import { useJobListingViewer } from "./jobs/JobListingAction";
import {
  PublicJobListingCard,
  PublicJobListingSkeleton,
} from "./jobs/PublicJobListingCard";
import styles from "./homepage.module.css";
import homeStyles from "./homeContent.module.css";
import { HomeJobSearch, HomePageSections, departmentLabel, homeCopy } from "./HomePageSections";

type LoadState = "loading" | "ready" | "error";

// Art direction keeps the full yacht visible in both the wide and stacked layouts.
const { props: desktopHeroImage } = getImageProps({
  src: "/media/bluedeck-signature-panorama-v1.webp",
  alt: "",
  fill: true,
  quality: 90,
  sizes: "100vw",
});
const { props: mobileHeroImage } = getImageProps({
  src: "/media/bluedeck-yacht-hero-v2.webp",
  alt: "",
  fill: true,
  quality: 90,
  sizes: "100vw",
  loading: "eager",
  fetchPriority: "high",
});

const copy = {
  en: {
    eyebrow: "Yacht careers · crew · operations",
    titleLine1: "Your career.",
    titleLine2: "Your crew.",
    titleLine3: "Your BlueDeck.",
    introLine1: "Find your next role. Build your team.",
    introLine2: "Keep life onboard connected.",
    browseJobs: "Explore yacht jobs",
    findCrew: "Find crew",
    explorePlatform: "Explore Yacht-OS",
    heroNavigation: "Explore BlueDeck",
    careers: "Careers",
    crew: "Crew",
    jobsEyebrow: "Latest opportunities",
    jobsIntro:
      "Review the newest opportunities first. Create an account only when you are ready to apply.",
    allJobs: "View all roles",
    loadingJobs: "Loading the latest roles",
    noJobsTitle: "New opportunities are on the horizon.",
    noJobsText:
      "Create your crew profile now and be ready when the next role is published.",
    noJobsEmployerText:
      "Open your hiring workspace to publish a role and start building a shortlist.",
    createProfile: "Create crew profile",
    manageProfile: "Manage crew profile",
    openHiring: "Open hiring workspace",
    openDashboard: "Open dashboard",
    jobsErrorTitle: "Roles are temporarily unavailable.",
    jobsErrorText: "Open the full jobs board to try again.",
    openJobs: "Open jobs board",
    profilePromptEyebrow: "Stay ready",
    profilePromptTitle: "Make your experience easy to trust.",
    profilePromptText:
      "Keep your role, availability and essential records in one professional crew profile.",
    hiringPromptEyebrow: "Build your team",
    hiringPromptTitle: "Publish and manage roles in one place.",
    hiringPromptText:
      "Create listings, review applications and keep every shortlist organized.",

  },
  tr: {
    eyebrow: "Yat kariyeri · mürettebat · operasyon",
    titleLine1: "Kariyerin.",
    titleLine2: "Ekibin.",
    titleLine3: "Senin BlueDeck’in.",
    introLine1: "Yeni işini bul. Ekibini kur.",
    introLine2: "Teknedeki yaşamı birbirine bağla.",
    browseJobs: "Yat ilanlarını keşfet",
    findCrew: "Ekip bul",
    explorePlatform: "Yacht-OS’u keşfet",
    heroNavigation: "BlueDeck’i keşfet",
    careers: "Kariyer",
    crew: "Mürettebat",
    jobsEyebrow: "Güncel fırsatlar",
    jobsIntro:
      "Önce en yeni fırsatları inceleyin. Yalnızca başvurmaya hazır olduğunuzda hesap oluşturun.",
    allJobs: "Tüm ilanları gör",
    loadingJobs: "Güncel ilanlar yükleniyor",
    noJobsTitle: "Yeni fırsatlar yakında.",
    noJobsText:
      "Mürettebat profilinizi şimdi hazırlayın; yeni ilan yayınlandığında hazır olun.",
    noJobsEmployerText:
      "İlan yayınlamak ve aday listenizi oluşturmaya başlamak için işe alım alanınızı açın.",
    createProfile: "Mürettebat profili oluştur",
    manageProfile: "Profili yönet",
    openHiring: "İşe alım alanını aç",
    openDashboard: "Paneli aç",
    jobsErrorTitle: "İlanlara şu anda ulaşılamıyor.",
    jobsErrorText: "Tekrar denemek için tam ilan panosunu açın.",
    openJobs: "İlan panosunu aç",
    profilePromptEyebrow: "Hazır kalın",
    profilePromptTitle: "Deneyiminizi güvenilir biçimde sunun.",
    profilePromptText:
      "Pozisyonunuzu, müsaitliğinizi ve temel kayıtlarınızı tek profesyonel profilde tutun.",
    hiringPromptEyebrow: "Ekibinizi kurun",
    hiringPromptTitle: "İlanları tek yerden yayınlayın ve yönetin.",
    hiringPromptText:
      "İlan oluşturun, başvuruları inceleyin ve aday listelerinizi düzenli tutun.",

  },
} as const;

export default function HomePageClient({ heroFontClassName }: { heroFontClassName: string }) {
  const { language } = useLanguage();
  const c = copy[language];
  const hc = homeCopy[language];
  const [department, setDepartment] = useState("");
  const jobViewer = useJobListingViewer();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [jobs, setJobs] = useState<PublicJobCard[]>([]);
  const isEmployerViewer =
    jobViewer.kind === "signed-in" &&
    (jobViewer.role === "owner" || jobViewer.role === "management");
  const rolePrompt = isEmployerViewer
    ? {
        eyebrow: c.hiringPromptEyebrow,
        title: c.hiringPromptTitle,
        text: c.hiringPromptText,
        action: c.openHiring,
        href: "/hiring",
      }
    : jobViewer.kind === "signed-out" ||
        (jobViewer.kind === "signed-in" &&
          (jobViewer.role === "crew" || jobViewer.role === "captain"))
      ? {
          eyebrow: c.profilePromptEyebrow,
          title: c.profilePromptTitle,
          text: c.profilePromptText,
          action:
            jobViewer.kind === "signed-in" ? c.manageProfile : c.createProfile,
          href:
            jobViewer.kind === "signed-in"
              ? "/profile"
              : "/login?mode=signup&role=crew",
        }
      : null;
  const noJobsAction =
    loadState === "error"
      ? { href: "/jobs", label: c.openJobs }
      : isEmployerViewer
        ? { href: "/hiring", label: c.openHiring }
        : jobViewer.kind === "signed-out"
          ? {
              href: "/login?mode=signup&role=crew",
              label: c.createProfile,
            }
          : jobViewer.kind === "signed-in" &&
              (jobViewer.role === "crew" || jobViewer.role === "captain")
            ? { href: "/profile", label: c.manageProfile }
            : jobViewer.kind === "signed-in"
              ? { href: "/dashboard", label: c.openDashboard }
              : null;

  useEffect(() => {
    const controller = new AbortController();

    async function loadJobs() {
      try {
        const query = department ? `?department=${encodeURIComponent(department)}` : "";
        const response = await fetch(`/api/jobs${query}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok || !isRecord(payload) || payload.ok !== true) {
          throw new Error("jobs_request_failed");
        }

        const parsedJobs = parsePublicJobCards(payload.jobs);
        if (!parsedJobs || !Array.isArray(payload.jobs) || parsedJobs.length !== payload.jobs.length) {
          throw new Error("jobs_response_invalid");
        }

        if (controller.signal.aborted) return;
        setJobs(parsedJobs.slice(0, 3));
        setLoadState("ready");
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        setLoadState("error");
      }
    }

    void loadJobs();
    return () => controller.abort();
  }, [department]);

  return (
    <div className={`bd-site-shell min-h-screen ${styles.page} ${heroFontClassName}`}>
      <PublicHeader />

      <main id="main-content" data-i18n-ignore>
        <section className={styles.hero} aria-labelledby="home-heading">
          <div className={styles.heroStage}>
            <div className={styles.heroArt} aria-hidden="true">
              <div className={styles.imageFrame}>
                <picture>
                  <source media="(min-width: 960px)" srcSet={desktopHeroImage.srcSet} sizes="100vw" />
                  {/* getImageProps supplies Next.js optimization for the native picture element. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img {...mobileHeroImage} alt="" className={styles.heroImage} />
                </picture>
              </div>
              <svg className={styles.desktopWave} viewBox="0 0 1600 800" preserveAspectRatio="none" focusable="false">
                <defs>
                  <linearGradient id="home-wave-navy" x1="0" y1="0" x2="1" y2="1">
                    <stop stopColor="#06182c" />
                    <stop offset="1" stopColor="#031323" />
                  </linearGradient>
                  <linearGradient id="home-wave-silver" x1="0" y1="1" x2="1" y2="0">
                    <stop stopColor="#788da5" stopOpacity="0.2" />
                    <stop offset="0.4" stopColor="#f1f6ff" />
                    <stop offset="1" stopColor="#c4d4eb" />
                  </linearGradient>
                  <linearGradient id="home-wave-blue" x1="0" y1="1" x2="1" y2="0">
                    <stop stopColor="#0877cd" stopOpacity="0" />
                    <stop offset="0.4" stopColor="#0877cd" />
                    <stop offset="1" stopColor="#0877cd" stopOpacity="0.25" />
                  </linearGradient>
                </defs>
                <path d="M1230 0C1040 0 935 140 815 355C660 635 580 745 0 800" fill="none" stroke="url(#home-wave-blue)" strokeWidth="12" />
                <path d="M0 0H1230C1040 0 935 140 815 355C660 635 580 745 0 800Z" fill="url(#home-wave-navy)" />
                <path d="M1230 0C1040 0 935 140 815 355C660 635 580 745 0 800" fill="none" stroke="url(#home-wave-silver)" strokeWidth="2.5" />
              </svg>
              <svg className={styles.mobileWave} viewBox="0 0 800 120" preserveAspectRatio="none" focusable="false">
                <path d="M0 0H800V10C510 10 410 112 0 112Z" fill="#06182c" />
                <path d="M0 112C410 112 510 10 800 10" fill="none" stroke="#0877cd" strokeWidth="6" />
                <path d="M0 110C410 110 510 8 800 8" fill="none" stroke="#c4d4eb" strokeWidth="1.5" />
              </svg>
            </div>
            <div className={styles.heroInner}>
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>{c.eyebrow}</p>
                <h1 id="home-heading" className={styles.heroTitle}>
                  <span>{c.titleLine1}</span>
                  <span>{c.titleLine2}</span>
                  <span className={styles.signature}>{c.titleLine3}</span>
                </h1>
                <p className={styles.heroIntro}>
                  <span>{c.introLine1}</span>
                  <span>{c.introLine2}</span>
                </p>
                <div className={styles.heroActions}>
                  <Link href="/jobs" className={styles.primaryButton}>
                    {c.browseJobs}
                    <ArrowRight aria-hidden />
                  </Link>
                  <Link href="/find-crew" className={styles.secondaryButton}>
                    {c.findCrew}
                  </Link>
                </div>
                <Link href="/yacht-os" className={styles.platformLink}>
                  {c.explorePlatform}
                  <ArrowRight aria-hidden />
                </Link>
              </div>
            </div>
          </div>
          <nav className={styles.heroRail} aria-label={c.heroNavigation}>
            <Link href="/jobs">{c.careers}</Link>
            <Link href="/find-crew">{c.crew}</Link>
            <Link href="/yacht-os">Yacht-OS</Link>
          </nav>
        </section>

        <HomeJobSearch language={language} />

        <section className={homeStyles.jobsSection} aria-labelledby="jobs-heading">
          <div className={homeStyles.container}>
            <div className={homeStyles.headingRow}>
              <div>
                <p className={homeStyles.eyebrow}>{c.jobsEyebrow}</p>
                <h2 id="jobs-heading" className={homeStyles.title}>{hc.jobsTitle}</h2>
                <p className={homeStyles.intro}>{c.jobsIntro}</p>
              </div>
              <Link href={department ? `/jobs?department=${encodeURIComponent(department)}` : "/jobs"} className={homeStyles.textLink}>
                {c.allJobs}<ArrowRight aria-hidden />
              </Link>
            </div>
            <div className={homeStyles.filters} role="group" aria-label={hc.department}>
              {["", "Deck", "Interior", "Engineering", "Galley"].map((value) => (
                <button key={value} type="button" aria-pressed={department === value} aria-controls="home-job-results" onClick={() => {
                  if (department === value) return;
                  setLoadState("loading");
                  setDepartment(value);
                }}>{value ? departmentLabel(value, language) : hc.all}</button>
              ))}
            </div>
            <div id="home-job-results" className={homeStyles.jobsGrid} data-count={loadState === "loading" ? 3 : jobs.length + (jobs.length > 0 && jobs.length < 3 && rolePrompt ? 1 : 0)} aria-live="polite" aria-busy={loadState === "loading"}>
              {loadState === "loading" ? (
                <>
                  {[0, 1, 2].map((item) => <PublicJobListingSkeleton key={item} compact appearance="homepage" />)}
                  <span className="sr-only">{c.loadingJobs}</span>
                </>
              ) : loadState === "ready" && jobs.length > 0 ? (
                <>
                  {jobs.map((job) => <PublicJobListingCard key={job.id} job={job} language={language} viewer={jobViewer} compact appearance="homepage" />)}
                  {jobs.length < 3 && rolePrompt ? <RolePrompt {...rolePrompt} /> : null}
                </>
              ) : (
                <div className={homeStyles.jobsEmpty}>
                  <Search aria-hidden />
                  <div>
                    <h3>{loadState === "error" ? c.jobsErrorTitle : department ? hc.filteredEmpty : c.noJobsTitle}</h3>
                    <p>{loadState === "error" ? c.jobsErrorText : department ? hc.filteredText : isEmployerViewer ? c.noJobsEmployerText : c.noJobsText}</p>
                  </div>
                  {loadState !== "error" && department ? (
                    <button type="button" className={homeStyles.textLink} onClick={() => { setLoadState("loading"); setDepartment(""); }}>{hc.clearFilter}<ArrowRight aria-hidden /></button>
                  ) : noJobsAction ? (
                    <Link href={noJobsAction.href} className={homeStyles.textLink}>{noJobsAction.label}<ArrowRight aria-hidden /></Link>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>

        <HomePageSections language={language} viewer={jobViewer} />
      </main>

      <PublicFooter />
    </div>
  );
}

function RolePrompt({
  eyebrow,
  title,
  text,
  action,
  href,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action: string;
  href: string;
}) {
  return (
    <aside className={homeStyles.rolePrompt}>
      <ShieldCheck aria-hidden />
      <div>
        <p className={homeStyles.eyebrow}>{eyebrow}</p>
        <h3>{title}</h3>
        <span>{text}</span>
      </div>
      <Link href={href} className={homeStyles.textLink}>
        {action}
        <ArrowRight aria-hidden />
      </Link>
    </aside>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

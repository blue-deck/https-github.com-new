"use client";

import Image from "next/image";
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
import { HomeJobSearch, HomePageSections, departmentLabel, homeCopy, type JournalPreview } from "./HomePageSections";

type LoadState = "loading" | "ready" | "error";

const copy = {
  en: {
    eyebrow: "Yacht careers · hiring · operations",
    titleLine1: "Build the right crew.",
    titleLine2: "Run a better yacht.",
    intro:
      "Find trusted yacht roles, hire with clarity and keep essential onboard work connected in one focused platform.",
    browseJobs: "Explore open roles",
    findCrew: "Find professional crew",
    heroTrust:
      "Visible profiles. Protected names, contacts and private records.",
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
    eyebrow: "Yat kariyeri · işe alım · operasyon",
    titleLine1: "Doğru ekibi kurun.",
    titleLine2: "Yatı daha iyi yönetin.",
    intro:
      "Güvenilir yat ilanlarını bulun, doğru bilgilerle işe alım yapın ve teknedeki temel işleri tek, odaklı platformda yönetin.",
    browseJobs: "Açık ilanları keşfet",
    findCrew: "Profesyonel mürettebat bul",
    heroTrust:
      "Görünür profiller. Korumalı adlar, iletişim bilgileri ve özel kayıtlar.",
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

export default function HomePageClient({ articles }: { articles: JournalPreview[] }) {
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
    <div className={`bd-site-shell min-h-screen ${styles.page}`}>
      <PublicHeader />

      <main id="main-content" data-i18n-ignore>
        <section className={styles.hero} aria-labelledby="home-heading">
          <div className={styles.heroVisual} aria-hidden="true">
            <Image
              src="/media/bluedeck-yacht-hero-v2.webp"
              alt=""
              fill
              preload
              sizes="100vw"
              className={styles.heroImage}
            />
            <div className={styles.heroOverlay} />
          </div>
          <div className={`${styles.container} ${styles.heroInner}`}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>{c.eyebrow}</p>
              <h1 id="home-heading" className={styles.heroTitle}>
                <span>{c.titleLine1}</span>
                <span>{c.titleLine2}</span>
              </h1>
              <p className={styles.heroIntro}>{c.intro}</p>
              <div className={styles.heroActions}>
                <Link href="/jobs" className={styles.primaryButton}>
                  {c.browseJobs}
                  <ArrowRight aria-hidden />
                </Link>
                <Link href="/find-crew" className={styles.secondaryButton}>
                  {c.findCrew}
                </Link>
              </div>
              <p className={styles.heroTrust}>
                <ShieldCheck aria-hidden />
                {c.heroTrust}
              </p>
            </div>
          </div>
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

        <HomePageSections language={language} viewer={jobViewer} articles={articles} />
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

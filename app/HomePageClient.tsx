"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ClipboardCheck,
  FileCheck2,
  Search,
  UsersRound,
} from "lucide-react";
import { PublicFooter, PublicHeader } from "./components/PublicSiteChrome";
import { useLanguage } from "./components/LanguageProvider";
import { crewEmploymentTypes } from "./lib/crewDiscovery";
import {
  buildHomeCrewSearchHref,
  buildHomeJobSearchHref,
  type HomeHeroSearchValues,
} from "./lib/homeHeroSearch";
import {
  formatJobEmploymentType,
  jobEmploymentTypes,
} from "./lib/jobPosts";
import { yachtPositionTitles } from "./lib/yachtOperations";
import { parsePublicJobCards, type PublicJobCard } from "./jobs/job-data";
import { useJobListingViewer } from "./jobs/JobListingAction";
import {
  PublicJobListingCard,
  PublicJobListingSkeleton,
} from "./jobs/PublicJobListingCard";
import styles from "./homepage.module.css";

type LoadState = "loading" | "ready" | "error";
type HeroSearchMode = "jobs" | "crew" | "yacht";

const emptyHeroSearch: HomeHeroSearchValues = {
  position: "",
  location: "",
  employmentType: "",
};

const popularPositions = [
  "Deckhand",
  "Chief Stewardess",
  "Engineer",
  "Captain",
  "Bosun",
] as const;

const copy = {
  en: {
    eyebrow: "BlueDeck · Yacht careers & operations",
    titleLine1: "One platform.",
    titleLine2Lead: "Every step on",
    titleAccent: "deck.",
    intro:
      "Find work, hire trusted crew and bring yacht operations into one connected place.",
    heroPathLabel: "Choose a BlueDeck service",
    heroJobs: "Find Jobs",
    heroCrew: "Find Crew",
    heroYacht: "Yacht-OS",
    position: "Position",
    positionPlaceholder: "e.g. Stewardess",
    location: "Location",
    locationPlaceholder: "e.g. Mediterranean",
    contract: "Contract type",
    contractPlaceholder: "Any contract",
    searchJobs: "Search jobs",
    searchCrew: "Search crew",
    popularSearches: "Popular searches:",
    yachtPanelEyebrow: "One connected workspace",
    yachtPanelTitle: "Run yacht operations with clarity.",
    yachtPanelText:
      "Bring crew, records and daily workflows into a private Yacht-OS workspace.",
    openYachtOs: "Open Yacht-OS",
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
    platformEyebrow: "BlueDeck Yacht-OS",
    platformTitle: "The work behind a well-run yacht, finally connected.",
    platformIntro:
      "Recruitment, crew records and daily operations share one clear structure—without another crowded dashboard.",
    feature1Title: "Hire with context",
    feature1Text:
      "Move from a focused profile to a secure invitation and hiring conversation.",
    feature2Title: "Keep records ready",
    feature2Text:
      "Crew details, contracts, certificates and expiry dates stay with the right account.",
    feature3Title: "Run daily operations",
    feature3Text:
      "Checklists, responsibilities and readiness remain visible to the people who own them.",
    explorePlatform: "Explore Yacht-OS",
    previewLabel: "Yacht workspace",
    previewCrew: "Crew",
    previewRecords: "Records",
    previewOperations: "Operations",
    trustEyebrow: "Private by design",
    trustTitle: "A calmer system for decisions that matter.",
    trustText:
      "Crew discovery can show faces in profile and gallery photos, along with selected professional and physical details. Full names, contact details and private documents remain protected.",
    trust1: "Role-based account access",
    trust2: "Visible crew profiles, protected private data",
    trust3: "Traceable yacht workflows",
    getStarted: "Create a BlueDeck account",
  },
  tr: {
    eyebrow: "BlueDeck · Yat kariyeri ve operasyon",
    titleLine1: "Tek platform.",
    titleLine2Lead: "Her adım",
    titleAccent: "güvertede.",
    intro:
      "İş bulun, güvenilir mürettebatı işe alın ve yat operasyonlarını tek bağlantılı yapıda yönetin.",
    heroPathLabel: "BlueDeck hizmetini seçin",
    heroJobs: "İş Bul",
    heroCrew: "Mürettebat Bul",
    heroYacht: "Yacht-OS",
    position: "Pozisyon",
    positionPlaceholder: "örn. Stewardess",
    location: "Konum",
    locationPlaceholder: "örn. Akdeniz",
    contract: "Çalışma biçimi",
    contractPlaceholder: "Tüm çalışma türleri",
    searchJobs: "İlanlarda ara",
    searchCrew: "Mürettebat ara",
    popularSearches: "Popüler aramalar:",
    yachtPanelEyebrow: "Tek bağlantılı çalışma alanı",
    yachtPanelTitle: "Yat operasyonlarını netlikle yönetin.",
    yachtPanelText:
      "Mürettebatı, kayıtları ve günlük iş akışlarını özel bir Yacht-OS alanında birleştirin.",
    openYachtOs: "Yacht-OS’u aç",
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
    platformEyebrow: "BlueDeck Yacht-OS",
    platformTitle: "İyi yönetilen bir yatın arkasındaki işler, artık bağlantılı.",
    platformIntro:
      "İşe alım, mürettebat kayıtları ve günlük operasyonlar kalabalık bir panel yaratmadan tek yapıda buluşur.",
    feature1Title: "Doğru bilgiyle işe alın",
    feature1Text:
      "Odaklı profilden güvenli davete ve işe alım görüşmesine kesintisiz ilerleyin.",
    feature2Title: "Kayıtları hazır tutun",
    feature2Text:
      "Mürettebat bilgileri, kontratlar, sertifikalar ve tarihler doğru hesapla bağlı kalır.",
    feature3Title: "Günlük operasyonu yönetin",
    feature3Text:
      "Kontrol listeleri, sorumluluklar ve hazırlık durumu doğru kişilere görünür kalır.",
    explorePlatform: "Yacht-OS’u keşfet",
    previewLabel: "Yat çalışma alanı",
    previewCrew: "Mürettebat",
    previewRecords: "Kayıtlar",
    previewOperations: "Operasyon",
    trustEyebrow: "Gizlilik temelden tasarlandı",
    trustTitle: "Önemli kararlar için daha sakin bir sistem.",
    trustText:
      "Crew keşfinde profil ve galeri fotoğraflarındaki yüzler ile seçili profesyonel ve fiziksel bilgiler gösterilebilir. Tam adlar, iletişim bilgileri ve özel belgeler korumalı kalır.",
    trust1: "Rol bazlı hesap erişimi",
    trust2: "Görünür crew profilleri, korumalı özel veriler",
    trust3: "İzlenebilir yat iş akışları",
    getStarted: "BlueDeck hesabı oluştur",
  },
} as const;

export default function HomePageClient() {
  const { language } = useLanguage();
  const c = copy[language];
  const router = useRouter();
  const jobViewer = useJobListingViewer();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [jobs, setJobs] = useState<PublicJobCard[]>([]);
  const [heroMode, setHeroMode] = useState<HeroSearchMode>("jobs");
  const [jobSearch, setJobSearch] =
    useState<HomeHeroSearchValues>(emptyHeroSearch);
  const [crewSearch, setCrewSearch] =
    useState<HomeHeroSearchValues>(emptyHeroSearch);
  const heroTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const heroTabs = [
    { key: "jobs" as const, label: c.heroJobs },
    { key: "crew" as const, label: c.heroCrew },
    { key: "yacht" as const, label: c.heroYacht },
  ];
  const jobContractOptions = jobEmploymentTypes.map((value) => ({
    value,
    label: formatJobEmploymentType(value, language),
  }));
  const crewContractOptions = crewEmploymentTypes.map((value) => ({
    value,
    label: formatCrewEmploymentType(value, language),
  }));
  const isEmployerViewer =
    jobViewer.kind === "signed-in" &&
    (jobViewer.role === "owner" || jobViewer.role === "management");
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
  const trustAction = isEmployerViewer
    ? { href: "/hiring", label: c.openHiring }
    : jobViewer.kind === "signed-in" &&
        (jobViewer.role === "crew" || jobViewer.role === "captain")
      ? { href: "/profile", label: c.manageProfile }
      : jobViewer.kind === "signed-in"
        ? { href: "/dashboard", label: c.openDashboard }
        : { href: "/login?mode=signup", label: c.getStarted };

  function handleHeroTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    tabIndex: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (tabIndex + 1) % heroTabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (tabIndex - 1 + heroTabs.length) % heroTabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = heroTabs.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    setHeroMode(heroTabs[nextIndex].key);
    heroTabRefs.current[nextIndex]?.focus();
  }

  function submitJobSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(buildHomeJobSearchHref(jobSearch));
  }

  function submitCrewSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(buildHomeCrewSearchHref(crewSearch));
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadJobs() {
      try {
        const response = await fetch("/api/jobs?limit=1", {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok || !isRecord(payload) || payload.ok !== true) {
          throw new Error("jobs_request_failed");
        }

        const parsedJobs = parsePublicJobCards(payload.jobs);
        if (!parsedJobs) throw new Error("jobs_response_invalid");

        setJobs(parsedJobs.slice(0, 1));
        setLoadState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState("error");
      }
    }

    void loadJobs();
    return () => controller.abort();
  }, []);

  return (
    <div className={`bd-site-shell min-h-screen ${styles.page}`}>
      <PublicHeader />

      <main id="main-content">
        <section className={styles.hero} aria-labelledby="home-heading">
          <div className={styles.heroMedia} aria-hidden="true">
            <Image
              src="/media/bluedeck-home-hero-yacht-20260810.png"
              alt=""
              fill
              preload
              sizes="100vw"
              unoptimized
              className={styles.heroImage}
            />
          </div>
          <div className={`${styles.container} ${styles.heroInner}`}>
            <div className={styles.heroCopy} data-home-hero-copy>
              <p className={styles.eyebrow}>{c.eyebrow}</p>
              <h1 id="home-heading" className={styles.heroTitle}>
                <span>{c.titleLine1}</span>
                <span>
                  {c.titleLine2Lead}{" "}
                  <span className={styles.heroAccent}>
                    {c.titleAccent}
                    <svg
                      viewBox="0 0 140 14"
                      aria-hidden="true"
                      className={styles.heroAccentWave}
                    >
                      <path d="M2 5c18 8 34 8 52 0s34-8 52 0 22 7 32 3" />
                      <path d="M18 11c15 3 27 2 40-3 13-4 27-4 42 1 14 4 25 4 36 0" />
                    </svg>
                  </span>
                </span>
              </h1>
              <p className={styles.heroIntro}>{c.intro}</p>
            </div>
          </div>

          <div
            className={[styles.container, styles.heroSearchRegion].join(" ")}
            data-home-hero-search-region
          >
            <div
              className={styles.heroTabs}
              data-home-hero-tabs
              role="tablist"
              aria-label={c.heroPathLabel}
            >
              {heroTabs.map((tab, index) => {
                const isActive = tab.key === heroMode;
                return (
                  <button
                    key={tab.key}
                    ref={(node) => {
                      heroTabRefs.current[index] = node;
                    }}
                    id={"home-hero-tab-" + tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={"home-hero-panel-" + tab.key}
                    tabIndex={isActive ? 0 : -1}
                    className={styles.heroTab}
                    data-active={isActive ? "true" : "false"}
                    onClick={() => setHeroMode(tab.key)}
                    onKeyDown={(event) => handleHeroTabKeyDown(event, index)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div
              id="home-hero-panel-jobs"
              role="tabpanel"
              aria-labelledby="home-hero-tab-jobs"
              hidden={heroMode !== "jobs"}
            >
              <HeroSearchForm
                values={jobSearch}
                onChange={setJobSearch}
                onSubmit={submitJobSearch}
                positionLabel={c.position}
                positionPlaceholder={c.positionPlaceholder}
                locationLabel={c.location}
                locationPlaceholder={c.locationPlaceholder}
                contractLabel={c.contract}
                contractPlaceholder={c.contractPlaceholder}
                contractOptions={jobContractOptions}
                submitLabel={c.searchJobs}
              />
            </div>

            <div
              id="home-hero-panel-crew"
              role="tabpanel"
              aria-labelledby="home-hero-tab-crew"
              hidden={heroMode !== "crew"}
            >
              <HeroSearchForm
                values={crewSearch}
                onChange={setCrewSearch}
                onSubmit={submitCrewSearch}
                positionLabel={c.position}
                positionPlaceholder={c.positionPlaceholder}
                locationLabel={c.location}
                locationPlaceholder={c.locationPlaceholder}
                contractLabel={c.contract}
                contractPlaceholder={c.contractPlaceholder}
                contractOptions={crewContractOptions}
                submitLabel={c.searchCrew}
              />
            </div>

            <div
              id="home-hero-panel-yacht"
              role="tabpanel"
              aria-labelledby="home-hero-tab-yacht"
              hidden={heroMode !== "yacht"}
              className={styles.yachtPanel}
            >
              <div>
                <span>{c.yachtPanelEyebrow}</span>
                <strong>{c.yachtPanelTitle}</strong>
                <p>{c.yachtPanelText}</p>
              </div>
              <Link href="/yacht-os" className={styles.yachtPanelAction}>
                {c.openYachtOs}
                <ArrowRight aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        <div className={styles.popularSearchBand}>
          {heroMode !== "yacht" ? (
            <nav
              className={[styles.container, styles.popularSearches].join(" ")}
              aria-label={c.popularSearches}
            >
              <span>{c.popularSearches}</span>
              <div>
                {popularPositions.map((position) => (
                  <Link
                    key={position}
                    href={
                      heroMode === "crew"
                        ? buildHomeCrewSearchHref({
                            ...emptyHeroSearch,
                            position,
                          })
                        : buildHomeJobSearchHref({
                            ...emptyHeroSearch,
                            position,
                          })
                    }
                  >
                    {position}
                  </Link>
                ))}
              </div>
            </nav>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>

        <section className={styles.jobsSection} aria-labelledby="jobs-heading">
          <div className={styles.container}>
            <div className={styles.sectionHeadingRow}>
              <div>
                <h2 id="jobs-heading" className={styles.eyebrow}>
                  {c.jobsEyebrow}
                </h2>
                <p className={styles.sectionIntro}>{c.jobsIntro}</p>
              </div>
              <Link href="/jobs" className={styles.sectionLink}>
                {c.allJobs}
                <ArrowRight aria-hidden />
              </Link>
            </div>

            <div className={styles.jobsGrid} aria-live="polite">
              {loadState === "loading" ? (
                <>
                  <PublicJobListingSkeleton />
                  <span className="sr-only">{c.loadingJobs}</span>
                </>
              ) : loadState === "ready" && jobs.length > 0 ? (
                jobs.map((job) => (
                  <PublicJobListingCard
                    key={job.id}
                    job={job}
                    language={language}
                    viewer={jobViewer}
                  />
                ))
              ) : (
                <div className={styles.jobsEmpty}>
                  <Search aria-hidden />
                  <div>
                    <h3>
                      {loadState === "error"
                        ? c.jobsErrorTitle
                        : c.noJobsTitle}
                    </h3>
                    <p>
                      {loadState === "error"
                        ? c.jobsErrorText
                        : isEmployerViewer
                          ? c.noJobsEmployerText
                          : c.noJobsText}
                    </p>
                  </div>
                  {noJobsAction ? (
                    <Link href={noJobsAction.href}>
                      {noJobsAction.label}
                      <ArrowRight aria-hidden />
                    </Link>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>

        <section
          id="platform"
          className={styles.platformSection}
          aria-labelledby="platform-heading"
        >
          <div className={`${styles.container} ${styles.platformGrid}`}>
            <div className={styles.platformVisual}>
              <Image
                src="/bluedeck-platform-home.webp"
                alt=""
                fill
                sizes="(max-width: 900px) 100vw, 48vw"
                className={styles.platformImage}
              />
              <div className={styles.previewCard}>
                <span>{c.previewLabel}</span>
                <div>
                  <small>
                    <UsersRound aria-hidden />
                    {c.previewCrew}
                  </small>
                  <small>
                    <FileCheck2 aria-hidden />
                    {c.previewRecords}
                  </small>
                  <small>
                    <ClipboardCheck aria-hidden />
                    {c.previewOperations}
                  </small>
                </div>
              </div>
            </div>

            <div className={styles.platformCopy}>
              <p className={styles.eyebrow}>{c.platformEyebrow}</p>
              <h2 id="platform-heading" className={styles.sectionTitle}>
                {c.platformTitle}
              </h2>
              <p className={styles.sectionIntro}>{c.platformIntro}</p>

              <div className={styles.featureList}>
                <FeatureRow
                  icon={<UsersRound aria-hidden />}
                  title={c.feature1Title}
                  text={c.feature1Text}
                />
                <FeatureRow
                  icon={<FileCheck2 aria-hidden />}
                  title={c.feature2Title}
                  text={c.feature2Text}
                />
                <FeatureRow
                  icon={<ClipboardCheck aria-hidden />}
                  title={c.feature3Title}
                  text={c.feature3Text}
                />
              </div>

              <Link href="/yacht-os" className={styles.darkButton}>
                {c.explorePlatform}
                <ArrowRight aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        <section className={styles.trustSection} aria-labelledby="trust-heading">
          <div className={`${styles.container} ${styles.trustGrid}`}>
            <div>
              <p className={styles.eyebrow}>{c.trustEyebrow}</p>
              <h2 id="trust-heading" className={styles.trustTitle}>
                {c.trustTitle}
              </h2>
              <p className={styles.trustIntro}>{c.trustText}</p>
            </div>
            <div className={styles.trustActions}>
              <ul>
                {[c.trust1, c.trust2, c.trust3].map((item) => (
                  <li key={item}>
                    <Check aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href={trustAction.href} className={styles.primaryButton}>
                {trustAction.label}
                <ArrowRight aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

function FeatureRow({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className={styles.featureRow}>
      <span>{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

function HeroSearchForm({
  values,
  onChange,
  onSubmit,
  positionLabel,
  positionPlaceholder,
  locationLabel,
  locationPlaceholder,
  contractLabel,
  contractPlaceholder,
  contractOptions,
  submitLabel,
}: {
  values: HomeHeroSearchValues;
  onChange: (values: HomeHeroSearchValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  positionLabel: string;
  positionPlaceholder: string;
  locationLabel: string;
  locationPlaceholder: string;
  contractLabel: string;
  contractPlaceholder: string;
  contractOptions: ReadonlyArray<{ value: string; label: string }>;
  submitLabel: string;
}) {
  return (
    <form
      className={styles.heroSearchForm}
      data-home-hero-search
      onSubmit={onSubmit}
    >
      <label className={styles.heroSearchField}>
        <span>{positionLabel}</span>
        <span className={styles.heroSearchControl}>
          <select
            value={values.position}
            onChange={(event) =>
              onChange({ ...values, position: event.target.value })
            }
          >
            <option value="">{positionPlaceholder}</option>
            {yachtPositionTitles.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden />
        </span>
      </label>

      <label className={styles.heroSearchField}>
        <span>{locationLabel}</span>
        <span className={styles.heroSearchControl}>
          <input
            type="search"
            value={values.location}
            maxLength={120}
            autoComplete="address-level2"
            placeholder={locationPlaceholder}
            onChange={(event) =>
              onChange({ ...values, location: event.target.value })
            }
          />
        </span>
      </label>

      <label className={styles.heroSearchField}>
        <span>{contractLabel}</span>
        <span className={styles.heroSearchControl}>
          <select
            value={values.employmentType}
            onChange={(event) =>
              onChange({ ...values, employmentType: event.target.value })
            }
          >
            <option value="">{contractPlaceholder}</option>
            {contractOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden />
        </span>
      </label>

      <button type="submit" className={styles.heroSearchSubmit}>
        <span>{submitLabel}</span>
        <Search aria-hidden />
      </button>
    </form>
  );
}

function formatCrewEmploymentType(
  value: (typeof crewEmploymentTypes)[number],
  language: "en" | "tr",
) {
  const labels = {
    Permanent: { en: "Permanent", tr: "Sürekli" },
    Seasonal: { en: "Seasonal", tr: "Sezonluk" },
    Rotational: { en: "Rotational", tr: "Rotasyonlu" },
    Temporary: { en: "Temporary", tr: "Geçici" },
    Delivery: { en: "Delivery", tr: "Teslim seyri" },
  } as const;
  return labels[value][language];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

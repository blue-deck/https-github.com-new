"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  FileCheck2,
  MapPin,
  Ruler,
  Search,
  ShieldCheck,
  Ship,
  UsersRound,
} from "lucide-react";
import { PublicFooter, PublicHeader } from "./components/PublicSiteChrome";
import { useLanguage } from "./components/LanguageProvider";
import {
  formatJobCandidateType,
  formatJobDate,
  formatJobEmploymentType,
  formatJobSalary,
  formatJobYachtLength,
  formatJobYachtType,
  parsePublicJobCards,
  type PublicJobCard,
} from "./jobs/job-card-data";
import {
  getJobListingAction,
  useJobListingViewer,
  type JobListingViewer,
} from "./jobs/JobListingAction";
import styles from "./homepage.module.css";

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
    heroTrust: "Private profiles. Role-based access. Clear ownership.",
    jobsEyebrow: "Latest opportunities",
    jobsTitle: "A focused path to your next role.",
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
    viewRole: "View role",
    start: "Start",
    notSpecified: "Not specified",
    salaryNotSpecified: "Salary on application",
    profilePromptEyebrow: "Stay ready",
    profilePromptTitle: "Make your experience easy to trust.",
    profilePromptText:
      "Keep your role, availability and essential records in one professional crew profile.",
    hiringPromptEyebrow: "Build your team",
    hiringPromptTitle: "Publish and manage roles in one place.",
    hiringPromptText:
      "Create listings, review applications and keep every shortlist organized.",
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
      "BlueDeck keeps access controlled and responsibilities visible from first contact to life on board.",
    trust1: "Role-based account access",
    trust2: "Permission-based crew discovery",
    trust3: "Traceable yacht workflows",
    getStarted: "Create a BlueDeck account",
  },
  tr: {
    eyebrow: "Yat kariyeri · işe alım · operasyon",
    titleLine1: "Doğru ekibi kurun.",
    titleLine2: "Yatı daha iyi yönetin.",
    intro:
      "Güvenilir yat ilanlarını bulun, doğru bilgilerle işe alım yapın ve teknedeki temel işleri tek, odaklı platformda yönetin.",
    browseJobs: "Açık ilanları keşfet",
    findCrew: "Profesyonel mürettebat bul",
    heroTrust: "Gizli profiller. Rol bazlı erişim. Net sorumluluk.",
    jobsEyebrow: "Güncel fırsatlar",
    jobsTitle: "Sıradaki görevinize giden sade yol.",
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
    viewRole: "İlanı incele",
    start: "Başlangıç",
    notSpecified: "Belirtilmedi",
    salaryNotSpecified: "Maaş başvuruda paylaşılır",
    profilePromptEyebrow: "Hazır kalın",
    profilePromptTitle: "Deneyiminizi güvenilir biçimde sunun.",
    profilePromptText:
      "Pozisyonunuzu, müsaitliğinizi ve temel kayıtlarınızı tek profesyonel profilde tutun.",
    hiringPromptEyebrow: "Ekibinizi kurun",
    hiringPromptTitle: "İlanları tek yerden yayınlayın ve yönetin.",
    hiringPromptText:
      "İlan oluşturun, başvuruları inceleyin ve aday listelerinizi düzenli tutun.",
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
      "BlueDeck, ilk temastan teknedeki yaşama kadar erişimi kontrollü ve sorumlulukları görünür tutar.",
    trust1: "Rol bazlı hesap erişimi",
    trust2: "İzin tabanlı mürettebat keşfi",
    trust3: "İzlenebilir yat iş akışları",
    getStarted: "BlueDeck hesabı oluştur",
  },
} as const;

export default function HomePageClient() {
  const { language } = useLanguage();
  const c = copy[language];
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
  const trustAction = isEmployerViewer
    ? { href: "/hiring", label: c.openHiring }
    : jobViewer.kind === "signed-in" &&
        (jobViewer.role === "crew" || jobViewer.role === "captain")
      ? { href: "/profile", label: c.manageProfile }
      : jobViewer.kind === "signed-in"
        ? { href: "/dashboard", label: c.openDashboard }
        : { href: "/login?mode=signup", label: c.getStarted };

  useEffect(() => {
    const controller = new AbortController();

    async function loadJobs() {
      try {
        const response = await fetch("/api/jobs", {
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

        setJobs(parsedJobs.slice(0, 3));
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
          <Image
            src="/bluedeck-hero-home.webp"
            alt=""
            fill
            preload
            sizes="100vw"
            className={styles.heroImage}
          />
          <div className={styles.heroOverlay} />
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

        <section className={styles.jobsSection} aria-labelledby="jobs-heading">
          <div className={styles.container}>
            <div className={styles.sectionHeadingRow}>
              <div>
                <p className={styles.eyebrow}>{c.jobsEyebrow}</p>
                <h2 id="jobs-heading" className={styles.sectionTitle}>
                  {c.jobsTitle}
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
                  {[0, 1, 2].map((item) => (
                    <div key={item} className={styles.jobSkeleton}>
                      <span />
                      <span />
                      <span />
                    </div>
                  ))}
                  <span className="sr-only">{c.loadingJobs}</span>
                </>
              ) : loadState === "ready" && jobs.length > 0 ? (
                <>
                  {jobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      language={language}
                      viewer={jobViewer}
                      copy={c}
                    />
                  ))}
                  {jobs.length < 3 && rolePrompt ? (
                    <RolePrompt span={3 - jobs.length} {...rolePrompt} />
                  ) : null}
                </>
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

function JobCard({
  job,
  language,
  viewer,
  copy: c,
}: {
  job: PublicJobCard;
  language: "en" | "tr";
  viewer: JobListingViewer;
  copy: (typeof copy)["en"] | (typeof copy)["tr"];
}) {
  const yachtType = job.yachtType
    ? formatJobYachtType(job.yachtType, language)
    : "";
  const yachtLength =
    job.yachtLength !== null && job.yachtLengthUnit
      ? formatJobYachtLength(job.yachtLength, job.yachtLengthUnit, language)
      : "";
  const salary = formatJobSalary(job.salary, language);
  const action = getJobListingAction(job.id, viewer, language);
  const detailHref = `/jobs/${encodeURIComponent(job.id)}`;

  return (
    <article className={styles.jobCard}>
      <div className={styles.jobHeader}>
        <div>
          {job.candidateType !== "individual" ? (
            <span className={styles.jobPill}>
              {formatJobCandidateType(job.candidateType, language)}
            </span>
          ) : null}
          <h3>{job.position}</h3>
        </div>
        <BriefcaseBusiness aria-hidden />
      </div>
      <p className={styles.jobEmployment}>
        {formatJobEmploymentType(job.employmentType, language)}
      </p>
      <div className={styles.jobMeta}>
        <span>
          <Ship aria-hidden />
          {yachtType || c.notSpecified}
        </span>
        <span>
          <Ruler aria-hidden />
          {yachtLength || c.notSpecified}
        </span>
        <span>
          <MapPin aria-hidden />
          {job.location || c.notSpecified}
        </span>
        <span>
          <CalendarDays aria-hidden />
          {job.startDate
            ? formatJobDate(job.startDate, language, {
                day: "numeric",
                month: "short",
              })
            : c.notSpecified}
        </span>
      </div>
      <div className={styles.jobFooter}>
        <strong>
          <CircleDollarSign aria-hidden />
          {salary || c.salaryNotSpecified}
        </strong>
        <div className={styles.jobActions}>
          <Link href={detailHref} className={styles.jobPrimaryAction}>
            {c.viewRole}
            <ArrowRight aria-hidden />
          </Link>
          {action.intent === "apply" || action.intent === "signup" ? (
            <Link href={action.href} className={styles.jobSecondaryAction}>
              {action.label}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
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

function RolePrompt({
  span,
  eyebrow,
  title,
  text,
  action,
  href,
}: {
  span: number;
  eyebrow: string;
  title: string;
  text: string;
  action: string;
  href: string;
}) {
  return (
    <aside className={styles.rolePrompt} data-span={span}>
      <ShieldCheck aria-hidden />
      <div>
        <p>{eyebrow}</p>
        <h3>{title}</h3>
        <span>{text}</span>
      </div>
      <Link href={href}>
        {action}
        <ArrowRight aria-hidden />
      </Link>
    </aside>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

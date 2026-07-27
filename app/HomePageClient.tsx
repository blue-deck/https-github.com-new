"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ClipboardCheck,
  Compass,
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
  formatJobEmploymentType,
  formatJobYachtLength,
  formatJobYachtType,
} from "./lib/jobPosts";
import {
  formatJobDate,
  formatJobSalary,
  parsePublicJobCards,
  type PublicJobCard,
} from "./jobs/job-data";
import {
  getJobListingAction,
  useJobListingViewer,
  type JobListingViewer,
} from "./jobs/JobListingAction";
import styles from "./homepage.module.css";

type LoadState = "loading" | "ready" | "error";

const copy = {
  en: {
    eyebrow: "Yacht careers · crew network · private Yacht-OS",
    titleLine1: "Careers at sea.",
    titleLine2: "Operations in sync.",
    intro:
      "Find trusted yacht roles, hire the right professionals and keep every critical onboard workflow connected in one refined platform.",
    browseJobs: "Explore open roles",
    findCrew: "Find crew",
    explorePlatform: "Discover Yacht-OS",
    trustLine: "Private by design",
    trustSubline: "Role-based access for crew, captains, managers and owners",
    audienceEyebrow: "Start with what you need",
    crewLabel: "For crew",
    crewTitle: "Move your career forward.",
    crewText:
      "Explore opportunities, build a professional profile and keep certificates ready for your next yacht.",
    crewAction: "Browse yacht jobs",
    yachtLabel: "For yachts",
    yachtTitle: "Build a crew you can trust.",
    yachtText:
      "Discover professionals, publish roles and bring your crew into one secure operating environment.",
    yachtAction: "Search crew",
    jobsEyebrow: "Live opportunities",
    jobsTitle: "Your next role could start here.",
    jobsIntro:
      "A focused view of the latest opportunities published through BlueDeck.",
    allJobs: "View all roles",
    loadingJobs: "Loading the latest roles",
    noJobsTitle: "New opportunities are on the horizon.",
    noJobsText:
      "Create your crew profile now and be ready when the next verified role is published.",
    noJobsEmployerText:
      "Use your hiring workspace to publish a role and start building the right shortlist.",
    createProfile: "Create crew profile",
    manageProfile: "Manage crew profile",
    openHiring: "My Job Postings & Hiring",
    openDashboard: "Open dashboard",
    jobsErrorTitle: "Roles are temporarily unavailable.",
    jobsErrorText: "You can still open the full jobs board and try again there.",
    openJobs: "Open jobs board",
    viewRole: "View role",
    listingNumber: "Listing no.",
    start: "Start",
    notSpecified: "Not specified",
    salaryNotSpecified: "Salary not specified",
    profilePromptEyebrow: "Stay ready",
    profilePromptTitle: "Let the right yacht discover you.",
    profilePromptText:
      "Build one credible crew profile for your experience, availability and essential documents.",
    hiringPromptEyebrow: "Build your team",
    hiringPromptTitle: "Publish and manage roles from one workspace.",
    hiringPromptText:
      "Create yacht job listings, review applications and keep every shortlist organized.",
    platformEyebrow: "One connected platform",
    platformTitle: "Less admin. More confidence on board.",
    platformIntro:
      "BlueDeck connects recruitment, crew records and daily yacht operations without turning the experience into another complicated dashboard.",
    feature1Title: "Hire with context",
    feature1Text:
      "Review professional profiles, documents and role fit before you invite someone on board.",
    feature2Title: "Keep records ready",
    feature2Text:
      "Contracts, certificates, expiry dates and crew information stay attached to the right account and yacht.",
    feature3Title: "Run daily operations",
    feature3Text:
      "Checklists, readiness and yacht workflows remain visible to the people who are responsible for them.",
    exploreServices: "Explore the platform",
    visualStatus: "Yacht workspace",
    visualReady: "Operational readiness",
    visualCrew: "Crew records",
    visualDocs: "Documents",
    visualChecklists: "Checklists",
    systemEyebrow: "A clearer way to work",
    systemTitle: "One professional identity, from first contact to life on board.",
    systemIntro:
      "Every part of BlueDeck is designed to keep the next decision simple, secure and traceable.",
    system1Title: "Professional crew profile",
    system1Text:
      "Experience, role, documents and availability presented in one credible profile.",
    system2Title: "Focused recruitment",
    system2Text:
      "The right information for faster shortlists and better hiring conversations.",
    system3Title: "Private Yacht-OS",
    system3Text:
      "A role-aware workspace for crew, vessel records and operational readiness.",
    trustEyebrow: "Built for trust",
    trustTitle: "The calm behind a well-run yacht.",
    trustText:
      "BlueDeck keeps access controlled, responsibilities clear and essential records organized—so teams can focus on the work that matters.",
    trust1: "Role-based private access",
    trust2: "Structured crew and yacht records",
    trust3: "Traceable operational workflows",
    getStarted: "Join BlueDeck",
  },
  tr: {
    eyebrow: "Yat kariyerleri · mürettebat ağı · private Yacht-OS",
    titleLine1: "Denizde kariyer.",
    titleLine2: "Operasyonda uyum.",
    intro:
      "Güvenilir yat ilanlarını keşfedin, doğru profesyonelleri işe alın ve kritik onboard iş akışlarını tek, rafine platformda bir araya getirin.",
    browseJobs: "Açık ilanları keşfet",
    findCrew: "Mürettebat bul",
    explorePlatform: "Yacht-OS’u keşfet",
    trustLine: "Gizlilik temelden tasarlandı",
    trustSubline: "Mürettebat, kaptan, yönetici ve sahipler için rol bazlı erişim",
    audienceEyebrow: "İhtiyacınızla başlayın",
    crewLabel: "Mürettebat için",
    crewTitle: "Kariyerinizi ileri taşıyın.",
    crewText:
      "İlanları keşfedin, profesyonel profilinizi oluşturun ve sertifikalarınızı bir sonraki yatınız için hazır tutun.",
    crewAction: "Yat ilanlarına göz at",
    yachtLabel: "Yatlar için",
    yachtTitle: "Güvenebileceğiniz ekibi kurun.",
    yachtText:
      "Profesyonelleri keşfedin, ilan yayınlayın ve mürettebatınızı güvenli bir operasyon ortamında bir araya getirin.",
    yachtAction: "Mürettebat ara",
    jobsEyebrow: "Güncel fırsatlar",
    jobsTitle: "Sıradaki göreviniz burada başlayabilir.",
    jobsIntro:
      "BlueDeck üzerinden yayınlanan en güncel fırsatların odaklı bir görünümü.",
    allJobs: "Tüm ilanları gör",
    loadingJobs: "Güncel ilanlar yükleniyor",
    noJobsTitle: "Yeni fırsatlar ufukta.",
    noJobsText:
      "Mürettebat profilinizi şimdi oluşturun ve sıradaki doğrulanmış ilan için hazır olun.",
    noJobsEmployerText:
      "İlan yayınlamak ve doğru aday listesini oluşturmaya başlamak için işe alım alanınızı kullanın.",
    createProfile: "Mürettebat profili oluştur",
    manageProfile: "Mürettebat profilini yönet",
    openHiring: "İş İlanlarım ve İşe Alım",
    openDashboard: "Dashboard’u aç",
    jobsErrorTitle: "İlanlara şu anda ulaşılamıyor.",
    jobsErrorText: "Yine de tam ilan panosunu açıp oradan tekrar deneyebilirsiniz.",
    openJobs: "İlan panosunu aç",
    viewRole: "İlanı gör",
    listingNumber: "İlan no:",
    start: "Başlangıç",
    notSpecified: "Belirtilmedi",
    salaryNotSpecified: "Maaş belirtilmedi",
    profilePromptEyebrow: "Hazır kalın",
    profilePromptTitle: "Doğru yatın sizi keşfetmesini sağlayın.",
    profilePromptText:
      "Deneyiminiz, müsaitliğiniz ve temel belgeleriniz için tek ve güvenilir mürettebat profili oluşturun.",
    hiringPromptEyebrow: "Ekibinizi kurun",
    hiringPromptTitle: "İlanları tek çalışma alanından yayınlayın ve yönetin.",
    hiringPromptText:
      "Yat iş ilanları oluşturun, başvuruları inceleyin ve aday listelerinizi düzenli tutun.",
    platformEyebrow: "Tek ve bağlantılı platform",
    platformTitle: "Daha az takip. Teknede daha çok güven.",
    platformIntro:
      "BlueDeck; işe alım, mürettebat kayıtları ve günlük yat operasyonlarını yeni bir karmaşık panel yaratmadan birbirine bağlar.",
    feature1Title: "Doğru bilgiyle işe alın",
    feature1Text:
      "Birini onboard davet etmeden önce profesyonel profilini, belgelerini ve role uygunluğunu değerlendirin.",
    feature2Title: "Kayıtları hazır tutun",
    feature2Text:
      "Kontratlar, sertifikalar, bitiş tarihleri ve mürettebat bilgileri doğru hesap ve yatla bağlı kalır.",
    feature3Title: "Günlük operasyonu yönetin",
    feature3Text:
      "Checklist, hazırlık ve yat iş akışları sorumlu kişilerin görebileceği şekilde düzenli kalır.",
    exploreServices: "Platformu keşfet",
    visualStatus: "Yat çalışma alanı",
    visualReady: "Operasyonel hazırlık",
    visualCrew: "Mürettebat kayıtları",
    visualDocs: "Belgeler",
    visualChecklists: "Checklist’ler",
    systemEyebrow: "Daha net bir çalışma yolu",
    systemTitle: "İlk temastan onboard yaşama kadar tek profesyonel kimlik.",
    systemIntro:
      "BlueDeck’in her parçası sıradaki kararı sade, güvenli ve izlenebilir tutmak için tasarlandı.",
    system1Title: "Profesyonel mürettebat profili",
    system1Text:
      "Deneyim, pozisyon, belgeler ve müsaitlik tek güvenilir profilde sunulur.",
    system2Title: "Odaklı işe alım",
    system2Text:
      "Daha hızlı kısa listeler ve daha iyi işe alım görüşmeleri için doğru bilgi.",
    system3Title: "Private Yacht-OS",
    system3Text:
      "Mürettebat, tekne kayıtları ve operasyonel hazırlık için role duyarlı çalışma alanı.",
    trustEyebrow: "Güven için tasarlandı",
    trustTitle: "İyi yönetilen bir yatın arkasındaki sakinlik.",
    trustText:
      "BlueDeck erişimi kontrollü, sorumlulukları net ve kritik kayıtları düzenli tutar; ekipler gerçekten önemli işe odaklanır.",
    trust1: "Rol bazlı özel erişim",
    trust2: "Yapılandırılmış mürettebat ve yat kayıtları",
    trust3: "İzlenebilir operasyon iş akışları",
    getStarted: "BlueDeck’e katıl",
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
    <main className={`bd-site-shell min-h-screen ${styles.page}`}>
      <PublicHeader homepageNavigation />

      <section className={styles.hero}>
        <Image
          src="/bluedeck-hero-home.webp"
          alt="Superyacht at a Mediterranean marina at blue hour"
          fill
          priority
          unoptimized
          sizes="100vw"
          className={styles.heroImage}
        />
        <div className={styles.heroOverlay} />
        <div className={`${styles.container} ${styles.heroInner}`}>
          <div className={styles.heroCopy}>
            <p className={styles.heroEyebrow}>
              <Compass aria-hidden />
              {c.eyebrow}
            </p>
            <h1 className={styles.heroTitle}>
              <span>{c.titleLine1}</span>
              <span>{c.titleLine2}</span>
            </h1>
            <p className={styles.heroIntro}>{c.intro}</p>
            <div className={styles.heroActions}>
              <Link href="/jobs" className={styles.primaryButton}>
                {c.browseJobs}
                <ArrowRight aria-hidden />
              </Link>
              <Link href="/find-crew" className={styles.secondaryButtonDark}>
                {c.findCrew}
              </Link>
              <Link href="/management" className={styles.textButtonDark}>
                {c.explorePlatform}
                <ArrowUpRight aria-hidden />
              </Link>
            </div>
            <div className={styles.heroTrust}>
              <ShieldCheck aria-hidden />
              <div>
                <strong>{c.trustLine}</strong>
                <span>{c.trustSubline}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.audienceSection} aria-labelledby="audience-heading">
        <div className={styles.container}>
          <div className={styles.audiencePanel}>
            <p id="audience-heading" className={styles.panelEyebrow}>
              {c.audienceEyebrow}
            </p>
            <div className={styles.audienceGrid}>
              <AudienceCard
                icon={<BriefcaseBusiness aria-hidden />}
                label={c.crewLabel}
                title={c.crewTitle}
                text={c.crewText}
                action={c.crewAction}
                href="/jobs"
              />
              <AudienceCard
                icon={<UsersRound aria-hidden />}
                label={c.yachtLabel}
                title={c.yachtTitle}
                text={c.yachtText}
                action={c.yachtAction}
                href="/find-crew"
              />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.jobsSection} aria-labelledby="jobs-heading">
        <div className={styles.container}>
          <div className={styles.sectionHeadingRow}>
            <div>
              <p className={styles.kicker}>{c.jobsEyebrow}</p>
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
                <div className={styles.emptyIcon}>
                  <Search aria-hidden />
                </div>
                <div>
                  <h3>{loadState === "error" ? c.jobsErrorTitle : c.noJobsTitle}</h3>
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

      <section id="yacht-platform" className={styles.platformSection} aria-labelledby="platform-heading">
        <div className={`${styles.container} ${styles.platformGrid}`}>
          <div className={styles.platformVisual}>
            <Image
              src="/bluedeck-platform-home.webp"
              alt="A clear yacht deck looking toward open water"
              fill
              unoptimized
              sizes="(max-width: 1024px) 100vw, 48vw"
              className={styles.platformImage}
            />
            <div className={styles.platformShade} />
            <div className={styles.workspaceCard}>
              <div className={styles.workspaceHeader}>
                <span>
                  <Ship aria-hidden />
                  {c.visualStatus}
                </span>
                <BadgeCheck aria-label="Verified" />
              </div>
              <div className={styles.readinessRow}>
                <span>{c.visualReady}</span>
                <strong>92%</strong>
              </div>
              <div className={styles.progressTrack}>
                <span />
              </div>
              <div className={styles.workspaceStats}>
                <span><UsersRound aria-hidden />{c.visualCrew}</span>
                <span><FileCheck2 aria-hidden />{c.visualDocs}</span>
                <span><ClipboardCheck aria-hidden />{c.visualChecklists}</span>
              </div>
            </div>
          </div>

          <div className={styles.platformCopy}>
            <p className={styles.kicker}>{c.platformEyebrow}</p>
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

            <Link href="/services" className={styles.darkButton}>
              {c.exploreServices}
              <ArrowRight aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.systemSection} aria-labelledby="system-heading">
        <div className={styles.container}>
          <div className={styles.systemHeading}>
            <p className={styles.kicker}>{c.systemEyebrow}</p>
            <h2 id="system-heading" className={styles.sectionTitle}>
              {c.systemTitle}
            </h2>
            <p className={styles.sectionIntro}>{c.systemIntro}</p>
          </div>
          <div className={styles.systemGrid}>
            <SystemCard
              number="01"
              icon={<BadgeCheck aria-hidden />}
              title={c.system1Title}
              text={c.system1Text}
            />
            <SystemCard
              number="02"
              icon={<UsersRound aria-hidden />}
              title={c.system2Title}
              text={c.system2Text}
            />
            <SystemCard
              number="03"
              icon={<Ship aria-hidden />}
              title={c.system3Title}
              text={c.system3Text}
            />
          </div>
        </div>
      </section>

      <section className={styles.trustSection} aria-labelledby="trust-heading">
        <div className={`${styles.container} ${styles.trustGrid}`}>
          <div>
            <p className={styles.trustKicker}>{c.trustEyebrow}</p>
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
            <Link href="/login?mode=signup" className={styles.primaryButton}>
              {c.getStarted}
              <ArrowRight aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

function AudienceCard({
  icon,
  label,
  title,
  text,
  action,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  text: string;
  action: string;
  href: string;
}) {
  return (
    <Link href={href} className={styles.audienceCard}>
      <span className={styles.audienceIcon}>{icon}</span>
      <span className={styles.audienceContent}>
        <small>{label}</small>
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
      <span className={styles.audienceAction}>
        {action}
        <ArrowRight aria-hidden />
      </span>
    </Link>
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

  return (
    <article className={styles.jobCard}>
      <div className={styles.jobTopline}>
        <span>{formatJobEmploymentType(job.employmentType, language)}</span>
        {job.candidateType !== "individual" ? (
          <span>
            {formatJobCandidateType(job.candidateType, language)}
          </span>
        ) : null}
      </div>
      <h3>{job.position}</h3>
      <div className={styles.jobMeta}>
        <span><Ship aria-hidden />{yachtType || c.notSpecified}</span>
        <span><Ruler aria-hidden />{yachtLength || c.notSpecified}</span>
        <span><MapPin aria-hidden />{job.location}</span>
        <span>
          <CalendarDays aria-hidden />
          {c.start}:{" "}
          {job.startDate
            ? formatJobDate(job.startDate, language, {
                day: "numeric",
                month: "short",
              })
            : c.notSpecified}
        </span>
      </div>
      <div className={styles.jobFooter}>
        <strong>{salary || c.salaryNotSpecified}</strong>
        <div className={styles.jobActions}>
          <Link href={action.href} className={styles.jobPrimaryAction}>
            {action.label}
            <ArrowRight aria-hidden />
          </Link>
          {action.intent === "signup" ? (
            <Link href={action.detailHref} className={styles.jobSecondaryAction}>
              {c.viewRole}
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
    <aside className={styles.profilePrompt} data-span={span}>
      <div className={styles.profilePromptIcon}>
        <BadgeCheck aria-hidden />
      </div>
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

function SystemCard({
  number,
  icon,
  title,
  text,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className={styles.systemCard}>
      <div className={styles.systemCardTop}>
        <span>{icon}</span>
        <small>{number}</small>
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

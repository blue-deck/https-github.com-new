"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ClipboardCheck,
  FileCheck2,
  ShieldCheck,
  Ship,
  UsersRound,
} from "lucide-react";
import { PublicPageShell } from "../components/PublicSiteChrome";
import { useLanguage } from "../components/LanguageProvider";
import { useJobListingViewer } from "../jobs/JobListingAction";
import styles from "./yacht-os.module.css";

const copy = {
  en: {
    eyebrow: "BlueDeck Yacht-OS",
    title: "One clear workspace from hiring to life on board.",
    intro:
      "BlueDeck connects professional crew discovery, secure records and daily yacht workflows without turning the experience into another crowded operations system.",
    overviewEyebrow: "One connected record",
    overviewTitle: "Keep people, records and responsibilities in context.",
    overviewText:
      "Every action stays connected to the right account, yacht and role. Teams spend less time chasing files and more time making informed decisions.",
    point1: "Invite crew through a permission-based workflow",
    point2: "Keep contracts, certificates and expiry dates organized",
    point3: "Assign and follow yacht work with clear ownership",
    previewLabel: "A focused yacht workspace",
    capabilitiesEyebrow: "Core capabilities",
    capabilitiesTitle: "Only the tools the team needs.",
    recruitmentTitle: "Recruitment",
    recruitmentText:
      "Publish roles, review professional profiles and move the right candidates into a secure hiring flow.",
    recordsTitle: "Crew records",
    recordsText:
      "Keep identity, experience, documents, contracts and essential dates attached to the right person.",
    operationsTitle: "Yacht operations",
    operationsText:
      "Use role-aware checklists and readiness workflows without losing accountability.",
    journeyEyebrow: "A simpler flow",
    journeyTitle: "Three stages. One professional identity.",
    step1Label: "01 · Discover",
    step1Title: "Find the right fit",
    step1Text:
      "Search roles or discover crew with focused, privacy-aware information.",
    step2Label: "02 · Connect",
    step2Title: "Invite securely",
    step2Text:
      "Keep hiring conversations and yacht invitations inside a controlled workflow.",
    step3Label: "03 · Operate",
    step3Title: "Work from one record",
    step3Text:
      "Carry the same professional context into crew records and daily operations.",
    trustEyebrow: "Access stays controlled",
    trustTitle: "Public profiles. Protected private records.",
    trustText:
      "Crew discovery can show faces in profile and gallery photos, plus selected professional and physical details. Full legal names, contact details, private documents and yacht workspaces remain behind account and role controls.",
    trustLink: "See how BlueDeck protects access",
    findCrew: "Find crew",
    createAccount: "Create account",
    openDashboard: "Open dashboard",
  },
  tr: {
    eyebrow: "BlueDeck Yacht-OS",
    title: "İşe alımdan teknedeki yaşama kadar tek ve net çalışma alanı.",
    intro:
      "BlueDeck; profesyonel mürettebat keşfini, güvenli kayıtları ve günlük yat işlerini yeni bir kalabalık operasyon sistemi yaratmadan birbirine bağlar.",
    overviewEyebrow: "Tek bağlantılı kayıt",
    overviewTitle: "İnsanları, kayıtları ve sorumlulukları aynı bağlamda tutun.",
    overviewText:
      "Her işlem doğru hesap, yat ve rolle bağlı kalır. Ekipler dosya aramak yerine doğru bilgilerle karar vermeye odaklanır.",
    point1: "Mürettebatı izin tabanlı bir akışla davet edin",
    point2: "Kontratları, sertifikaları ve bitiş tarihlerini düzenli tutun",
    point3: "Yat işlerini net sorumluluklarla atayın ve takip edin",
    previewLabel: "Odaklı yat çalışma alanı",
    capabilitiesEyebrow: "Temel yetenekler",
    capabilitiesTitle: "Yalnızca ekibin ihtiyaç duyduğu araçlar.",
    recruitmentTitle: "İşe alım",
    recruitmentText:
      "İlan yayınlayın, profesyonel profilleri inceleyin ve doğru adayları güvenli işe alım akışına taşıyın.",
    recordsTitle: "Mürettebat kayıtları",
    recordsText:
      "Kimlik, deneyim, belgeler, kontratlar ve önemli tarihleri doğru kişiyle bağlı tutun.",
    operationsTitle: "Yat operasyonları",
    operationsText:
      "Sorumluluğu kaybetmeden rol bazlı kontrol listeleri ve hazırlık akışları kullanın.",
    journeyEyebrow: "Daha sade bir akış",
    journeyTitle: "Üç aşama. Tek profesyonel kimlik.",
    step1Label: "01 · Keşfet",
    step1Title: "Doğru eşleşmeyi bulun",
    step1Text:
      "Odaklı ve gizliliğe duyarlı bilgilerle ilanları veya mürettebatı keşfedin.",
    step2Label: "02 · Bağlan",
    step2Title: "Güvenli davet edin",
    step2Text:
      "İşe alım görüşmelerini ve yat davetlerini kontrollü akışta tutun.",
    step3Label: "03 · Yönet",
    step3Title: "Tek kayıttan çalışın",
    step3Text:
      "Aynı profesyonel bağlamı mürettebat kayıtlarına ve günlük operasyona taşıyın.",
    trustEyebrow: "Erişim kontrollü kalır",
    trustTitle: "Herkese açık profiller. Korumalı özel kayıtlar.",
    trustText:
      "Crew keşfinde profil ve galeri fotoğraflarındaki yüzler ile seçili profesyonel ve fiziksel bilgiler gösterilebilir. Tam yasal adlar, iletişim bilgileri, özel belgeler ve yat çalışma alanları hesap ve rol kontrollerinin arkasında kalır.",
    trustLink: "BlueDeck’in erişimi nasıl koruduğunu görün",
    findCrew: "Mürettebat bul",
    createAccount: "Hesap oluştur",
    openDashboard: "Paneli aç",
  },
} as const;

export default function YachtOsPage() {
  const { language } = useLanguage();
  const c = copy[language];
  const viewer = useJobListingViewer();
  const accountAction =
    viewer.kind === "signed-in"
      ? { href: "/dashboard", label: c.openDashboard }
      : { href: "/login?mode=signup", label: c.createAccount };

  return (
    <PublicPageShell
      eyebrow={c.eyebrow}
      title={c.title}
      intro={c.intro}
    >
      <section className={styles.overview}>
        <div className={styles.overviewCopy}>
          <p className={styles.eyebrow}>{c.overviewEyebrow}</p>
          <h2>{c.overviewTitle}</h2>
          <p>{c.overviewText}</p>
          <ul>
            {[c.point1, c.point2, c.point3].map((point) => (
              <li key={point}>
                <Check aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.overviewVisual}>
          <Image
            src="/bluedeck-platform-home.webp"
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 48vw"
            className={styles.image}
          />
          <p>
            <Ship aria-hidden />
            {c.previewLabel}
          </p>
        </div>
      </section>

      <section className={styles.capabilities}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>{c.capabilitiesEyebrow}</p>
          <h2>{c.capabilitiesTitle}</h2>
        </div>
        <div className={styles.capabilityGrid}>
          <Capability
            icon={<BriefcaseBusiness aria-hidden />}
            title={c.recruitmentTitle}
            text={c.recruitmentText}
          />
          <Capability
            icon={<FileCheck2 aria-hidden />}
            title={c.recordsTitle}
            text={c.recordsText}
          />
          <Capability
            icon={<ClipboardCheck aria-hidden />}
            title={c.operationsTitle}
            text={c.operationsText}
          />
        </div>
      </section>

      <section className={styles.journey}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>{c.journeyEyebrow}</p>
          <h2>{c.journeyTitle}</h2>
        </div>
        <div className={styles.journeyGrid}>
          <Step label={c.step1Label} title={c.step1Title} text={c.step1Text} />
          <Step label={c.step2Label} title={c.step2Title} text={c.step2Text} />
          <Step label={c.step3Label} title={c.step3Title} text={c.step3Text} />
        </div>
      </section>

      <section className={styles.trust}>
        <div>
          <p className={styles.eyebrow}>{c.trustEyebrow}</p>
          <h2>{c.trustTitle}</h2>
          <p>{c.trustText}</p>
          <Link href="/trust">
            <ShieldCheck aria-hidden />
            {c.trustLink}
          </Link>
        </div>
        <div className={styles.actions}>
          <Link href="/find-crew" className={styles.secondaryAction}>
            <UsersRound aria-hidden />
            {c.findCrew}
          </Link>
          <Link href={accountAction.href} className={styles.primaryAction}>
            {accountAction.label}
            <ArrowRight aria-hidden />
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
}

function Capability({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className={styles.capability}>
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function Step({
  label,
  title,
  text,
}: {
  label: string;
  title: string;
  text: string;
}) {
  return (
    <article className={styles.step}>
      <small>{label}</small>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

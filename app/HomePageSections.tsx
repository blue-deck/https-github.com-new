"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ChevronDown, ClipboardCheck, Clock3, FileCheck2, Layers3, LockKeyhole, MapPin, Search, ShieldCheck, UsersRound } from "lucide-react";
import type { JobListingViewer } from "./jobs/JobListingAction";
import type { CrewJournalArticle } from "./lib/crewJournal";
import { yachtDepartments } from "./lib/yachtOperations";
import styles from "./homeContent.module.css";

type Language = "en" | "tr";
export type JournalPreview = Pick<CrewJournalArticle, "slug" | "image" | "imagePosition" | "readingMinutes" | "category" | "title" | "summary">;

export const homeCopy = {
  en: {
    searchLabel: "Find your next yacht role", keyword: "Position or keyword", location: "Location", department: "All departments", search: "Search jobs", all: "All roles",
    jobsTitle: "Find your next place on board.", filteredEmpty: "No open roles in this department yet.", filteredText: "Explore the other departments or visit the full jobs board.", clearFilter: "View all departments",
    crewEyebrow: "For crew", crewTitle: "A career that moves with you.", crewText: "Bring your experience, availability and next opportunity together.", crewAction: "Build your crew profile", profile: "Manage your crew profile", roles: "Explore open roles",
    hiringEyebrow: "For captains & owners", hiringTitle: "The right people. A stronger crew.", hiringText: "Discover professional crew, publish roles and manage applications in one place.", hiringAction: "Find professional crew", hiringWorkspace: "Open hiring workspace",
    platformEyebrow: "BlueDeck Yacht-OS", platformTitle: "A clearer view of life on board.", platformText: "Connect your crew, essential records and daily work in one yacht workspace.", platformAction: "Explore Yacht-OS",
    crewFeature: "Crew & recruitment", recordsFeature: "Documents & contracts", tasksFeature: "Checklists & daily operations",
    workspace: "Your yacht workspace", preview: "A look inside Yacht-OS", crew: "Crew", records: "Records", operations: "Operations", crewDetail: "Crew profiles and invitations", recordsDetail: "Documents, contracts and expiry dates", tasksDetail: "Responsibilities and recurring checklists",
    trustTitle: "Built around professional trust.", trust1: "Discover professional crew", trust1Text: "Selected profile details help you find the right fit.", trust2: "Private details stay protected", trust2Text: "Full names, contacts and private documents remain protected.", trust3: "Access follows your role", trust3Text: "Account permissions keep each workspace in the right hands.", trustAction: "Explore trust & privacy",
    journalEyebrow: "The Crew Journal", journalTitle: "Good reads. Better days on board.", journalText: "Practical advice for your career and life at sea.", journalAction: "Visit the journal", read: "Read the guide", minutes: "min read",
    ctaTitle: "Your next chapter starts here.", ctaText: "Find your opportunity. Build your crew. Bring it all together.", ctaAction: "Create your BlueDeck account", dashboard: "Open your dashboard",
  },
  tr: {
    searchLabel: "Bir sonraki yat ilanınızı bulun", keyword: "Pozisyon veya anahtar kelime", location: "Konum", department: "Tüm departmanlar", search: "İlan ara", all: "Tüm ilanlar",
    jobsTitle: "Teknede bir sonraki yerinizi bulun.", filteredEmpty: "Bu departmanda henüz açık ilan yok.", filteredText: "Diğer departmanları veya tüm ilan panosunu inceleyin.", clearFilter: "Tüm departmanları gör",
    crewEyebrow: "Mürettebat için", crewTitle: "Sizinle ilerleyen bir kariyer.", crewText: "Deneyiminizi, müsaitliğinizi ve yeni fırsatları bir araya getirin.", crewAction: "Mürettebat profili oluştur", profile: "Mürettebat profilini yönet", roles: "Açık ilanları keşfet",
    hiringEyebrow: "Kaptanlar ve yat sahipleri için", hiringTitle: "Doğru insanlar. Daha güçlü bir ekip.", hiringText: "Profesyonel mürettebatı keşfedin, ilan yayınlayın ve başvuruları tek yerden yönetin.", hiringAction: "Profesyonel mürettebat bul", hiringWorkspace: "İşe alım alanını aç",
    platformEyebrow: "BlueDeck Yacht-OS", platformTitle: "Teknedeki işlere daha net bir bakış.", platformText: "Mürettebatınızı, temel kayıtlarınızı ve günlük işlerinizi tek yat çalışma alanında buluşturun.", platformAction: "Yacht-OS’u keşfet",
    crewFeature: "Mürettebat ve işe alım", recordsFeature: "Belgeler ve kontratlar", tasksFeature: "Kontrol listeleri ve günlük işler",
    workspace: "Yat çalışma alanınız", preview: "Yacht-OS’a bir bakış", crew: "Mürettebat", records: "Kayıtlar", operations: "Operasyon", crewDetail: "Mürettebat profilleri ve davetler", recordsDetail: "Belgeler, kontratlar ve bitiş tarihleri", tasksDetail: "Sorumluluklar ve tekrarlayan kontrol listeleri",
    trustTitle: "Profesyonel ilişkiler, güvenilir bir temel.", trust1: "Profesyonel mürettebat keşfi", trust1Text: "Seçili profil bilgileri, uygun adayları bulmanıza yardımcı olur.", trust2: "Özel bilgiler korumalı kalır", trust2Text: "Tam adlar, iletişim bilgileri ve özel belgeler koruma altındadır.", trust3: "Rolünüze uygun erişim", trust3Text: "Hesap izinleri her çalışma alanını doğru kişilerle sınırlar.", trustAction: "Güven ve gizliliği incele",
    journalEyebrow: "Mürettebat Günlüğü", journalTitle: "Faydalı okumalar. Teknede daha iyi günler.", journalText: "Kariyeriniz ve denizde yaşam için pratik rehberler.", journalAction: "Tüm yazıları gör", read: "Rehberi oku", minutes: "dk okuma",
    ctaTitle: "Yeni yolculuğunuz burada başlıyor.", ctaText: "Fırsatınızı bulun. Ekibinizi kurun. İşlerinizi bir araya getirin.", ctaAction: "BlueDeck hesabınızı oluşturun", dashboard: "Panelinizi açın",
  },
} as const;

const departmentLabels: Record<string, string> = { Command: "Komuta", Deck: "Güverte", Engineering: "Makine", Interior: "İç Hizmetler", Galley: "Mutfak", Purser: "Purser", Guest: "Misafir", Toys: "Su Sporları", Safety: "Emniyet", Security: "Güvenlik", Medical: "Sağlık" };
export function departmentLabel(value: string, language: Language) {
  return language === "tr" ? departmentLabels[value] || value : value;
}

export function HomeJobSearch({ language }: { language: Language }) {
  const [department, setDepartment] = useState("");
  const c = homeCopy[language];
  return (
    <div className={styles.searchSection} data-i18n-ignore>
      <div className={styles.container}>
        <form action="/jobs" method="get" role="search" aria-label={c.searchLabel} className={styles.searchForm}>
          <label className={styles.searchField}>
            <Search aria-hidden />
            <span className="sr-only">{c.keyword}</span>
            <input type="search" name="q" maxLength={120} placeholder={c.keyword} />
          </label>
          <label className={styles.searchField}>
            <MapPin aria-hidden />
            <span className="sr-only">{c.location}</span>
            <input type="text" name="location" maxLength={120} placeholder={c.location} />
          </label>
          <label className={`${styles.searchField} ${styles.selectField}`}>
            <span className="sr-only">{c.department}</span>
            <select name={department ? "department" : undefined} value={department} onChange={(event) => setDepartment(event.target.value)}>
              <option value="">{c.department}</option>
              {yachtDepartments.map((value) => <option key={value} value={value}>{departmentLabel(value, language)}</option>)}
            </select>
            <ChevronDown aria-hidden />
          </label>
          <button type="submit" className={styles.button}>{c.search}<ArrowRight aria-hidden /></button>
        </form>
      </div>
    </div>
  );
}

export function HomePageSections({ language, viewer, articles }: { language: Language; viewer: JobListingViewer; articles: JournalPreview[] }) {
  const c = homeCopy[language];
  const isCrew = viewer.kind === "signed-in" && (viewer.role === "crew" || viewer.role === "captain");
  const canHire = viewer.kind === "signed-in" && (viewer.role === "owner" || viewer.role === "management" || viewer.role === "captain");
  const crewHref = isCrew ? "/profile" : viewer.kind === "signed-in" ? "/jobs" : "/login?mode=signup&role=crew";
  const crewLabel = isCrew ? c.profile : viewer.kind === "signed-in" ? c.roles : c.crewAction;
  const signedIn = viewer.kind === "signed-in";

  return (
    <div className={styles.content} data-i18n-ignore>
      <section aria-label={language === "tr" ? "Size uygun başlangıç" : "Find your way forward"} className={styles.audienceSection}>
        <div className={`${styles.container} ${styles.audienceGrid}`}>
          <article className={styles.audienceCard}>
            <div className={styles.audienceCopy}>
              <p className={styles.eyebrow}>{c.crewEyebrow}</p>
              <h2>{c.crewTitle}</h2>
              <p>{c.crewText}</p>
              <Link href={crewHref} className={styles.textLink}>{crewLabel}<ArrowRight aria-hidden /></Link>
            </div>
            <div className={styles.audienceImage}>
              <Image src="/media/journal-first-role.webp" alt="" fill sizes="(max-width: 640px) 38vw, (max-width: 1000px) 35vw, 23vw" style={{ objectPosition: "70% center" }} />
            </div>
          </article>
          <article className={styles.audienceCard}>
            <div className={styles.audienceCopy}>
              <p className={styles.eyebrow}>{c.hiringEyebrow}</p>
              <h2>{c.hiringTitle}</h2>
              <p>{c.hiringText}</p>
              <Link href={canHire ? "/hiring" : "/find-crew"} className={styles.textLink}>{canHire ? c.hiringWorkspace : c.hiringAction}<ArrowRight aria-hidden /></Link>
            </div>
            <div className={styles.audienceImage}>
              <Image src="/media/journal-onboard.webp" alt="" fill sizes="(max-width: 640px) 38vw, (max-width: 1000px) 35vw, 23vw" style={{ objectPosition: "72% center" }} />
            </div>
          </article>
        </div>
      </section>

      <section className={styles.platformSection} aria-labelledby="platform-heading">
        <div className={`${styles.container} ${styles.platformGrid}`}>
          <div className={styles.platformCopy}>
            <p className={styles.eyebrow}>{c.platformEyebrow}</p>
            <h2 id="platform-heading" className={styles.title}>{c.platformTitle}</h2>
            <p className={styles.intro}>{c.platformText}</p>
            <ul className={styles.platformFeatures}>
              <li><UsersRound aria-hidden />{c.crewFeature}</li>
              <li><FileCheck2 aria-hidden />{c.recordsFeature}</li>
              <li><ClipboardCheck aria-hidden />{c.tasksFeature}</li>
            </ul>
            <Link href="/yacht-os" className={styles.button}>{c.platformAction}<ArrowRight aria-hidden /></Link>
          </div>
          <figure className={styles.platformVisual}>
            <Image src="/bluedeck-platform-home.webp" alt="" fill sizes="(max-width: 900px) 100vw, 58vw" className={styles.deckImage} />
            <div className={styles.workspace}>
              <div className={styles.workspaceHeader}><Layers3 aria-hidden /><span>Yacht-OS</span></div>
              <div className={styles.workspaceBody}>
                <p className={styles.workspaceLabel}>{c.workspace}</p>
                <div className={styles.workspaceRow}><span><UsersRound aria-hidden /></span><div><h3>{c.crew}</h3><p>{c.crewDetail}</p></div></div>
                <div className={styles.workspaceRow}><span><FileCheck2 aria-hidden /></span><div><h3>{c.records}</h3><p>{c.recordsDetail}</p></div></div>
                <div className={styles.workspaceRow}><span><ClipboardCheck aria-hidden /></span><div><h3>{c.operations}</h3><p>{c.tasksDetail}</p></div></div>
              </div>
            </div>
            <figcaption>{c.preview}</figcaption>
          </figure>
        </div>
      </section>

      <section className={styles.trustSection} aria-labelledby="trust-heading">
        <div className={styles.container}>
          <h2 id="trust-heading">{c.trustTitle}</h2>
          <div className={styles.trustGrid}>
            {[{ Icon: UsersRound, title: c.trust1, text: c.trust1Text }, { Icon: LockKeyhole, title: c.trust2, text: c.trust2Text }, { Icon: ShieldCheck, title: c.trust3, text: c.trust3Text }].map(({ Icon, title, text }) => (
              <div key={title} className={styles.trustItem}><Icon aria-hidden /><div><h3>{title}</h3><p>{text}</p></div></div>
            ))}
          </div>
          <Link href="/trust" className={styles.textLink}>{c.trustAction}<ArrowRight aria-hidden /></Link>
        </div>
      </section>

      <section className={styles.journalSection} aria-labelledby="journal-heading">
        <div className={styles.container}>
          <div className={styles.headingRow}><div><p className={styles.eyebrow}>{c.journalEyebrow}</p><h2 id="journal-heading" className={styles.title}>{c.journalTitle}</h2><p className={styles.intro}>{c.journalText}</p></div><Link href="/journal" className={styles.textLink}>{c.journalAction}<ArrowRight aria-hidden /></Link></div>
          <div className={styles.journalGrid}>
            {articles.map((article, index) => (
              <article key={article.slug} className={index === 0 ? styles.featuredArticle : styles.smallArticle}>
                <Link href={`/journal/${article.slug}`} className={styles.articleLink}>
                  <div className={styles.articleImage}><Image src={article.image} alt="" fill sizes={index === 0 ? "(max-width: 800px) 100vw, 52vw" : "(max-width: 640px) 38vw, 24vw"} style={{ objectPosition: article.imagePosition }} /></div>
                  <div className={styles.articleCopy}><p className={styles.eyebrow}>{article.category[language]}</p><h3>{article.title[language]}</h3>{index === 0 ? <p className={styles.articleSummary}>{article.summary[language]}</p> : null}<span className={styles.readingTime}><Clock3 aria-hidden />{article.readingMinutes} {c.minutes}<ArrowRight aria-hidden className={styles.articleArrow} /></span></div>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.closingSection} aria-labelledby="closing-heading"><div className={styles.container}><div className={styles.closingCard}><div><h2 id="closing-heading">{c.ctaTitle}</h2><p>{c.ctaText}</p></div><div className={styles.closingActions}><Link href={signedIn ? "/dashboard" : "/login?mode=signup"} className={styles.button}>{signedIn ? c.dashboard : c.ctaAction}<ArrowRight aria-hidden /></Link><Link href="/yacht-os" className={styles.outlineButton}>{c.platformAction}</Link></div></div></div></section>
    </div>
  );
}

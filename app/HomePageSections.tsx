"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ChevronDown, LockKeyhole, MapPin, Search, ShieldCheck, UsersRound } from "lucide-react";
import type { JobListingViewer } from "./jobs/JobListingAction";
import { getHomeAudienceNavigation } from "./lib/homeAudienceNavigation";
import { yachtDepartments } from "./lib/yachtOperations";
import { YachtOsSection } from "./YachtOsSection";
import { GuidesHomeSection } from "./blog/_components/GuideCards";
import styles from "./homeContent.module.css";

type Language = "en" | "tr";

export const homeCopy = {
  en: {
    searchLabel: "Find your next yacht role", keyword: "Position or keyword", location: "Location", department: "All departments", search: "Search jobs", all: "All roles",
    filteredEmpty: "No open roles in this department yet.", filteredText: "Explore the other departments or visit the full jobs board.", clearFilter: "View all departments",
    crewEyebrow: "For crew", crewTitle: "Your next chapter at sea.", crewText: "Bring your experience and availability together. Find the role that fits.", crewAction: "Create your crew profile",
    crewImageAlt: "A white superyacht cruising across the sparkling blue Mediterranean Sea",
    hiringEyebrow: "For captains & owners", hiringTitle: "Find your professionals", hiringText: "Find experienced crew, publish roles and manage applications in one place.", hiringAction: "Create a job post",
    hiringImageAlt: "Five professional yacht crew members together on deck in white and navy uniforms",
    platformAction: "Explore Yacht-OS",
    trustTitle: "Built around professional trust.", trust1: "Discover professional crew", trust1Text: "Selected profile details help you find the right fit.", trust2: "Private details stay protected", trust2Text: "Full names, contacts and private documents remain protected.", trust3: "Access follows your role", trust3Text: "Account permissions keep each workspace in the right hands.", trustAction: "Explore trust & privacy",
    ctaTitle: "Your next chapter starts here.", ctaText: "Find your opportunity. Build your crew. Bring it all together.", ctaAction: "Create your BlueDeck account", dashboard: "Open your dashboard",
  },
  tr: {
    searchLabel: "Bir sonraki yat ilanınızı bulun", keyword: "Pozisyon veya anahtar kelime", location: "Konum", department: "Tüm departmanlar", search: "İlan ara", all: "Tüm ilanlar",
    filteredEmpty: "Bu departmanda henüz açık ilan yok.", filteredText: "Diğer departmanları veya tüm ilan panosunu inceleyin.", clearFilter: "Tüm departmanları gör",
    crewEyebrow: "Mürettebat için", crewTitle: "Denizde yeni bir başlangıç.", crewText: "Deneyiminizi ve müsaitliğinizi bir araya getirin. Size uygun pozisyonu bulun.", crewAction: "Mürettebat profilini oluştur",
    crewImageAlt: "Akdeniz’in parıldayan mavi sularında seyreden beyaz bir süperyat",
    hiringEyebrow: "Kaptanlar ve yat sahipleri için", hiringTitle: "Profesyonel ekibinizi bulun", hiringText: "Deneyimli mürettebatı bulun, ilan yayınlayın ve başvuruları tek yerden yönetin.", hiringAction: "İş ilanı oluştur",
    hiringImageAlt: "Beyaz ve lacivert üniformalarıyla güvertede bir araya gelen beş profesyonel yat çalışanı",
    platformAction: "Yacht-OS’u keşfet",
    trustTitle: "Profesyonel ilişkiler, güvenilir bir temel.", trust1: "Profesyonel mürettebat keşfi", trust1Text: "Seçili profil bilgileri, uygun adayları bulmanıza yardımcı olur.", trust2: "Özel bilgiler korumalı kalır", trust2Text: "Tam adlar, iletişim bilgileri ve özel belgeler koruma altındadır.", trust3: "Rolünüze uygun erişim", trust3Text: "Hesap izinleri her çalışma alanını doğru kişilerle sınırlar.", trustAction: "Güven ve gizliliği incele",
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

export function HomePageSections({ language, viewer }: { language: Language; viewer: JobListingViewer }) {
  const c = homeCopy[language];
  const { crewProfileHref, hiringHref } = getHomeAudienceNavigation(viewer);
  const signedIn = viewer.kind === "signed-in";

  return (
    <div className={styles.content} data-i18n-ignore>
      <section id="careers-and-hiring" aria-label={language === "tr" ? "Size uygun başlangıç" : "Find your way forward"} className={styles.audienceSection}>
        <div className={`${styles.container} ${styles.audienceGrid}`}>
          <article className={styles.audienceCard} aria-labelledby="crew-careers-heading">
            <div className={styles.audienceImage}>
              <Image
                src="/media/home-yacht-careers-v3.webp"
                alt={c.crewImageAlt}
                fill
                quality={90}
                sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 900px) 704px, (max-width: 1500px) 48vw, 704px"
              />
            </div>
            <div className={styles.audienceCopy}>
              <p className={styles.eyebrow}>{c.crewEyebrow}</p>
              <h2 id="crew-careers-heading">{c.crewTitle}</h2>
              <p>{c.crewText}</p>
              <Link href={crewProfileHref} className={styles.audienceButton}>
                {c.crewAction}<ArrowRight aria-hidden />
              </Link>
            </div>
          </article>
          <article className={styles.audienceCard} aria-labelledby="crew-hiring-heading">
            <div className={styles.audienceImage}>
              <Image
                src="/media/home-crew-professionals-v3.webp"
                alt={c.hiringImageAlt}
                fill
                quality={90}
                sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 900px) 704px, (max-width: 1500px) 48vw, 704px"
              />
            </div>
            <div className={styles.audienceCopy}>
              <p className={styles.eyebrow}>{c.hiringEyebrow}</p>
              <h2 id="crew-hiring-heading">{c.hiringTitle}</h2>
              <p>{c.hiringText}</p>
              <Link href={hiringHref} className={styles.audienceButton}>
                {c.hiringAction}<ArrowRight aria-hidden />
              </Link>
            </div>
          </article>
        </div>
      </section>

      <YachtOsSection language={language} />

      <GuidesHomeSection />

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

      <section className={styles.closingSection} aria-labelledby="closing-heading"><div className={styles.container}><div className={styles.closingCard}><div><h2 id="closing-heading">{c.ctaTitle}</h2><p>{c.ctaText}</p></div><div className={styles.closingActions}><Link href={signedIn ? "/dashboard" : "/login?mode=signup"} className={styles.button}>{signedIn ? c.dashboard : c.ctaAction}<ArrowRight aria-hidden /></Link><Link href="/yacht-os" className={styles.outlineButton}>{c.platformAction}</Link></div></div></div></section>
    </div>
  );
}

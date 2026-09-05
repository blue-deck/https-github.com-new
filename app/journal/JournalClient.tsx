"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import { useLanguage } from "../components/LanguageProvider";
import { PublicFooter, PublicHeader } from "../components/PublicSiteChrome";
import type { CrewJournalPreview } from "../lib/crewJournal";
import styles from "./journal.module.css";

export function JournalClient({ articles }: { articles: CrewJournalPreview[] }) {
  const { language } = useLanguage();
  const isTurkish = language === "tr";

  return (
    <div className={`bd-site-shell ${styles.shell}`}>
      <PublicHeader />
      <main id="main-content" className={styles.main} data-i18n-ignore>
        <section className={styles.intro} aria-labelledby="journal-title">
          <p className={styles.eyebrow}>BlueDeck Journal</p>
          <h1 id="journal-title">
            {isTurkish ? "Denizdeki kariyerinize bir bakış." : "A perspective on life at sea."}
          </h1>
          <p className={styles.introText}>
            {isTurkish
              ? "Bir sonraki işiniz, mesleki profiliniz ve yattaki yaşamınız için pratik rehberler."
              : "Practical guides for your next role, your professional profile and everyday life on board."}
          </p>
        </section>

        <section className={styles.editorialGrid} aria-label={isTurkish ? "Mürettebat rehberleri" : "Crew guides"}>
          {articles.map((article, index) => (
            <article key={article.slug} className={index === 0 ? styles.featuredCard : styles.sideCard}>
              <Link href={`/journal/${article.slug}`} className={styles.cardLink}>
                <div className={styles.cardImage}>
                  <Image
                    src={article.image}
                    alt=""
                    fill
                    sizes={index === 0 ? "(max-width: 760px) 100vw, 58vw" : "(max-width: 520px) 100vw, 220px"}
                    style={{ objectPosition: article.imagePosition }}
                    preload={index === 0}
                  />
                </div>
                <div className={styles.cardCopy}>
                  <p className={styles.eyebrow}>{article.category[language]}</p>
                  <h2>{article.title[language]}</h2>
                  <p className={styles.summary}>{article.summary[language]}</p>
                  <div className={styles.cardBottom}>
                    <span className={styles.readingTime}>
                      <Clock3 size={14} aria-hidden />
                      {article.readingMinutes} {isTurkish ? "dk okuma" : "min read"}
                    </span>
                    <span className={styles.readLink}>
                      {isTurkish ? "Rehberi oku" : "Read the guide"}
                      <ArrowRight size={16} aria-hidden />
                    </span>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </section>

        <section className={styles.nextStep} aria-labelledby="next-step-title">
          <div>
            <p className={styles.eyebrow}>{isTurkish ? "Bir sonraki adım" : "Your next step"}</p>
            <h2 id="next-step-title">{isTurkish ? "Deneyiminize uygun bir rol keşfedin." : "Find a role that fits your experience."}</h2>
            <p>{isTurkish ? "Güncel yat ilanlarını inceleyin ve yeni fırsatları değerlendirin." : "Explore current yacht jobs and see where your skills could take you."}</p>
          </div>
          <Link className={styles.primaryLink} href="/jobs">
            {isTurkish ? "İş ilanlarını keşfet" : "Explore yacht jobs"}
            <ArrowRight size={17} aria-hidden />
          </Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

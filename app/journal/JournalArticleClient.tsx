"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock3 } from "lucide-react";
import { useLanguage } from "../components/LanguageProvider";
import { PublicFooter, PublicHeader } from "../components/PublicSiteChrome";
import type { CrewJournalArticle, CrewJournalPreview } from "../lib/crewJournal";
import styles from "./journal.module.css";

export function JournalArticleClient({
  article,
  relatedArticles,
}: {
  article: CrewJournalArticle;
  relatedArticles: CrewJournalPreview[];
}) {
  const { language } = useLanguage();
  const isTurkish = language === "tr";
  const profileGuide = article.slug === "crew-profile-guide";

  return (
    <div className={`bd-site-shell ${styles.shell}`}>
      <PublicHeader />
      <main id="main-content" className={styles.main} data-i18n-ignore>
        <article>
          <header className={styles.articleHeader}>
            <Link className={styles.backLink} href="/journal">
              <ArrowLeft size={16} aria-hidden />
              {isTurkish ? "Tüm rehberler" : "All guides"}
            </Link>
            <p className={styles.eyebrow}>{article.category[language]}</p>
            <h1>{article.title[language]}</h1>
            <p className={styles.articleSummary}>{article.summary[language]}</p>
            <div className={styles.articleMeta}>
              <span>BlueDeck Journal</span>
              <span className={styles.readingTime}>
                <Clock3 size={15} aria-hidden />
                {article.readingMinutes} {isTurkish ? "dk okuma" : "min read"}
              </span>
            </div>
          </header>

          <div className={styles.articleImage}>
            <Image
              src={article.image}
              alt=""
              fill
              sizes="(max-width: 1200px) 100vw, 1180px"
              style={{ objectPosition: article.imagePosition }}
              preload
            />
          </div>

          <div className={styles.articleLayout}>
            <aside className={styles.contents}>
              <nav aria-label={isTurkish ? "Bu rehberde" : "In this guide"}>
                <p className={styles.eyebrow}>{isTurkish ? "Bu rehberde" : "In this guide"}</p>
                <ol>
                  {article.sections.map((section, index) => (
                    <li key={section.heading.en}>
                      <a href={`#section-${index + 1}`}>{section.heading[language]}</a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>

            <div className={styles.articleBody}>
              {article.sections.map((section, index) => (
                <section key={section.heading.en} id={`section-${index + 1}`} className={styles.articleSection}>
                  <h2>{section.heading[language]}</h2>
                  {section.paragraphs[language].map((paragraph, paragraphIndex) => (
                    <p key={paragraphIndex}>{paragraph}</p>
                  ))}
                </section>
              ))}
              <div className={styles.articleAction}>
                <p>
                  {profileGuide
                    ? isTurkish ? "Profilinize yeni bir gözle bakın." : "Give your profile a fresh look."
                    : isTurkish ? "Bir sonraki adımınızı keşfedin." : "Explore your next step."}
                </p>
                <Link className={styles.primaryLink} href={profileGuide ? "/profile" : "/jobs"}>
                  {profileGuide
                    ? isTurkish ? "Profilime git" : "Go to my profile"
                    : isTurkish ? "İş ilanlarını keşfet" : "Explore yacht jobs"}
                  <ArrowRight size={17} aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </article>

        <section className={styles.related} aria-labelledby="related-title">
          <div className={styles.relatedHeading}>
            <h2 id="related-title">{isTurkish ? "Okumaya devam edin." : "Keep exploring."}</h2>
            <Link className={styles.readLink} href="/journal">
              {isTurkish ? "Tüm rehberler" : "All guides"}<ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          <div className={styles.relatedGrid}>
            {relatedArticles.map((entry) => (
              <article className={styles.relatedCard} key={entry.slug}>
                <Link className={styles.cardLink} href={`/journal/${entry.slug}`}>
                  <div className={styles.cardImage}>
                    <Image src={entry.image} alt="" fill sizes="(max-width: 640px) 100vw, 50vw" style={{ objectPosition: entry.imagePosition }} />
                  </div>
                  <div className={styles.cardCopy}>
                    <p className={styles.eyebrow}>{entry.category[language]}</p>
                    <h3>{entry.title[language]}</h3>
                    <p className={styles.summary}>{entry.summary[language]}</p>
                    <span className={styles.readLink}>
                      {isTurkish ? "Rehberi oku" : "Read the guide"}<ArrowRight size={16} aria-hidden />
                    </span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

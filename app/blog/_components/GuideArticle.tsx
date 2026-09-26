"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Clock3, Compass } from "lucide-react";
import { useLanguage } from "../../components/LanguageProvider";
import { GuideChecklist, ReadingProgress } from "./ArticleTools";
import { GuideCard } from "./GuideCard";
import type { Guide } from "./guide-data";
import { guideBase, getGuideSummaries, type GuideLanguage } from "./guide-index";
import { getBlogCopy } from "./blog-copy";
import styles from "./guides.module.css";

export function GuideArticle({ translations }: { translations: Record<GuideLanguage, Guide> }) {
  const { language } = useLanguage();
  const guide = translations[language];
  const copy = getBlogCopy(language);
  const related = getGuideSummaries(language).filter((item) => item.slug !== guide.slug);

  return (
    <main id="main-content" lang={language} data-i18n-ignore className={`${styles.scope} ${styles.articlePage}`}>
      <ReadingProgress language={language} />
      <div className={styles.container}>
        <nav aria-label={copy.breadcrumb} className={styles.breadcrumb}>
          <Link href="/">{copy.home}</Link><span>/</span><Link href={guideBase}>Blog</Link><span>/</span><span aria-current="page">{guide.category}</span>
        </nav>
        <header className={styles.articleHeading}>
          <div className={styles.meta}><span>{guide.category}</span><span><Clock3 aria-hidden />{guide.minutes} {copy.minutes}</span></div>
          <h1>{guide.title}</h1>
          <p className={styles.articleDek}>{guide.description}</p>
          <div className={styles.articleByline}>
            <span className={styles.authorMark}>B<span>•</span></span>
            <div><strong>BlueDeck Blog</strong><span><time dateTime={guide.publishedAt}>{guide.date}</time></span></div>
          </div>
        </header>
        <figure className={styles.articleHero}>
          <div><Image src={guide.image} alt={guide.imageAlt} fill preload sizes="(max-width: 1280px) 100vw, 1280px" /></div>
          <figcaption>BLUEDECK BLOG <span>{copy.articleCaption}</span></figcaption>
        </figure>
        <div className={styles.readingLayout}>
          <aside className={styles.articleSidebar}>
            <div className={styles.stickyContents}>
              <p className={styles.eyebrow}>{copy.inArticle}</p>
              <nav aria-label={copy.tableOfContents}>
                {guide.sections.map((section, index) => <a key={section.id} href={`#${section.id}`}><span>{String(index + 1).padStart(2, "0")}</span>{section.title}</a>)}
                <a href="#checklist"><span>✓</span>{copy.checklist}</a>
              </nav>
              <div className={styles.sidebarNote}><Compass aria-hidden /><p>{copy.sidebarNote}<br /><strong>{copy.sidebarNoteEnd}</strong></p></div>
              <Link href={guideBase} className={styles.backLink}><ArrowLeft aria-hidden /> {copy.backToArticles}</Link>
            </div>
          </aside>
          <article id="guide-content" className={styles.articleBody}>
            <div className={styles.takeaway}><p className={styles.eyebrow}>{copy.atAGlance}</p><p>{guide.takeaway}</p></div>
            {guide.sections.map((section, index) => (
              <section className={styles.proseSection} id={section.id} key={section.id}>
                <div className={styles.chapterLabel}>{copy.chapter} {String(index + 1).padStart(2, "0")}</div>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
              </section>
            ))}
            <GuideChecklist key={guide.slug} items={guide.checklist} slug={guide.slug} language={language} />
            <div className={styles.articleCta}>
              <Compass aria-hidden /><p className={styles.eyebrow}>{copy.nextStep}</p>
              <h2>{guide.ctaTitle}</h2><p>{guide.ctaDescription}</p>
              <Link href={guide.ctaHref} className={styles.primaryButton}>{guide.ctaLabel}<ArrowUpRight aria-hidden /></Link>
            </div>
            <div className={styles.authorFooter}>
              <span className={styles.authorMark}>B<span>•</span></span>
              <div><strong>BlueDeck Blog</strong><p>{copy.authorDescription}</p></div>
            </div>
          </article>
        </div>
        <section className={styles.related} aria-labelledby="related-heading">
          <div className={styles.relatedHead}>
            <div><p className={styles.eyebrow}>{copy.keepReading}</p><h2 id="related-heading">{copy.nextArticle}</h2></div>
            <Link href={guideBase} className={styles.readLink}>{copy.allArticles} <ArrowRight aria-hidden /></Link>
          </div>
          <div className={styles.relatedGrid}>{related.map((item) => <GuideCard key={item.slug} guide={item} language={language} />)}</div>
        </section>
      </div>
    </main>
  );
}

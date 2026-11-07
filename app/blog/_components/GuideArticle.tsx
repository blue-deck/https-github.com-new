"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Clock3, Compass } from "lucide-react";
import { useLanguage } from "../../components/LanguageProvider";
import { GuideChecklist, ReadingProgress } from "./ArticleTools";
import { GuideCard } from "./GuideCard";
import type { Guide } from "./guide-data";
import { guideBase, type GuideLanguage, type GuideSummary } from "./guide-index";
import { getBlogCopy } from "./blog-copy";
import styles from "./guides.module.css";

type ArticleGuide = Guide & { author?: string; language?: GuideLanguage };

export function GuideArticle({ translations, relatedTranslations, updatedAt, preview = false, previewLanguage }: {
  translations: Record<GuideLanguage, ArticleGuide>;
  relatedTranslations?: Record<GuideLanguage, GuideSummary[]>;
  updatedAt?: string | null;
  preview?: boolean;
  previewLanguage?: GuideLanguage;
}) {
  const { language: siteLanguage } = useLanguage();
  const language = preview && previewLanguage ? previewLanguage : siteLanguage;
  const guide = translations[language];
  const copy = getBlogCopy(language);
  const related = (relatedTranslations?.[language] ?? []).filter((item) => item.slug !== guide.slug);
  const author = guide.author || "BlueDeck Blog";
  const formatDate = new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" });
  const publishedDate = guide.publishedAt && Number.isFinite(Date.parse(guide.publishedAt)) ? formatDate.format(new Date(guide.publishedAt)) : null;
  const updatedDate = updatedAt && Number.isFinite(Date.parse(updatedAt)) ? formatDate.format(new Date(updatedAt)) : null;
  const updated = updatedDate !== publishedDate ? updatedDate : null;
  const Container = preview ? "div" : "main";

  return (
    <Container id={preview ? undefined : "main-content"} lang={guide.language ?? language} data-i18n-ignore className={`${styles.scope} ${styles.articlePage}`}>
      {!preview && <ReadingProgress language={language} />}
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
            <div><strong>{author}</strong>{publishedDate && <span><time dateTime={guide.publishedAt}>{guide.date}</time>{updated && <> · {language === "tr" ? "Güncellendi" : "Updated"} <time dateTime={updatedAt!}>{updated}</time></>}</span>}</div>
          </div>
        </header>
        <div className={styles.readingLayout}>
          <aside className={styles.articleSidebar}>
            <div className={styles.stickyContents}>
              <p className={styles.eyebrow}>{copy.inArticle}</p>
              <nav aria-label={copy.tableOfContents}>
                {guide.sections.map((section, index) => <a key={section.id} href={`#${section.id}`}><span>{String(index + 1).padStart(2, "0")}</span>{section.title}</a>)}
                {guide.checklist.length > 0 && <a href="#checklist"><span>✓</span>{copy.checklist}</a>}
              </nav>
              <div className={styles.sidebarNote}><Compass aria-hidden /><p>{copy.sidebarNote}<br /><strong>{copy.sidebarNoteEnd}</strong></p></div>
              <Link href={guideBase} className={styles.backLink}><ArrowLeft aria-hidden /> {copy.backToArticles}</Link>
            </div>
          </aside>
          <article id="guide-content" className={styles.articleBody}>
            {guide.takeaway && <div className={styles.takeaway}><p className={styles.eyebrow}>{copy.atAGlance}</p><p>{guide.takeaway}</p></div>}
            {guide.sections.map((section, index) => (
              <section className={styles.proseSection} id={section.id} key={section.id}>
                <div className={styles.chapterLabel}>{copy.chapter} {String(index + 1).padStart(2, "0")}</div>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
                {!!section.bullets?.length && <ul>{section.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}</ul>}
              </section>
            ))}
            {guide.checklist.length > 0 && <GuideChecklist key={`${guide.slug}-${language}`} items={guide.checklist} slug={guide.slug} language={language} />}
            {guide.ctaTitle && guide.ctaHref && guide.ctaLabel && <div className={styles.articleCta}>
              <Compass aria-hidden /><p className={styles.eyebrow}>{copy.nextStep}</p>
              <h2>{guide.ctaTitle}</h2><p>{guide.ctaDescription}</p>
              <Link href={guide.ctaHref} className={styles.primaryButton}>{guide.ctaLabel}<ArrowUpRight aria-hidden /></Link>
            </div>}
            <div className={styles.authorFooter}>
              <span className={styles.authorMark}>B<span>•</span></span>
              <div><strong>{author}</strong>{author === "BlueDeck Blog" && <p>{copy.authorDescription}</p>}</div>
            </div>
          </article>
        </div>
        {related.length > 0 && <section className={styles.related} aria-labelledby="related-heading">
          <div className={styles.relatedHead}>
            <div><p className={styles.eyebrow}>{copy.keepReading}</p><h2 id="related-heading">{copy.nextArticle}</h2></div>
            <Link href={guideBase} className={styles.readLink}>{copy.allArticles} <ArrowRight aria-hidden /></Link>
          </div>
          <div className={styles.relatedGrid}>{related.map((item) => <GuideCard key={item.slug} guide={item} language={language} />)}</div>
        </section>}
      </div>
    </Container>
  );
}

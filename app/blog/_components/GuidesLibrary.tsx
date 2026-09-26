"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { useLanguage } from "../../components/LanguageProvider";
import { GuideCard } from "./GuideCard";
import { getGuideSummaries, type GuideSummary } from "./guide-index";
import { articleCount, getBlogCopy } from "./blog-copy";
import styles from "./guides.module.css";

type CategoryFilter = "all" | GuideSummary["categoryId"];

export function GuidesLibrary() {
  const { language } = useLanguage();
  const copy = getBlogCopy(language);
  const guides = getGuideSummaries(language);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const categories: { id: CategoryFilter; label: string }[] = [
    { id: "all", label: copy.all },
    { id: "career", label: copy.career },
    { id: "cv-profile", label: copy.cvProfile },
    { id: "onboard-life", label: copy.onboardLife },
  ];
  const search = query.trim().toLocaleLowerCase(language);
  const filtered = guides.filter((guide) =>
    (category === "all" || category === guide.categoryId) &&
    `${guide.title} ${guide.description} ${guide.category}`.toLocaleLowerCase(language).includes(search),
  );
  const categoryLabel = categories.find((item) => item.id === category)?.label ?? copy.all;

  function resetFilters() {
    setQuery("");
    setCategory("all");
  }

  return (
    <main id="main-content" lang={language} data-i18n-ignore className={`${styles.scope} ${styles.library}`}>
      <div className={styles.container}>
        <nav aria-label={copy.breadcrumb} className={styles.breadcrumb}>
          <Link href="/">{copy.home}</Link><span>/</span><span aria-current="page">Blog</span>
        </nav>
        <div className={styles.libraryIntro}>
          <p className={styles.eyebrow}><span /> BLUEDECK BLOG</p>
          <h1>{copy.libraryTitle}<br /><span>{copy.libraryTitleAccent}</span></h1>
          <p>{copy.libraryDescription}<br className={styles.desktopBreak} /> {copy.libraryDescriptionEnd}</p>
        </div>
        <div className={styles.filterBar}>
          <div className={styles.filters} role="group" aria-label={copy.categories}>
            {categories.map((item) => <button key={item.id} type="button" aria-pressed={item.id === category} onClick={() => setCategory(item.id)}>{item.label}</button>)}
          </div>
          <div className={styles.searchField}>
            <Search aria-hidden />
            <input type="search" aria-label={copy.search} placeholder={copy.search} value={query} onChange={(event) => setQuery(event.target.value)} />
            {query && <button type="button" onClick={() => setQuery("")} aria-label={copy.clearSearch}><X aria-hidden /></button>}
          </div>
        </div>
        <div className={styles.resultsLabel} aria-live="polite">
          <span>{(category === "all" ? copy.allArticles : categoryLabel).toLocaleUpperCase(language)}</span>
          <span>{articleCount(filtered.length, language)}</span>
        </div>
        {filtered.length ? (
          <div className={styles.libraryGrid}>
            {filtered.map((guide) => <GuideCard key={guide.slug} guide={guide} language={language} />)}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Search aria-hidden /><h2>{copy.emptyTitle}</h2><p>{copy.emptyDescription}</p>
            <button type="button" className={styles.outlineButton} onClick={resetFilters}>{copy.showAll} <ArrowRight aria-hidden /></button>
          </div>
        )}
        <div className={styles.libraryCta}>
          <div><p className={styles.eyebrow}>{copy.libraryCtaEyebrow}</p><h2>{copy.libraryCtaTitle}<br />{copy.libraryCtaTitleEnd}</h2></div>
          <Link className={styles.primaryButton} href="/jobs">{copy.exploreJobs} <ArrowRight aria-hidden /></Link>
        </div>
      </div>
    </main>
  );
}

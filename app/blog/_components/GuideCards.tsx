"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLanguage } from "../../components/LanguageProvider";
import { guideBase, type GuideLanguage, type GuideSummary } from "./guide-index";
import { getBlogCopy } from "./blog-copy";
import { GuidesCarousel } from "./GuidesCarousel";
import styles from "./guides.module.css";

export function GuidesHomeSection({ translations }: { translations: Record<GuideLanguage, GuideSummary[]> }) {
  const { language } = useLanguage();
  const copy = getBlogCopy(language);
  const guides = translations[language];

  if (!guides.length) return null;

  return (
    <section
      id="blog"
      lang={language}
      data-i18n-ignore
      className={`${styles.scope} ${styles.homeSection}`}
      aria-labelledby="blog-heading"
    >
      <span id="rehberler" className={styles.anchorAlias} aria-hidden />
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <div>
            <h2 id="blog-heading" className={styles.eyebrow}><span /> BLUEDECK BLOG</h2>
          </div>
          <div className={styles.sectionHeadAside}>
            <p>{copy.homeDescription}<br />{copy.homeDescriptionEnd}</p>
            <Link className={styles.outlineButton} href={guideBase}>
              {copy.allArticles} <ArrowUpRight aria-hidden />
            </Link>
          </div>
        </div>
        <GuidesCarousel key={guides.map((guide) => guide.slug).join("|")} language={language} guides={guides} />
      </div>
    </section>
  );
}

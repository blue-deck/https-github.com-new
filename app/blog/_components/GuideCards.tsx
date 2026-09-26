"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLanguage } from "../../components/LanguageProvider";
import { guideBase } from "./guide-index";
import { getBlogCopy } from "./blog-copy";
import { GuidesCarousel } from "./GuidesCarousel";
import styles from "./guides.module.css";

export function GuidesHomeSection() {
  const { language } = useLanguage();
  const copy = getBlogCopy(language);

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
            <p className={styles.eyebrow}><span /> BLUEDECK BLOG</p>
            <h2 id="blog-heading">{copy.homeTitle}<br /><span>{copy.homeTitleAccent}</span></h2>
          </div>
          <div className={styles.sectionHeadAside}>
            <p>{copy.homeDescription}<br />{copy.homeDescriptionEnd}</p>
            <Link className={styles.outlineButton} href={guideBase}>
              {copy.allArticles} <ArrowUpRight aria-hidden />
            </Link>
          </div>
        </div>
        <GuidesCarousel language={language} />
        <div className={styles.sectionFoot}>
          <span>{copy.homeFooter}</span>
          <span>{copy.career} <i /> {copy.cvProfile} <i /> {copy.onboardLife}</span>
        </div>
      </div>
    </section>
  );
}

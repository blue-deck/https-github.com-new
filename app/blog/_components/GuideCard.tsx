import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Clock3 } from "lucide-react";
import { guideHref, type GuideLanguage, type GuideSummary } from "./guide-index";
import { getBlogCopy } from "./blog-copy";
import styles from "./guides.module.css";

type GuideCardProps = {
  guide: GuideSummary;
  language: GuideLanguage;
  compact?: boolean;
  tabIndex?: number;
};

export function GuideCard({ guide, language, compact = false, tabIndex }: GuideCardProps) {
  const copy = getBlogCopy(language);
  return (
    <Link href={guideHref(guide.slug)} tabIndex={tabIndex} className={`${styles.card} ${compact ? styles.compactCard : ""}`}>
      <div className={styles.cardImage}>
        <Image src={guide.image} alt={guide.imageAlt} fill sizes={compact ? "(max-width: 640px) 38vw, 200px" : "(max-width: 760px) 100vw, 33vw"} />
        <span className={styles.imageArrow}><ArrowUpRight aria-hidden /></span>
      </div>
      <div className={styles.cardCopy}>
        <div className={styles.meta}><span>{guide.category}</span><span><Clock3 aria-hidden />{guide.minutes} {copy.minutes}</span></div>
        <h3>{guide.title}</h3>
        <p>{guide.description}</p>
        <span className={styles.readLink}>{copy.readArticle} <ArrowRight aria-hidden /></span>
      </div>
    </Link>
  );
}

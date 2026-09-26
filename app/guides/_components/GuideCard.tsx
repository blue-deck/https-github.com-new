import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Clock3 } from "lucide-react";
import { guideHref, type GuideSummary } from "./guide-index";
import styles from "./guides.module.css";

export function GuideCard({ guide, compact = false, tabIndex }: { guide: GuideSummary; compact?: boolean; tabIndex?: number }) {
  return (
    <Link href={guideHref(guide.slug)} tabIndex={tabIndex} className={`${styles.card} ${compact ? styles.compactCard : ""}`}>
      <div className={styles.cardImage}>
        <Image src={guide.image} alt={guide.imageAlt} fill sizes={compact ? "(max-width: 640px) 38vw, 200px" : "(max-width: 760px) 100vw, 33vw"} />
        <span className={styles.imageArrow}><ArrowUpRight aria-hidden /></span>
      </div>
      <div className={styles.cardCopy}>
        <div className={styles.meta}><span>{guide.category}</span><span><Clock3 aria-hidden />{guide.minutes} dk okuma</span></div>
        <h3>{guide.title}</h3>
        <p>{guide.description}</p>
        <span className={styles.readLink}>Rehberi oku <ArrowRight aria-hidden /></span>
      </div>
    </Link>
  );
}

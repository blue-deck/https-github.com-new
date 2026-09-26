import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Clock3, Compass } from "lucide-react";
import { ArticleTools, GuideChecklist, ReadingProgress } from "./ArticleTools";
import { GuideCard } from "./GuideCard";
import type { Guide } from "./guide-data";
import { guideBase, guideSummaries } from "./guide-index";
import styles from "./guides.module.css";

export function GuideArticle({ guide }: { guide: Guide }) {
  return (
    <main id="main-content" className={`${styles.scope} ${styles.articlePage}`}>
      <ReadingProgress />
      <div className={styles.container}>
        <nav aria-label="Sayfa yolu" className={styles.breadcrumb}><Link href="/">Ana sayfa</Link><span>/</span><Link href={guideBase}>Rehberler</Link><span>/</span><span aria-current="page">{guide.category}</span></nav>
        <header className={styles.articleHeading}><div className={styles.meta}><span>{guide.category}</span><span><Clock3 aria-hidden />{guide.minutes} dk okuma</span></div><h1>{guide.title}</h1><p className={styles.articleDek}>{guide.description}</p><div className={styles.articleByline}><span className={styles.authorMark}>B<span>•</span></span><div><strong>BlueDeck Journal</strong><span><time dateTime={guide.publishedAt}>{guide.date}</time></span></div><ArticleTools slug={guide.slug} /></div></header>
        <figure className={styles.articleHero}><div><Image src={guide.image} alt={guide.imageAlt} fill preload sizes="(max-width: 1280px) 100vw, 1280px" /></div><figcaption>BLUEDECK JOURNAL <span>Yat kariyeri ve teknedeki yaşam üzerine.</span></figcaption></figure>
        <div className={styles.readingLayout}>
          <aside className={styles.articleSidebar}><div className={styles.stickyContents}><p className={styles.eyebrow}>BU REHBERDE</p><nav aria-label="Yazı içindekiler">{guide.sections.map((section, index) => <a key={section.id} href={`#${section.id}`}><span>{String(index + 1).padStart(2, "0")}</span>{section.title}</a>)}<a href="#kontrol-listesi"><span>✓</span>Kontrol listesi</a></nav><div className={styles.sidebarNote}><Compass aria-hidden /><p>İyi bir başlangıç,<br /><strong>küçük ve doğru adımlarla.</strong></p></div><Link href={guideBase} className={styles.backLink}><ArrowLeft aria-hidden /> Tüm rehberlere dön</Link></div></aside>
          <article id="guide-content" className={styles.articleBody}><div className={styles.takeaway}><p className={styles.eyebrow}>BİR BAKIŞTA</p><p>{guide.takeaway}</p></div>{guide.sections.map((section, index) => <section className={styles.proseSection} id={section.id} key={section.id}><div className={styles.chapterLabel}>BÖLÜM {String(index + 1).padStart(2, "0")}</div><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</section>)}<GuideChecklist items={guide.checklist} slug={guide.slug} /><div className={styles.articleCta}><Compass aria-hidden /><p className={styles.eyebrow}>BİR SONRAKİ ADIM</p><h2>{guide.ctaTitle}</h2><p>{guide.ctaDescription}</p><Link href={guide.ctaHref} className={styles.primaryButton}>{guide.ctaLabel}<ArrowUpRight aria-hidden /></Link></div><div className={styles.authorFooter}><span className={styles.authorMark}>B<span>•</span></span><div><strong>BlueDeck Journal</strong><p>Yat kariyerinde daha bilinçli adımlar atman için pratik bilgi ve rehberler.</p></div></div></article>
        </div>
        <section className={styles.related} aria-labelledby="related-heading"><div className={styles.relatedHead}><div><p className={styles.eyebrow}>OKUMAYA DEVAM ET</p><h2 id="related-heading">Bir sonraki rehberin.</h2></div><Link href={guideBase} className={styles.readLink}>Tüm rehberler <ArrowRight aria-hidden /></Link></div><div className={styles.relatedGrid}>{guideSummaries.filter((item) => item.slug !== guide.slug).map((item) => <GuideCard key={item.slug} guide={item} />)}</div></section>
      </div>
    </main>
  );
}

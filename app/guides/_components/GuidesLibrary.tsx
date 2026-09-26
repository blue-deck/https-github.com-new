"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { GuideCard } from "./GuideCard";
import { guideSummaries as guides } from "./guide-index";
import styles from "./guides.module.css";

const categories = ["Tümü", "Kariyer", "CV & Profil", "Teknede yaşam"];

export function GuidesLibrary() {
  const [category, setCategory] = useState("Tümü");
  const [query, setQuery] = useState("");
  const filtered = guides.filter((guide) => (category === "Tümü" || category === guide.category) && `${guide.title} ${guide.description} ${guide.category}`.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr")));

  return (
    <main id="main-content" className={`${styles.scope} ${styles.library}`}>
      <div className={styles.container}>
        <nav aria-label="Sayfa yolu" className={styles.breadcrumb}><Link href="/">Ana sayfa</Link><span>/</span><span aria-current="page">Rehberler</span></nav>
        <div className={styles.libraryIntro}><p className={styles.eyebrow}><span /> BLUEDECK JOURNAL</p><h1>Denizdeki kariyerin için<br /><span>biraz daha ileriye bak.</span></h1><p>İyi bir başlangıç, doğru hazırlıkla gelir. Deneyimini anlatmak,<br className={styles.desktopBreak} /> fırsatları değerlendirmek ve teknedeki hayata uyum sağlamak için rehberler.</p></div>
        <div className={styles.filterBar}><div className={styles.filters} role="group" aria-label="Rehber kategorileri">{categories.map((item) => <button key={item} type="button" aria-pressed={item === category} onClick={() => setCategory(item)}>{item}</button>)}</div><div className={styles.searchField}><Search aria-hidden /><input type="search" aria-label="Rehberlerde ara" placeholder="Rehberlerde ara" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" onClick={() => setQuery("")} aria-label="Aramayı temizle"><X aria-hidden /></button>}</div></div>
        <div className={styles.resultsLabel} aria-live="polite"><span>{category === "Tümü" ? "TÜM REHBERLER" : category.toLocaleUpperCase("tr")}</span><span>{filtered.length} rehber</span></div>
        {filtered.length ? <div className={styles.libraryGrid}>{filtered.map((guide) => <GuideCard key={guide.slug} guide={guide} />)}</div> : <div className={styles.emptyState}><Search aria-hidden /><h2>Bu aramayla eşleşen rehber bulunamadı.</h2><p>Başka bir kelime deneyebilir veya tüm rehberlere dönebilirsin.</p><button type="button" className={styles.outlineButton} onClick={() => { setQuery(""); setCategory("Tümü"); }}>Tüm rehberleri göster <ArrowRight aria-hidden /></button></div>}
        <div className={styles.libraryCta}><div><p className={styles.eyebrow}>BİLGİDEN BİR SONRAKİ ADIMA</p><h2>Hazır olduğunda,<br />yeni fırsatlar seni bekliyor.</h2></div><Link className={styles.primaryButton} href="/jobs">Açık ilanları keşfet <ArrowRight aria-hidden /></Link></div>
      </div>
    </main>
  );
}

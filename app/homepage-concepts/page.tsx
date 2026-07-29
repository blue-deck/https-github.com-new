import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, CircleUserRound, Ship } from "lucide-react";
import { BlueDeckLogoLink } from "../components/BlueDeckLogo";
import { homepageConcepts } from "./concepts";
import styles from "./homepage-concepts.module.css";

export const metadata: Metadata = {
  title: "18 Homepage Layouts",
  description: "18 original BlueDeck homepage layout directions for yacht jobs, crew profiles and yacht management.",
};

const featured = new Set(["harbor-command", "deck-plan", "bridge-console", "dual-helm"]);

export default function HomepageConceptsPage() {
  return (
    <main className={styles.galleryPage}>
      <header className={styles.galleryHeader}>
        <BlueDeckLogoLink href="/" className={styles.galleryBrand} imageClassName={styles.siteBrandImage} />
        <div>
          <span>Homepage design study</span>
          <strong>18 directions · one BlueDeck</strong>
        </div>
        <Link href="/">Mevcut ana sayfaya dön <ArrowRight aria-hidden="true" /></Link>
      </header>

      <section className={styles.galleryHero}>
        <div className={styles.galleryHeroCopy}>
          <p><span /> BlueDeck’e özgü ana sayfa sistemi</p>
          <h1>18 ayrı ana sayfa.<br /><em>Tek, net ürün hikâyesi.</em></h1>
          <p className={styles.galleryIntro}>
            Her konsept ilk ekranda BlueDeck’in üç temel değerini birlikte anlatır:
            aktif yacht jobs, profesyonel crew profili ve özel Yacht-OS yönetimi.
            Logo dosyası ve oranı bütün örneklerde birebir korunmuştur.
          </p>
        </div>
        <div className={styles.galleryPromise}>
          <p>Tüm örneklerde sabit kalan net mesaj</p>
          <h2>Yat işlerini bul. Crew profilini oluştur. Yatını tek merkezden yönet.</h2>
          <div>
            <span><BriefcaseBusiness aria-hidden="true" /> Jobs & recruitment</span>
            <span><CircleUserRound aria-hidden="true" /> Crew identity</span>
            <span><Ship aria-hidden="true" /> Yacht-OS</span>
          </div>
        </div>
      </section>

      <section className={styles.galleryGuide}>
        <div>
          <span>Nasıl incelemeli?</span>
          <p>Karta tıklayın; her tasarım ayrı URL’de, tam uzunlukta ve responsive olarak açılır.</p>
        </div>
        <div>
          <BadgeCheck aria-hidden="true" />
          <p><strong>Demo veri notu</strong>Sayaç ve ilan rakamları yalnızca layout yerleşimini göstermek için işaretli demo içeriktir.</p>
        </div>
      </section>

      <section className={styles.galleryGrid} aria-label="18 BlueDeck homepage concepts">
        {homepageConcepts.map((concept) => (
          <Link key={concept.id} href={`/homepage-concepts/${concept.id}`} className={styles.conceptCard}>
            <ConceptMiniPreview conceptId={concept.id} />
            <div className={styles.conceptCardBody}>
              <div className={styles.conceptCardMeta}>
                <span>{concept.number}</span>
                <span>{concept.descriptor}</span>
                {featured.has(concept.id) ? <strong>Öne çıkan</strong> : null}
              </div>
              <h2>{concept.name}</h2>
              <p>{concept.summary}</p>
              <div className={styles.conceptCardFoot}>
                <span>{concept.layoutNote}</span>
                <b>Layout’u aç <ArrowRight aria-hidden="true" /></b>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <footer className={styles.galleryFooter}>
        <div><span>18</span><p>özgün ana sayfa<br />layout yönü</p></div>
        <p>Deep Blue #071631 · Existing BlueDeck logo · Crew + Jobs + Yacht-OS</p>
        <Link href="/homepage-concepts/harbor-command">01’den incelemeye başla <ArrowRight aria-hidden="true" /></Link>
      </footer>
    </main>
  );
}

function ConceptMiniPreview({ conceptId }: { conceptId: string }) {
  return (
    <div className={styles.miniPreview} data-concept={conceptId} aria-hidden="true">
      <div className={styles.miniHeader}><span /><span /><span /></div>
      <span className={styles.miniShapeOne} />
      <span className={styles.miniShapeTwo} />
      <span className={styles.miniShapeThree} />
      <span className={styles.miniShapeFour} />
      <span className={styles.miniShapeFive} />
      <div className={styles.miniStats}><i /><i /><i /><i /></div>
    </div>
  );
}

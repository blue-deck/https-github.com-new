import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { guideBase } from "./guide-index";
import { GuidesCarousel } from "./GuidesCarousel";
import styles from "./guides.module.css";

export function GuidesHomeSection() {
  return (
    <section
      id="rehberler"
      lang="tr"
      data-i18n-ignore
      className={`${styles.scope} ${styles.homeSection}`}
      aria-labelledby="guides-heading"
    >
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.eyebrow}><span /> BLUEDECK JOURNAL</p>
            <h2 id="guides-heading">Bir sonraki adımın,<br /><span>doğru bilgiyle başlar.</span></h2>
          </div>
          <div className={styles.sectionHeadAside}>
            <p>İlk başvurudan teknedeki ilk güne.<br />Yat kariyerine eşlik eden pratik rehberler.</p>
            <Link className={styles.outlineButton} href={guideBase}>
              Tüm rehberleri keşfet <ArrowUpRight aria-hidden />
            </Link>
          </div>
        </div>
        <GuidesCarousel />
        <div className={styles.sectionFoot}>
          <span>CREW İÇİN HAZIRLANDI. DENİZDEKİ HAYAT İÇİN.</span>
          <span>Kariyer <i /> CV & Profil <i /> Teknede yaşam</span>
        </div>
      </div>
    </section>
  );
}

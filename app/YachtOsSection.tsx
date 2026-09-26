import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Layers3 } from "lucide-react";
import styles from "./yachtOsSection.module.css";

const copy = {
  en: {
    title: ["Manage your", "own yacht"],
    description: "Crews, contracts, documents and daily operations in one place.",
    action: "Explore Yacht-OS",
    preview: "Yacht-OS checklist preview with before and after task photos",
    module: "Checklist System",
    tabs: ["Checklist Builder", "Sent Status", "Archive"],
    checklist: "Exterior Morning Washdown",
    metadata: ["Deck", "Exterior", "Daily"],
    tasks: [
      "Teak rinsed and squeegeed",
      "Stainless wiped and checked",
      "Glass and rails cleaned",
    ],
    completed: "Completed",
    pending: "Pending",
    proof: "Before / After proof",
    before: "Before",
    after: "After",
    beforeAlt: "Dry, lightly weathered teak deck before cleaning",
    afterAlt: "The same teak deck after rinsing and drying",
  },
  tr: {
    title: ["Kendi yatınızı", "yönetin"],
    description: "Mürettebat, kontratlar, belgeler ve günlük operasyonlar tek yerde.",
    action: "Yacht-OS’u keşfet",
    preview: "Öncesi ve sonrası görev fotoğraflarıyla Yacht-OS kontrol listesi önizlemesi",
    module: "Kontrol Listeleri",
    tabs: ["Liste oluştur", "Gönderim durumu", "Arşiv"],
    checklist: "Sabah Dış Güverte Yıkaması",
    metadata: ["Güverte", "Dış alan", "Günlük"],
    tasks: [
      "Tik güverte durulandı ve suyu çekildi",
      "Paslanmaz yüzeyler silindi ve kontrol edildi",
      "Camlar ve korkuluklar temizlendi",
    ],
    completed: "Tamamlandı",
    pending: "Bekliyor",
    proof: "Öncesi / Sonrası fotoğrafları",
    before: "Öncesi",
    after: "Sonrası",
    beforeAlt: "Temizlik öncesindeki kuru ve hafif kirlenmiş tik güverte",
    afterAlt: "Durulandıktan ve kurulandıktan sonra aynı tik güverte",
  },
} as const;

export function YachtOsSection({ language }: { language: "en" | "tr" }) {
  const c = copy[language];

  return (
    <section id="yacht-os" className={styles.section} aria-labelledby="platform-heading">
      <Image
        src="/media/yacht-os-deck-v1.webp"
        alt=""
        fill
        unoptimized
        className={styles.background}
      />
      <div className={styles.shade} aria-hidden />

      <div className={styles.layout}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>BlueDeck Yacht-OS</p>
          <h2 id="platform-heading" className={styles.title}>
            <span>{c.title[0]}</span>{" "}<span>{c.title[1]}</span>
          </h2>
          <p className={styles.description}>{c.description}</p>
          <Link href="/yacht-os" className={styles.action}>
            {c.action}<ArrowRight aria-hidden />
          </Link>
        </div>

        <figure className={styles.preview} aria-labelledby="yacht-os-preview-caption">
          <figcaption id="yacht-os-preview-caption" className="sr-only">{c.preview}</figcaption>
          <div className={styles.brand}>
            <Layers3 aria-hidden />
            <span>BlueDeck <span className={styles.brandDivider}>/</span> Yacht-OS</span>
          </div>
          <div className={styles.previewBody}>
            <h3 className={styles.moduleTitle}>{c.module}</h3>
            {/* The figure illustrates the private app; these labels are not navigation controls. */}
            <div className={styles.tabs} aria-hidden="true">
              {c.tabs.map((tab, index) => (
                <span key={tab} className={index === 1 ? styles.activeTab : undefined}>{tab}</span>
              ))}
            </div>
            <div className={styles.checklistHeading}>
              <h4>{c.checklist}</h4>
              <p>{c.metadata.map((item, index) => (
                <span key={item}>{index > 0 && <span className={styles.dot} aria-hidden>·</span>}{item}</span>
              ))}</p>
            </div>
            <ul className={styles.tasks}>
              {c.tasks.map((task, index) => (
                <li key={task}>
                  <span className={`${styles.checkBox} ${index < 2 ? styles.checked : ""}`} aria-hidden>
                    {index < 2 && <Check />}
                  </span>
                  <span><span className="sr-only">{index < 2 ? c.completed : c.pending}: </span>{task}</span>
                </li>
              ))}
            </ul>
            <div className={styles.proof}>
              <p>{c.proof}</p>
              <div className={styles.proofGrid}>
                {[
                  { src: "/media/yacht-os-proof-before-v2.webp", alt: c.beforeAlt, label: c.before },
                  { src: "/media/yacht-os-proof-after-v1.webp", alt: c.afterAlt, label: c.after },
                ].map((photo) => (
                  <div key={photo.src} className={styles.proofPhoto}>
                    <Image src={photo.src} alt={photo.alt} fill quality={90} sizes="(max-width: 600px) 42vw, (max-width: 900px) 230px, 260px" />
                    <span>{photo.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
}

"use client";

import Image from "next/image";
import { Expand, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import styles from "./product-screen.module.css";

export type ScreenKey =
  | "fleet"
  | "overview"
  | "crew"
  | "contracts"
  | "checklists"
  | "imo"
  | "documents"
  | "alerts";

type ProductScreenProps = {
  screen: ScreenKey;
  language: "en" | "tr";
  priority?: boolean;
  compact?: boolean;
};

const copy = {
  tr: {
    workspace: "Kaptan Çalışma Alanı",
    screens: {
      fleet: "Eklenen yatlar",
      overview: "Yat operasyon özeti",
      crew: "Mürettebat ve davetler",
      contracts: "Kontrat yönetimi",
      checklists: "Özel kontrol listeleri",
      imo: "IMO mürettebat listesi",
      documents: "Yat belgeleri",
      alerts: "Belge süre takibi",
    },
    provenance: "Uygulamanın gerçek arayüzü · Örnek kayıtlar",
    enlarge: "Ekranı büyüt",
    close: "Büyütülmüş ekranı kapat",
    screenshot: "uygulama ekranı, örnek kayıtlarla",
  },
  en: {
    workspace: "Captain Workspace",
    screens: {
      fleet: "Added yachts",
      overview: "Yacht operations overview",
      crew: "Crew and invitations",
      contracts: "Contract management",
      checklists: "Custom checklists",
      imo: "IMO crew list",
      documents: "Yacht documents",
      alerts: "Document expiry tracking",
    },
    provenance: "Actual application interface · Sample records",
    enlarge: "Enlarge screenshot",
    close: "Close enlarged screenshot",
    screenshot: "application screenshot with sample records",
  },
} as const;

export default function ProductScreen({
  screen,
  language,
  priority = false,
  compact = false,
}: ProductScreenProps) {
  const c = copy[language];
  const heading = `${c.workspace} / ${c.screens[screen]}`;
  const screenshotName = screen === "overview" ? "yacht-dashboard" : screen;
  const src = `/media/yacht-os-screens-v4/${screenshotName}-${language}.jpg`;
  const alt = `${c.screens[screen]} — ${c.screenshot}`;
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const [enlarged, setEnlarged] = useState(false);

  function openScreenshot() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    setEnlarged(true);
    dialog.showModal();
  }

  function restoreFocus() {
    setEnlarged(false);
    openerRef.current?.focus({ preventScroll: true });
  }

  return (
    <figure className={`${styles.frame} ${compact ? styles.compact : ""}`}>
      <figcaption className={styles.caption}>
        <span className={styles.captionDot} aria-hidden="true" />
        <span>{heading}</span>
      </figcaption>

      <button
        ref={openerRef}
        type="button"
        className={styles.imageButton}
        onClick={openScreenshot}
        aria-label={`${c.enlarge}: ${c.screens[screen]}`}
        aria-haspopup="dialog"
      >
        <Image
          src={src}
          unoptimized
          alt={alt}
          width={1280}
          height={720}
          priority={priority}
          loading={priority ? undefined : compact ? "eager" : "lazy"}
          sizes={compact ? "(max-width: 700px) 92vw, 48vw" : "(max-width: 900px) 94vw, 68vw"}
          className={styles.screenshot}
        />
        <span className={styles.enlargeLabel} aria-hidden="true">
          <Expand />
          {c.enlarge}
        </span>
      </button>

      <p className={styles.provenance}>{c.provenance}</p>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onClose={restoreFocus}
      >
        <div className={styles.dialogHeader}>
          <div>
            <h2 id={`${id}-title`}>{heading}</h2>
            <p id={`${id}-description`}>{c.provenance}</p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => dialogRef.current?.close()}
            aria-label={c.close}
            autoFocus
          >
            <X />
          </button>
        </div>
        <div className={styles.dialogImage} tabIndex={0} aria-label={c.screens[screen]}>
          {enlarged && (
            <Image
              src={src}
              unoptimized
              alt={alt}
              width={1280}
              height={720}
              sizes="(max-width: 640px) 860px, 96vw"
              className={styles.fullScreenshot}
            />
          )}
        </div>
      </dialog>
    </figure>
  );
}

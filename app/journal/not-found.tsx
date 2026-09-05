"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "../components/LanguageProvider";
import { PublicFooter, PublicHeader } from "../components/PublicSiteChrome";
import styles from "./journal.module.css";

export default function JournalNotFound() {
  const { language } = useLanguage();
  const isTurkish = language === "tr";

  return (
    <div className={`bd-site-shell ${styles.shell}`}>
      <PublicHeader />
      <main id="main-content" className={styles.main} data-i18n-ignore>
        <div className={styles.notFound}>
          <p className={styles.eyebrow}>BlueDeck Journal</p>
          <h1>{isTurkish ? "Bu rehber bulunamadı." : "This guide could not be found."}</h1>
          <p>{isTurkish ? "Diğer mürettebat rehberlerini keşfetmek için Journal sayfasına dönebilirsiniz." : "Visit the Journal to explore our other crew guides."}</p>
          <Link className={styles.primaryLink} href="/journal">
            <ArrowLeft size={17} aria-hidden />{isTurkish ? "Rehberlere dön" : "Back to the Journal"}
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

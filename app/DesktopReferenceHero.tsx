"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import styles from "./desktopReferenceHero.module.css";

// Coordinates are measured in the approved 1586 × 992 artwork. Keeping the
// original artwork avoids changing its yacht, typography, or metallic wave.
function area(x: number, y: number, width: number, height: number, canvasHeight: number): CSSProperties {
  return {
    left: `${(x / 1586) * 100}%`,
    top: `${(y / canvasHeight) * 100}%`,
    width: `${(width / 1586) * 100}%`,
    height: `${(height / canvasHeight) * 100}%`,
  };
}

export function DesktopReferenceHero() {
  return (
    <section className={styles.hero} aria-labelledby="desktop-home-heading" lang="en" data-i18n-ignore>
      <div className={styles.description}>
        <p>Yacht careers · crew · operations</p>
        <h1 id="desktop-home-heading">Your career. Your crew. Your BlueDeck.</h1>
        <p>Find your next role. Build your team. Keep life onboard connected.</p>
      </div>
      <Link href="/jobs" className={styles.link} style={area(71, 507, 284, 61, 880)}>
        <span className={styles.label}>Explore yacht jobs</span>
      </Link>
      <Link href="/find-crew" className={styles.link} style={area(373, 507, 180, 61, 880)}>
        <span className={styles.label}>Find crew</span>
      </Link>
      <Link href="/yacht-os" className={styles.link} style={area(71, 595, 173, 44, 880)}>
        <span className={styles.label}>Explore Yacht-OS</span>
      </Link>

    </section>
  );
}

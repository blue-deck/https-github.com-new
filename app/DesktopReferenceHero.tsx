"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { endWebBrowserSession } from "./lib/webBrowserSession";
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

export function DesktopReferenceHeader() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function watchSession() {
      const { supabase } = await import("./lib/supabase");
      if (!active) return;
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) setSignedIn(Boolean(session?.user));
      });
      unsubscribe = () => subscription.unsubscribe();
      const { data: { session } } = await supabase.auth.getSession();
      if (active) setSignedIn(Boolean(session?.user));
    }

    void watchSession();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  async function logout() {
    const ended = await endWebBrowserSession("manual");
    if (ended) window.location.replace("/login");
    else window.location.reload();
  }

  return (
    <header className={styles.header} lang="en" data-i18n-ignore>
      <a className="bd-skip-link" href="#main-content">Skip to content</a>
      <Link href="/" className={styles.link} style={area(58, 24, 342, 61, 112)}>
        <span className={styles.label}>BlueDeck home</span>
      </Link>
      <nav aria-label="Primary navigation">
        <Link href="/jobs" className={styles.link} style={area(493, 39, 102, 44, 112)}>
          <span className={styles.label}>Find a job</span>
        </Link>
        <Link href="/find-crew" className={styles.link} style={area(621, 39, 101, 44, 112)}>
          <span className={styles.label}>Find crew</span>
        </Link>
        <Link href="/yacht-os" className={styles.link} style={area(748, 39, 98, 44, 112)}>
          <span className={styles.label}>Yacht-OS</span>
        </Link>
        <Link href="/about" className={styles.link} style={area(873, 39, 74, 44, 112)}>
          <span className={styles.label}>About</span>
        </Link>
      </nav>
      {signedIn ? (
        <div className={styles.account} style={area(1210, 23, 318, 74, 112)}>
          <Link href="/dashboard">Dashboard</Link>
          <button type="button" onClick={() => void logout()}>Log out</button>
        </div>
      ) : (
        <nav aria-label="Account">
          <Link href="/login" className={styles.link} style={area(1222, 39, 70, 44, 112)}>
            <span className={styles.label}>Log in</span>
          </Link>
          <Link href="/login?mode=signup" className={styles.link} style={area(1324, 37, 191, 48, 112)}>
            <span className={styles.label}>Create account</span>
          </Link>
        </nav>
      )}
    </header>
  );
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

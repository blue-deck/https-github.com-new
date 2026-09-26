"use client";

import { useEffect, useState } from "react";
import { Check, ClipboardList } from "lucide-react";
import type { GuideLanguage } from "./guide-index";
import { getBlogCopy } from "./blog-copy";
import styles from "./guides.module.css";

export function GuideChecklist({ items, slug, language }: { items: string[]; slug: string; language: GuideLanguage }) {
  // Each translation uses the same item order, so completed steps survive a language change.
  const [checked, setChecked] = useState<number[]>([]);
  const copy = getBlogCopy(language);
  return (
    <section className={styles.checklist} id="checklist" aria-labelledby="checklist-heading">
      <span id="kontrol-listesi" aria-hidden style={{ display: "block", scrollMarginTop: "inherit" }} />
      <div className={styles.checklistHead}>
        <span className={styles.checkIcon}><ClipboardList aria-hidden /></span>
        <div><p className={styles.eyebrow}>{copy.checklistEyebrow}</p><h2 id="checklist-heading">{copy.checklistTitle}</h2></div>
        <span className={styles.checkCount} aria-live="polite">{checked.length}/{items.length}</span>
      </div>
      <p>{copy.checklistDescription}</p>
      <div className={styles.checkItems}>
        {items.map((item, index) => (
          <label key={`${slug}-${index}`} htmlFor={`${slug}-check-${index}`}>
            <input
              id={`${slug}-check-${index}`}
              type="checkbox"
              checked={checked.includes(index)}
              onChange={(event) => {
                const isChecked = event.target.checked;
                setChecked((current) => isChecked ? [...current, index] : current.filter((entry) => entry !== index));
              }}
            />
            <span>{item}</span>
          </label>
        ))}
      </div>
      {checked.length === items.length && <p className={styles.checkDone} role="status"><Check aria-hidden /> {copy.checklistDone}</p>}
    </section>
  );
}

export function ReadingProgress({ language }: { language: GuideLanguage }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    function update() {
      const article = document.getElementById("guide-content");
      if (!article) return;
      const rect = article.getBoundingClientRect();
      const distance = Math.max(1, article.offsetHeight - window.innerHeight + 160);
      setProgress(Math.min(100, Math.max(0, ((160 - rect.top) / distance) * 100)));
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [language]);
  return <div className={styles.progressTrack} aria-hidden><div style={{ transform: `scaleX(${progress / 100})` }} /></div>;
}

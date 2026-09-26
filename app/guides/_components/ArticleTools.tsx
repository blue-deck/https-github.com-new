"use client";

import { useEffect, useState } from "react";
import { Bookmark, Check, Copy, Link2 } from "lucide-react";
import styles from "./guides.module.css";

export function ArticleTools({ slug }: { slug: string }) {
  const [saved, setSaved] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try { setSaved(localStorage.getItem(`bluedeck.guide.${slug}`) === "saved"); } catch { /* Reading remains available when storage is blocked. */ }
  }, [slug]);

  function toggleSaved() {
    try { const next = !saved; localStorage.setItem(`bluedeck.guide.${slug}`, next ? "saved" : ""); setSaved(next); setStorageError(false); } catch { setStorageError(true); }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setCopyState("done"); } catch { setCopyState("error"); }
  }

  return <div className={styles.toolsWrap}><div className={styles.articleTools}><button type="button" onClick={toggleSaved} aria-pressed={saved}>{saved ? <Check aria-hidden /> : <Bookmark aria-hidden />}{saved ? "Kaydedildi" : "Kaydet"}</button><button type="button" onClick={copyLink}>{copyState === "done" ? <Check aria-hidden /> : <Link2 aria-hidden />}{copyState === "done" ? "Kopyalandı" : "Bağlantıyı kopyala"}</button></div><p className={styles.toolStatus} aria-live="polite">{storageError ? "Bu tarayıcıda kaydetme kullanılamıyor." : copyState === "error" ? "Bağlantıyı tarayıcının adres çubuğundan kopyalayabilirsin." : saved ? "Bu cihazdaki okuma listene eklendi." : copyState === "done" ? "Rehber bağlantısı kopyalandı." : ""}</p></div>;
}

export function GuideChecklist({ items, slug }: { items: string[]; slug: string }) {
  const [checked, setChecked] = useState<string[]>([]);
  return <section className={styles.checklist} id="kontrol-listesi" aria-labelledby="checklist-heading"><div className={styles.checklistHead}><span className={styles.checkIcon}><Copy aria-hidden /></span><div><p className={styles.eyebrow}>SIRA SENDE</p><h2 id="checklist-heading">Kısa kontrol listesi</h2></div><span className={styles.checkCount} aria-live="polite">{checked.length}/{items.length}</span></div><p>Hazır olanları işaretle, bir sonraki adımını netleştir.</p><div className={styles.checkItems}>{items.map((item, index) => <label key={item} htmlFor={`${slug}-check-${index}`}><input id={`${slug}-check-${index}`} type="checkbox" checked={checked.includes(item)} onChange={(event) => setChecked((current) => event.target.checked ? [...current, item] : current.filter((entry) => entry !== item))} /><span>{item}</span></label>)}</div>{checked.length === items.length && <p className={styles.checkDone} role="status"><Check aria-hidden /> Hazırlık tamam. Bir sonraki adıma geçebilirsin.</p>}</section>;
}

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    function update() { const article = document.getElementById("guide-content"); if (!article) return; const rect = article.getBoundingClientRect(); const distance = Math.max(1, article.offsetHeight - window.innerHeight + 160); setProgress(Math.min(100, Math.max(0, ((160 - rect.top) / distance) * 100))); }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); }
    update(); window.addEventListener("scroll", schedule, { passive: true }); window.addEventListener("resize", schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, []);
  return <div className={styles.progressTrack} aria-hidden><div style={{ transform: `scaleX(${progress / 100})` }} /></div>;
}

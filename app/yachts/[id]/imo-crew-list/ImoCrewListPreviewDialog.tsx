"use client";

import { useId, useLayoutEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { Download, X } from "lucide-react";
import styles from "./ImoCrewListPreviewDialog.module.css";

const Preview = dynamic(() => import("./ImoCrewListPreview"), {
  ssr: false,
  loading: () => <div className={styles.loading} role="status">Loading PDF…</div>,
});

export default function ImoCrewListPreviewDialog({ blob, url, filename, language, onClose, onDownload, returnFocusRef }: {
  blob: Blob; url: string; filename: string; language: string; onClose: () => void; onDownload: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const tr = language === "tr";
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = returnFocusRef?.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const body = document.body;
    const root = document.documentElement;
    const x = window.scrollX;
    const y = window.scrollY;
    const scrollbar = Math.max(0, window.innerWidth - root.clientWidth);
    const originalPadding = parseFloat(getComputedStyle(body).paddingRight) || 0;
    // Preserve just the properties we own, including their existing priorities.
    const overrides: Array<[HTMLElement, Record<string, string>]> = [
      [body, { position: "fixed", top: `${-y}px`, left: `${-x}px`, width: "100%", overflow: "hidden", "padding-right": `${originalPadding + scrollbar}px` }],
      [root, { overflow: "hidden", "scroll-behavior": "auto" }],
    ];
    const restore = overrides.map(([element, properties]) => {
      const previous = Object.keys(properties).map((key) => [key, element.style.getPropertyValue(key), element.style.getPropertyPriority(key)]);
      Object.entries(properties).forEach(([key, value]) => element.style.setProperty(key, value));
      return () => previous.forEach(([key, value, priority]) => value ? element.style.setProperty(key, value, priority) : element.style.removeProperty(key));
    });

    // Follow the visible viewport when browser chrome or the keyboard changes.
    const viewport = window.visualViewport;
    const fitViewport = () => {
      dialog.style.setProperty("--preview-width", `${viewport?.width ?? window.innerWidth}px`);
      dialog.style.setProperty("--preview-height", `${viewport?.height ?? window.innerHeight}px`);
      dialog.style.setProperty("--preview-left", `${viewport?.offsetLeft ?? 0}px`);
      dialog.style.setProperty("--preview-top", `${viewport?.offsetTop ?? 0}px`);
    };
    fitViewport();
    dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    viewport?.addEventListener("resize", fitViewport);
    viewport?.addEventListener("scroll", fitViewport);
    window.addEventListener("resize", fitViewport);

    return () => {
      viewport?.removeEventListener("resize", fitViewport);
      viewport?.removeEventListener("scroll", fitViewport);
      window.removeEventListener("resize", fitViewport);
      dialog.close();
      restore[0]();
      window.scrollTo({ left: x, top: y, behavior: "instant" });
      restore[1]();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [returnFocusRef]);

  if (typeof document === "undefined") return null;
  // Keep the viewer outside the document's scaled content and workspace styles.
  return createPortal(<dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className={styles.panel}>
      <header className={styles.header}>
        <h2 id={titleId}>{tr ? "Belge önizlemesi" : "Document preview"}</h2>
        <a className={styles.download} href={url} download={filename} onClick={onDownload}><Download size={17} /><span>{tr ? "PDF indir" : "Download PDF"}</span></a>
        <button ref={closeRef} type="button" className={styles.close} aria-label={tr ? "Önizlemeyi kapat" : "Close preview"} onClick={onClose}><X size={22} /></button>
      </header>
      <Preview blob={blob} language={language} />
    </div>
  </dialog>, document.body);
}

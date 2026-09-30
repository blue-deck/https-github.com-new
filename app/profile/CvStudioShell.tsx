"use client";

import { ArrowRight, ChevronDown, ChevronLeft } from "lucide-react";
import { useRef, type ReactNode } from "react";
import styles from "./cvStudio.module.css";

export type CvStudioTab = "personal" | "experience" | "otherWork" | "skills" | "documents" | "languages" | "preview";

type StudioSection = {
  id: CvStudioTab;
  label: string;
  description: string;
  icon: ReactNode;
};

export function CvStudioShell({
  sections,
  activeSection,
  onSectionChange,
  completion,
  hasUnsavedProfile,
  children,
}: {
  sections: StudioSection[];
  activeSection: CvStudioTab;
  onSectionChange: (section: CvStudioTab) => void;
  completion: number;
  hasUnsavedProfile: boolean;
  children: ReactNode;
}) {
  const studioRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const activeIndex = sections.findIndex((section) => section.id === activeSection);
  const current = sections[activeIndex] || sections[0];
  const next = sections[activeIndex + 1];
  const previous = sections[activeIndex - 1];
  const percent = Math.max(0, Math.min(100, Math.round(completion)));
  const previewActive = activeSection === "preview";

  function selectSection(section: CvStudioTab, focusContent = false) {
    onSectionChange(section);
    if (focusContent) {
      requestAnimationFrame(() => {
        const heading = headingRef.current;
        heading?.focus({ preventScroll: true });
        studioRef.current?.scrollIntoView({
          block: "start",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        });
      });
    }
  }

  return (
    <section ref={studioRef} id="cv-studio" aria-labelledby="cv-studio-title" className={styles.studio}>
      <header className={styles.toolbar}>
        <div className={styles.brand}>
          <span className={styles.wordmark} data-i18n-ignore>BlueDeck</span>
          <span className={styles.studioLabel}>CV Studio</span>
        </div>
        <span className={styles.completion} aria-label={`CV completion ${percent}%`}>
          <strong data-i18n-ignore>{percent}%</strong> <span>complete</span>
        </span>
      </header>

      <div className={styles.layout}>
        <nav className={styles.sectionList} aria-label="CV sections">
          {sections.map((section) => (
            <button
              type="button"
              key={section.id}
              className={styles.sectionButton}
              aria-current={section.id === activeSection ? "page" : undefined}
              aria-controls="cv-studio-content"
              onClick={() => selectSection(section.id, true)}
            >
              <span className={styles.sectionIcon} aria-hidden>{section.icon}</span>
              <span className={styles.sectionLabel}>{section.label}</span>
              {section.id === "personal" && hasUnsavedProfile ? (
                <span className={styles.unsavedDot} role="img" aria-label="Unsaved personal details" title="Unsaved personal details" />
              ) : null}
            </button>
          ))}
        </nav>

        <div className={styles.workspace}>
          <div className={styles.mobileNavigation}>
            <div className={styles.mobileSelector}>
              <span className={styles.sectionIcon} aria-hidden>{current.icon}</span>
              <span className={styles.mobileCurrent} aria-hidden>{current.label}</span>
              <ChevronDown size={18} aria-hidden />
              <select
                aria-label="CV section"
                aria-controls="cv-studio-content"
                value={activeSection}
                onChange={(event) => selectSection(event.target.value as CvStudioTab)}
                className={styles.mobileSelect}
              >
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>{section.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div id="cv-studio-content" className={`${styles.content} ${previewActive ? styles.previewContent : ""}`}>
            <div className={styles.contentHeading}>
              <h2 id="cv-studio-title" ref={headingRef} tabIndex={-1}>{current.label}</h2>
              <p>{current.description}</p>
            </div>
            {children}
          </div>

          <footer className={styles.footer}>
            {previewActive ? (
              <button type="button" className={styles.secondaryAction} onClick={() => selectSection(previous?.id || "personal", true)}>
                <ChevronLeft size={16} aria-hidden /> Back to editing
              </button>
            ) : next?.id === "preview" ? (
              <button type="button" className={styles.secondaryAction} onClick={() => selectSection(previous?.id || "personal", true)}>
                <ChevronLeft size={16} aria-hidden /> Previous
              </button>
            ) : null}
            {next ? (
              <button
                type="button"
                className={styles.continueAction}
                onClick={() => selectSection(next.id, true)}
                aria-label={next.id === "preview" ? "Preview CV" : `Continue to ${next.label}`}
              >
                {next.id === "preview" ? "Preview CV" : "Continue"}
                <ArrowRight size={16} aria-hidden />
              </button>
            ) : null}
          </footer>
        </div>
      </div>
    </section>
  );
}

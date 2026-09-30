"use client";

import { ArrowRight, ChevronDown, ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  hasUnsavedProfile,
  children,
}: {
  sections: StudioSection[];
  activeSection: CvStudioTab;
  onSectionChange: (section: CvStudioTab) => void;
  hasUnsavedProfile: boolean;
  children: ReactNode;
}) {
  const studioRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mobileNavigationRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const [mobileSectionsOpen, setMobileSectionsOpen] = useState(false);
  const activeIndex = sections.findIndex((section) => section.id === activeSection);
  const current = sections[activeIndex] || sections[0];
  const next = sections[activeIndex + 1];
  const previous = sections[activeIndex - 1];
  const previewActive = activeSection === "preview";

  useEffect(() => {
    if (!mobileSectionsOpen) return;

    function closeOutside(event: PointerEvent) {
      if (!mobileNavigationRef.current?.contains(event.target as Node)) {
        setMobileSectionsOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMobileSectionsOpen(false);
      mobileTriggerRef.current?.focus();
    }
    const desktop = window.matchMedia("(min-width: 1024px)");
    function closeOnDesktop() {
      if (desktop.matches) setMobileSectionsOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [mobileSectionsOpen]);

  function selectSection(section: CvStudioTab, focusContent = false) {
    setMobileSectionsOpen(false);
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
          <div
            ref={mobileNavigationRef}
            className={styles.mobileNavigation}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setMobileSectionsOpen(false);
            }}
          >
            <button
              id="cv-studio-mobile-trigger"
              ref={mobileTriggerRef}
              type="button"
              className={styles.mobileSelector}
              aria-labelledby="cv-studio-mobile-prompt cv-studio-mobile-current"
              aria-describedby="cv-studio-mobile-step"
              aria-expanded={mobileSectionsOpen}
              aria-controls="cv-studio-mobile-sections"
              onClick={() => setMobileSectionsOpen((open) => !open)}
            >
              <span className={styles.sectionIcon} aria-hidden>{current.icon}</span>
              <span className={styles.mobileSelection}>
                <span id="cv-studio-mobile-prompt" className={styles.mobilePrompt}>Sections</span>
                <span id="cv-studio-mobile-current" className={styles.mobileCurrent}>{current.label}</span>
              </span>
              <span id="cv-studio-mobile-step" className={styles.mobileStep} data-i18n-ignore>
                {activeIndex + 1} / {sections.length}
              </span>
              <ChevronDown className={styles.mobileChevron} size={18} aria-hidden />
            </button>
            <nav
              id="cv-studio-mobile-sections"
              className={styles.mobileSectionList}
              aria-label="Choose CV section"
              hidden={!mobileSectionsOpen}
            >
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={styles.mobileSectionButton}
                  aria-current={section.id === activeSection ? "page" : undefined}
                  aria-controls="cv-studio-content"
                  onClick={() => selectSection(section.id, true)}
                >
                  <span className={styles.sectionIcon} aria-hidden>{section.icon}</span>
                  <span className={styles.sectionLabel}>{section.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div id="cv-studio-content" className={`${styles.content} ${previewActive ? styles.previewContent : ""}`}>
            <h2 id="cv-studio-title" className={styles.srOnly} ref={headingRef} tabIndex={-1}>{current.label}</h2>
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

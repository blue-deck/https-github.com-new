"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import {
  JobKeywordSearchField,
  JobLocationSearchField,
  JobPositionSearchField,
} from "./components/JobSearchFields";
import {
  CrewKeywordSearchField,
  CrewNationalitySearchField,
  CrewPositionSearchField,
} from "./components/CrewSearchFields";
import { homeJobsSearchHref, homeCrewSearchHref } from "./lib/homeSearch";
import styles from "./desktopHomeSearch.module.css";

type Mode = "careers" | "crew";
const copy = {
  en: { searchJobs: "Search jobs", searchCrew: "Search crew", navigation: "Search jobs or crew" },
  tr: { searchJobs: "İlan ara", searchCrew: "Mürettebat ara", navigation: "İlan veya mürettebat ara" },
} as const;

export function DesktopHomeSearch({ language }: { language: "en" | "tr" }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("careers");
  const [careers, setCareers] = useState({ query: "", positions: [] as string[], location: "" });
  const [crew, setCrew] = useState({ query: "", positions: [] as string[], nationality: "" });
  const careersTab = useRef<HTMLButtonElement>(null);
  const crewTab = useRef<HTMLButtonElement>(null);
  const id = useId();
  const c = copy[language];

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "careers" : event.key === "End" ? "crew" : mode === "careers" ? "crew" : "careers";
    setMode(next);
    (next === "careers" ? careersTab : crewTab).current?.focus();
  }

  function searchAllFilters() {
    router.push(mode === "careers" ? homeJobsSearchHref(careers) : homeCrewSearchHref(crew));
  }

  return (
    <section className={styles.search} aria-label={c.navigation} data-i18n-ignore>
      <div className={styles.rail}>
        <div role="tablist" aria-label={c.navigation} className={styles.tabs}>
          {(["careers", "crew"] as const).map((tab) => (
            <button
              key={tab} ref={tab === "careers" ? careersTab : crewTab}
              type="button" role="tab" id={`${id}-${tab}-tab`}
              aria-selected={mode === tab} aria-controls={`${id}-panel`}
              tabIndex={mode === tab ? 0 : -1}
              className={styles.tab} onClick={() => setMode(tab)} onKeyDown={handleTabKey}
            >
              <svg viewBox="0 0 280 56" preserveAspectRatio="none" aria-hidden className={styles.tabShape}>
                <path d="M0 56C16 56 20 49 24 34L29 15C32 4 36 0 49 0H231C244 0 248 4 251 15L256 34C260 49 264 56 280 56Z" />
              </svg>
              <span>{tab === "careers" ? "Jobs" : "Crews"}</span>
            </button>
          ))}
        </div>
        <Link href="/yacht-os" className={styles.yacht}>Yacht-OS</Link>
      </div>
      <div className={styles.panelStage}>
        <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${mode}-tab`} className={styles.panel}>
          <div role="search" aria-label={mode === "careers" ? c.searchJobs : c.searchCrew} className={styles.fields}>
            {mode === "careers" ? (
              <>
                <JobKeywordSearchField
                  language={language} value={careers.query}
                  onChange={(query) => setCareers((current) => ({ ...current, query }))}
                  onKeywordSearch={() => router.push(homeJobsSearchHref({ query: careers.query, positions: [], location: "" }))}
                />
                <JobPositionSearchField
                  language={language} values={careers.positions}
                  onChange={(positions) => setCareers((current) => ({ ...current, positions }))}
                />
                <JobLocationSearchField
                  language={language} value={careers.location}
                  onChange={(location) => setCareers((current) => ({ ...current, location }))}
                />
              </>
            ) : (
              <>
                <CrewKeywordSearchField
                  language={language} value={crew.query}
                  onChange={(query) => setCrew((current) => ({ ...current, query }))}
                  onKeywordSearch={() => router.push(homeCrewSearchHref({ query: crew.query, positions: [], nationality: "" }))}
                />
                <CrewPositionSearchField
                  language={language} values={crew.positions}
                  onChange={(positions) => setCrew((current) => ({ ...current, positions }))}
                />
                <CrewNationalitySearchField
                  language={language} value={crew.nationality}
                  onChange={(nationality) => setCrew((current) => ({ ...current, nationality }))}
                />
              </>
            )}
            <button type="button" className={styles.submit} onClick={searchAllFilters}>
              <Search aria-hidden /><span>{mode === "careers" ? c.searchJobs : c.searchCrew}</span><ArrowRight aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

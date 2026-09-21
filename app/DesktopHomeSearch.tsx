"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { LocationSearchField } from "./components/LocationSearchField";
import { NationalitySearchField } from "./components/NationalitySearchField";
import { maximumCrewPositionSelections } from "./lib/crewSearch";
import { homeJobsSearchHref, homeCrewSearchHref } from "./lib/homeSearch";
import { publicJobSearchTaxonomy } from "./lib/publicJobSearchConfig";
import styles from "./desktopHomeSearch.module.css";

type Mode = "careers" | "crew";
const copy = {
  en: {
    keyword: "Keyword", position: "Position", location: "Location", nationality: "Nationality",
    jobsPlaceholder: "Job title or keyword", crewPlaceholder: "Name or keyword", allPositions: "All positions",
    anyLocation: "Any location", anyNationality: "Any nationality", searchJobs: "Search jobs", searchCrew: "Search crew",
    searchPositions: "Search positions", noPositions: "No matching positions", selected: "selected", clear: "Clear",
    searching: "Searching locations…", noLocations: "No locations found. You can use your entered location.",
    locationResults: "location options available.", navigation: "Search jobs or crew", done: "Done",
  },
  tr: {
    keyword: "Anahtar kelime", position: "Pozisyon", location: "Konum", nationality: "Milliyet",
    jobsPlaceholder: "İş unvanı veya anahtar kelime", crewPlaceholder: "İsim veya anahtar kelime", allPositions: "Tüm pozisyonlar",
    anyLocation: "Tüm konumlar", anyNationality: "Tüm milliyetler", searchJobs: "İlan ara", searchCrew: "Mürettebat ara",
    searchPositions: "Pozisyon ara", noPositions: "Eşleşen pozisyon yok", selected: "seçildi", clear: "Temizle",
    searching: "Konumlar aranıyor…", noLocations: "Konum bulunamadı. Yazdığınız konumu kullanabilirsiniz.",
    locationResults: "konum seçeneği mevcut.", navigation: "İlan veya mürettebat ara", done: "Tamam",
  },
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
  const active = mode === "careers" ? careers : crew;

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "careers" : event.key === "End" ? "crew" : mode === "careers" ? "crew" : "careers";
    setMode(next);
    (next === "careers" ? careersTab : crewTab).current?.focus();
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
              <span>{tab === "careers" ? "Careers" : "Crew"}</span>
            </button>
          ))}
        </div>
        <Link href="/yacht-os" className={styles.yacht}>Yacht-OS</Link>
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${mode}-tab`} className={styles.panel}>
        <form
          role="search" aria-label={mode === "careers" ? c.searchJobs : c.searchCrew}
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            router.push(mode === "careers" ? homeJobsSearchHref(careers) : homeCrewSearchHref(crew));
          }}
        >
          <label className={`${styles.field} ${styles.keyword}`}>
            <span className={styles.fieldLabel}>{c.keyword}</span>
            <Search aria-hidden />
            <input
              type="search" value={active.query} maxLength={120}
              placeholder={mode === "careers" ? c.jobsPlaceholder : c.crewPlaceholder}
              onChange={(event) => mode === "careers"
                ? setCareers({ ...careers, query: event.target.value })
                : setCrew({ ...crew, query: event.target.value })}
            />
          </label>
          <PositionPicker
            key={mode} c={c} values={active.positions}
            onChange={(positions) => mode === "careers" ? setCareers({ ...careers, positions }) : setCrew({ ...crew, positions })}
          />
          {mode === "careers" ? (
            <LocationSearchField
              label={c.location} value={careers.location} placeholder={c.anyLocation}
              searchingText={c.searching} noResultsText={c.noLocations} resultsText={c.locationResults}
              maxLength={120} className={`${styles.field} ${styles.location}`}
              labelClassName={styles.fieldLabel} inputClassName={styles.locationInput}
              popupClassName={styles.locationPopup} popupListClassName="max-h-72 overflow-y-auto overscroll-contain"
              onChange={(location) => setCareers({ ...careers, location })}
            />
          ) : (
            <NationalitySearchField
              dismissOnBlur
              label={c.nationality} value={crew.nationality} placeholder={c.anyNationality}
              className={`${styles.field} ${styles.nationality}`}
              labelClassName={styles.fieldLabel} controlClassName={styles.nationalityInput}
              onChange={(nationality) => setCrew({ ...crew, nationality })}
            />
          )}
          <button type="submit" className={styles.submit}>
            <Search aria-hidden /><span>{mode === "careers" ? c.searchJobs : c.searchCrew}</span><ArrowRight aria-hidden />
          </button>
        </form>
      </div>
    </section>
  );
}

function PositionPicker({ c, values, onChange }: {
  c: (typeof copy)["en" | "tr"];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const options = publicJobSearchTaxonomy.positions.filter((position) => position.toLocaleLowerCase().includes(normalizedSearch));
  const selection = values.length === 1 ? values[0] : values.length ? `${values.length} ${c.selected}` : c.allPositions;

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      const details = detailsRef.current;
      if (details?.open && !details.contains(event.target as Node)) details.open = false;
    }
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, []);

  function close() {
    if (detailsRef.current) detailsRef.current.open = false;
    summaryRef.current?.focus();
  }

  return (
    <details ref={detailsRef} className={styles.positions} onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
    }} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false;
    }} onToggle={(event) => { if (!event.currentTarget.open) setSearch(""); }}>
      <summary ref={summaryRef} aria-label={`${c.position}: ${selection}`} className={styles.field}>
        <span className={styles.fieldLabel}>{c.position}</span>
        <span className={styles.selection} title={values.join(", ") || undefined}>{selection}</span>
        <ChevronDown aria-hidden />
      </summary>
      <div className={styles.positionPopup}>
        <input type="search" aria-label={c.searchPositions} placeholder={c.searchPositions} value={search}
          onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} />
        <div className={styles.options} role="group" aria-label={c.position}>
          {options.map((position) => (
            <label key={position}>
              <input type="checkbox" checked={values.includes(position)}
                disabled={!values.includes(position) && values.length >= maximumCrewPositionSelections}
                onChange={() => onChange(values.includes(position) ? values.filter((value) => value !== position) : [...values, position])} />
              <span>{position}</span>
            </label>
          ))}
          {!options.length && <p>{c.noPositions}</p>}
        </div>
        <div className={styles.pickerActions}>
          <button type="button" disabled={!values.length} onClick={() => onChange([])}>{c.clear}</button>
          <span>{values.length} / {maximumCrewPositionSelections}</span>
          <button type="button" onClick={close}>{c.done}</button>
        </div>
      </div>
    </details>
  );
}

"use client";

import Link from "next/link";
import {
  ChevronDown,
  Clock3,
  LoaderCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CrewCandidatePassportCard } from "../components/CrewCandidatePresentation";
import { PublicFooter, PublicHeader } from "../components/PublicSiteChrome";
import { useLanguage } from "../components/LanguageProvider";
import type { DiscoverableCrewPreview } from "../lib/findCrewData";
import {
  crewMaritalStatuses,
  crewSearchFilterCount,
  crewSearchParams,
  defaultCrewSearchFilters,
  normalizeCrewSearchFilters,
  parseCrewSearchFilters,
  type CrewSearchFacets,
  type CrewSearchFilters,
} from "../lib/crewSearch";
import { translatePhrase, type Language } from "../lib/i18n";

type FindCrewClientProps = {
  profiles: DiscoverableCrewPreview[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
  initialTotal: number;
  initialFacets: CrewSearchFacets;
  initialFilters: CrewSearchFilters;
};

export function FindCrewClient({
  profiles: initialProfiles,
  initialNextCursor,
  initialHasMore,
  initialTotal,
  initialFacets,
  initialFilters,
}: FindCrewClientProps) {
  const { language } = useLanguage();
  const c = copy[language];
  const [profiles, setProfiles] = useState(initialProfiles);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [total, setTotal] = useState(initialTotal);
  const [facets, setFacets] = useState(initialFacets);
  const [filters, setFilters] = useState(() =>
    normalizeCrewSearchFilters(initialFilters),
  );
  const [advancedOpen, setAdvancedOpen] = useState(() =>
    hasAdvancedCrewFilters(initialFilters),
  );
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requestSequence = useRef(0);
  const loadMoreController = useRef<AbortController | null>(null);
  const initialFingerprint = crewSearchParams(initialFilters).toString();
  const loadedFingerprint = useRef(initialFingerprint);
  const filterFingerprint = crewSearchParams(filters).toString();
  const currentFilterFingerprint = useRef(filterFingerprint);
  const activeFilterCount = crewSearchFilterCount(filters);
  const advancedFilterCount = countAdvancedCrewFilters(filters);
  const hasFilters = activeFilterCount > 0;

  useEffect(() => {
    function restoreFilters() {
      const restored = parseCrewSearchFilters(
        new URLSearchParams(window.location.search),
      );
      setFilters(restored);
      if (hasAdvancedCrewFilters(restored)) setAdvancedOpen(true);
    }

    window.addEventListener("popstate", restoreFilters);
    return () => window.removeEventListener("popstate", restoreFilters);
  }, []);

  useEffect(
    () => () => {
      loadMoreController.current?.abort();
    },
    [],
  );

  useEffect(() => {
    currentFilterFingerprint.current = filterFingerprint;
    loadMoreController.current?.abort();
    loadMoreController.current = null;
    setLoadingMore(false);
    const nextUrl = filterFingerprint
      ? `${window.location.pathname}?${filterFingerprint}${window.location.hash}`
      : `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);

    if (
      filterFingerprint === loadedFingerprint.current &&
      refreshVersion === 0
    ) {
      return;
    }

    const requestId = ++requestSequence.current;
    const controller = new AbortController();
    setSearching(true);
    setSearchFailed(false);
    setLoadMoreFailed(false);

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/find-crew${filterFingerprint ? `?${filterFingerprint}` : ""}`,
          {
            headers: { Accept: "application/json" },
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const payload = (await response.json().catch(() => null)) as unknown;
        if (!response.ok || !isCrewPageResponse(payload)) {
          throw new Error("crew_search_failed");
        }
        if (requestId !== requestSequence.current) return;

        setProfiles(payload.profiles);
        setNextCursor(payload.nextCursor);
        setHasMore(payload.hasMore);
        setTotal(payload.total);
        setFacets(payload.facets);
        loadedFingerprint.current = filterFingerprint;
      } catch (error) {
        if (controller.signal.aborted || requestId !== requestSequence.current) {
          return;
        }
        console.error("Crew directory search failed", {
          code: error instanceof Error ? error.message : "unknown",
        });
        setProfiles([]);
        setNextCursor(null);
        setHasMore(false);
        setTotal(0);
        setSearchFailed(true);
      } finally {
        if (requestId === requestSequence.current) setSearching(false);
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
      loadMoreController.current?.abort();
    };
  }, [filterFingerprint, refreshVersion]);

  function setFilter<Key extends keyof CrewSearchFilters>(
    key: Key,
    value: CrewSearchFilters[Key],
  ) {
    setFilters((current) =>
      normalizeCrewSearchFilters({ ...current, [key]: value }),
    );
  }

  function clearFilters() {
    setFilters(defaultCrewSearchFilters);
    setAdvancedOpen(false);
  }

  async function loadMoreProfiles() {
    if (!hasMore || !nextCursor || loadingMore || searching) return;
    const requestedFilterFingerprint = filterFingerprint;
    const controller = new AbortController();
    loadMoreController.current?.abort();
    loadMoreController.current = controller;
    setLoadingMore(true);
    setLoadMoreFailed(false);

    try {
      const requestedCursor = nextCursor;
      const params = new URLSearchParams(filterFingerprint);
      params.set("cursor", requestedCursor);
      const response = await fetch(`/api/find-crew?${params.toString()}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (
        controller.signal.aborted ||
        loadMoreController.current !== controller ||
        currentFilterFingerprint.current !== requestedFilterFingerprint
      ) {
        return;
      }
      if (!response.ok || !isCrewPageResponse(payload)) {
        throw new Error("crew_page_failed");
      }
      if (
        payload.hasMore &&
        (!payload.nextCursor || payload.nextCursor === requestedCursor)
      ) {
        throw new Error("crew_cursor_stalled");
      }

      setProfiles((current) => {
        const profilesById = new Map(
          current.map((profile) => [profile.crewId, profile]),
        );
        for (const profile of payload.profiles) {
          profilesById.set(profile.crewId, profile);
        }
        return Array.from(profilesById.values());
      });
      setNextCursor(payload.nextCursor);
      setHasMore(payload.hasMore);
      setTotal(payload.total);
      setFacets(payload.facets);
    } catch {
      if (controller.signal.aborted) return;
      setLoadMoreFailed(true);
    } finally {
      if (loadMoreController.current === controller) {
        loadMoreController.current = null;
        setLoadingMore(false);
      }
    }
  }

  return (
    <div className="bd-site-shell min-h-screen text-[#071f3c]">
      <PublicHeader />

      <main id="main-content">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-800">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              {c.eyebrow}
            </p>
            <h1 className="bd-serif mt-4 max-w-4xl text-4xl leading-[1.02] text-[#071f3c] sm:text-5xl lg:text-6xl">
              {c.title}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-[#526b83]">
              {c.intro}
            </p>
          </div>
        </section>

        <section
          aria-labelledby="crew-results-heading"
          className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10 lg:py-12"
        >
          <section
            aria-labelledby="crew-filter-heading"
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_14px_45px_rgba(15,45,72,0.05)] sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2
                  id="crew-filter-heading"
                  className="flex items-center gap-2 text-sm font-black text-[#071f3c]"
                >
                  <SlidersHorizontal
                    className="h-5 w-5 text-cyan-700"
                    aria-hidden
                  />
                  {c.filters}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{c.filterHint}</p>
              </div>
              <button
                type="button"
                onClick={() => setAdvancedOpen((current) => !current)}
                aria-expanded={advancedOpen}
                aria-controls="crew-advanced-filters"
                className="bd-focus inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-cyan-500 hover:text-cyan-900"
              >
                {c.advanced}
                {advancedFilterCount > 0 ? (
                  <span
                    data-i18n-ignore
                    className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-cyan-700 px-1.5 text-xs text-white"
                  >
                    {advancedFilterCount}
                  </span>
                ) : null}
                <ChevronDown
                  className={`h-4 w-4 transition ${advancedOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.35fr_repeat(4,minmax(0,1fr))]">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">
                  {c.search}
                </span>
                <span className="relative block">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-700"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={filters.query}
                    onChange={(event) => setFilter("query", event.target.value)}
                    placeholder={c.searchPlaceholder}
                    maxLength={120}
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  />
                </span>
              </label>
              <FilterSelect
                label={c.position}
                value={filters.position}
                onChange={(value) => setFilter("position", value)}
                options={facets.positions}
                language={language}
              />
              <FilterSelect
                label={c.location}
                value={filters.location}
                onChange={(value) => setFilter("location", value)}
                options={facets.locations}
                language={language}
              />
              <FilterSelect
                label={c.availability}
                value={filters.availability}
                onChange={(value) => setFilter("availability", value)}
                options={facets.availabilities}
                language={language}
              />
              <FilterSelect
                label={c.contract}
                value={filters.employmentType}
                onChange={(value) => setFilter("employmentType", value)}
                options={facets.employmentTypes}
                language={language}
              />
            </div>

            {advancedOpen ? (
              <div
                id="crew-advanced-filters"
                className="mt-5 border-t border-slate-200 pt-5"
              >
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <FilterSelect
                    label={c.nationalityFilter}
                    value={filters.nationality}
                    onChange={(value) => setFilter("nationality", value)}
                    options={facets.nationalities}
                    language={language}
                    optionKind="nationality"
                  />
                  <FilterSelect
                    label={c.maritalStatus}
                    value={filters.maritalStatus}
                    onChange={(value) => setFilter("maritalStatus", value)}
                    options={crewMaritalStatuses}
                    language={language}
                  />
                  <NumberFilterSelect
                    label={c.minimumExperience}
                    value={filters.minimumExperience}
                    onChange={(value) => setFilter("minimumExperience", value)}
                    language={language}
                  />
                  <FilterSelect
                    label={c.skill}
                    value={filters.skill}
                    onChange={(value) => setFilter("skill", value)}
                    options={facets.skills}
                    language={language}
                  />
                  <FilterSelect
                    label={c.characteristic}
                    value={filters.characteristic}
                    onChange={(value) => setFilter("characteristic", value)}
                    options={facets.characteristics}
                    language={language}
                  />
                  <FilterSelect
                    label={c.workPreference}
                    value={filters.workPreference}
                    onChange={(value) => setFilter("workPreference", value)}
                    options={facets.workPreferences}
                    language={language}
                  />
                  <FilterSelect
                    label={c.language}
                    value={filters.language}
                    onChange={(value) => setFilter("language", value)}
                    options={facets.languages}
                    language={language}
                  />
                </div>

                <fieldset className="mt-5">
                  <legend className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    {c.profileQuality}
                  </legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <FilterToggle
                      label={c.premiumOnly}
                      checked={filters.premiumOnly}
                      onChange={(checked) => setFilter("premiumOnly", checked)}
                    />
                    <FilterToggle
                      label={c.hasPhoto}
                      checked={filters.hasPhoto}
                      onChange={(checked) => setFilter("hasPhoto", checked)}
                    />
                    <FilterToggle
                      label={c.hasGallery}
                      checked={filters.hasGallery}
                      onChange={(checked) => setFilter("hasGallery", checked)}
                    />
                  </div>
                </fieldset>
                <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
                  <ShieldCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700"
                    aria-hidden
                  />
                  {c.fairHiringNote}
                </p>
              </div>
            ) : null}
          </section>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div aria-live="polite" aria-atomic="true">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-800">
                {c.results}
              </p>
              <h2
                id="crew-results-heading"
                className="mt-1 flex items-center gap-3 text-3xl font-semibold tracking-[-0.03em] text-[#071f3c]"
              >
                <span>
                  <span data-i18n-ignore>{total}</span> {c.profiles}
                </span>
                {searching ? (
                  <LoaderCircle
                    className="h-5 w-5 animate-spin text-cyan-700"
                    aria-label={c.searching}
                  />
                ) : null}
              </h2>
            </div>
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="bd-focus inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-cyan-500 hover:text-cyan-900"
              >
                <X className="h-4 w-4" aria-hidden />
                {c.clear}
                <span data-i18n-ignore>({activeFilterCount})</span>
              </button>
            ) : null}
          </div>

          {searchFailed ? (
            <div
              role="alert"
              className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-8 text-center"
            >
              <h3 className="text-xl font-semibold text-rose-950">
                {c.searchErrorTitle}
              </h3>
              <p className="mt-2 text-rose-800">{c.searchErrorText}</p>
              <button
                type="button"
                onClick={() => setRefreshVersion((value) => value + 1)}
                className="bd-focus mt-4 min-h-11 rounded-xl bg-rose-900 px-5 text-sm font-black text-white transition hover:bg-rose-800"
              >
                {c.retry}
              </button>
            </div>
          ) : profiles.length > 0 ? (
            <div
              className={`mt-5 grid gap-5 transition-opacity ${searching ? "opacity-55" : "opacity-100"}`}
              aria-busy={searching}
            >
              {profiles.map((profile) => (
                <CrewCandidatePassportCard
                  key={profile.crewId}
                  candidate={profile}
                  availabilityValue={
                    profile.availabilityStatus
                      ? candidateAvailabilityLabel(
                          profile.availabilityStatus,
                          language,
                        )
                      : c.notProvided
                  }
                  primaryBadge={
                    <span className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-800">
                      {c.activeProfile}
                    </span>
                  }
                  fourthFact={{
                    icon: <Clock3 />,
                    label: c.memberSince,
                    value: profile.memberSince
                      ? formatMonthYear(profile.memberSince, language)
                      : c.notProvided,
                  }}
                  copy={c}
                  profileHref={`/find-crew/${encodeURIComponent(profile.crewId)}`}
                />
              ))}
            </div>
          ) : !searching ? (
            <div className="mt-5 rounded-2xl border border-dashed border-cyan-300 bg-cyan-50/50 px-6 py-12 text-center">
              <UserRound
                className="mx-auto h-9 w-9 text-cyan-700"
                aria-hidden
              />
              <h3 className="mt-4 text-2xl font-semibold text-[#071f3c]">
                {hasFilters ? c.noMatchesTitle : c.emptyTitle}
              </h3>
              <p className="mx-auto mt-2 max-w-xl leading-7 text-slate-600">
                {hasFilters ? c.noMatchesText : c.emptyText}
              </p>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="bd-focus mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
                >
                  {c.clear}
                </button>
              ) : (
                <Link
                  href="/login?mode=signup&role=crew"
                  className="bd-focus mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
                >
                  {c.createCrewAccount}
                </Link>
              )}
            </div>
          ) : null}

          {hasMore && !searchFailed ? (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => void loadMoreProfiles()}
                disabled={loadingMore || searching}
                className="bd-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-700 bg-white px-6 text-sm font-black text-cyan-900 transition hover:bg-cyan-50 disabled:cursor-wait disabled:opacity-60"
              >
                {loadingMore ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                {loadingMore ? c.loadingMore : c.loadMore}
              </button>
            </div>
          ) : null}
          {loadMoreFailed ? (
            <p
              role="alert"
              className="mt-3 text-center text-sm font-semibold text-rose-700"
            >
              {c.loadMoreError}
            </p>
          ) : null}
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  language,
  optionKind = "default",
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  language: Language;
  optionKind?: "default" | "nationality";
}) {
  const visibleOptions =
    value && !options.includes(value) ? [value, ...options] : options;
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
      >
        <option value="">{label}</option>
        {visibleOptions.map((option) => (
          <option key={option} value={option}>
            {formatFilterOption(option, language, optionKind)}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatFilterOption(
  option: string,
  language: Language,
  kind: "default" | "nationality",
) {
  if (language === "en") return option;
  if (kind === "nationality") {
    return (
      {
        American: "Amerikalı",
        Australian: "Avustralyalı",
        British: "Britanyalı",
        Canadian: "Kanadalı",
        Croatian: "Hırvat",
        Dutch: "Hollandalı",
        Filipino: "Filipinli",
        French: "Fransız",
        German: "Alman",
        Greek: "Yunan",
        Italian: "İtalyan",
        "New Zealander": "Yeni Zelandalı",
        Polish: "Polonyalı",
        Russian: "Rus",
        "South African": "Güney Afrikalı",
        Spanish: "İspanyol",
        Turkish: "Türk",
        Ukrainian: "Ukraynalı",
      }[option] || translatePhrase(option, language)
    );
  }
  return translatePhrase(option, language);
}

const experienceOptions = [0, 1, 2, 3, 5, 10, 15, 20, 30, 40, 50, 60];

function NumberFilterSelect({
  label,
  value,
  onChange,
  language,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  language: Language;
}) {
  const years = language === "tr" ? "yıl" : "years";
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">
        {label}
      </span>
      <select
        value={value === null ? "" : String(value)}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : null)
        }
        className="min-h-12 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
      >
        <option value="">{label}</option>
        {experienceOptions.map((option) => (
          <option key={option} value={option}>
            {option} {years}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 text-sm font-bold transition ${
        checked
          ? "border-cyan-500 bg-cyan-50 text-cyan-950"
          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-cyan-300"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 accent-cyan-700"
      />
      <span>{label}</span>
    </label>
  );
}

function hasAdvancedCrewFilters(filters: CrewSearchFilters) {
  return countAdvancedCrewFilters(filters) > 0;
}

function countAdvancedCrewFilters(filters: CrewSearchFilters) {
  const advanced: CrewSearchFilters = {
    ...defaultCrewSearchFilters,
    nationality: filters.nationality,
    maritalStatus: filters.maritalStatus,
    skill: filters.skill,
    characteristic: filters.characteristic,
    workPreference: filters.workPreference,
    language: filters.language,
    minimumExperience: filters.minimumExperience,
    premiumOnly: filters.premiumOnly,
    hasPhoto: filters.hasPhoto,
    hasGallery: filters.hasGallery,
  };
  return crewSearchFilterCount(advanced);
}

function candidateAvailabilityLabel(value: string, language: Language) {
  const labels: Record<string, { en: string; tr: string }> = {
    Available: { en: "Available", tr: "Müsait" },
    "In 1 week": { en: "In 1 week", tr: "1 hafta içinde" },
    "In 1 month": { en: "In 1 month", tr: "1 ay içinde" },
    "Open to offers": { en: "Open to offers", tr: "Tekliflere açık" },
    "Not available": { en: "Not available", tr: "Müsait değil" },
  };

  return labels[value]?.[language] || translatePhrase(value, language);
}

function formatMonthYear(value: string, language: Language) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-GB", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function isCrewPageResponse(value: unknown): value is {
  ok: true;
  profiles: DiscoverableCrewPreview[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
  facets: CrewSearchFacets;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const page = value as Record<string, unknown>;
  return (
    page.ok === true &&
    Array.isArray(page.profiles) &&
    page.profiles.length <= 24 &&
    page.profiles.every(isDiscoverableCrewPreview) &&
    typeof page.hasMore === "boolean" &&
    isOpaqueCursor(page.nextCursor, page.hasMore) &&
    typeof page.total === "number" &&
    Number.isSafeInteger(page.total) &&
    page.total >= page.profiles.length &&
    isCrewSearchFacets(page.facets)
  );
}

function isOpaqueCursor(value: unknown, hasMore: boolean) {
  if (!hasMore) return value === null;
  return (
    typeof value === "string" &&
    /^v2\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{1,256}\.[A-Za-z0-9_-]{22}$/.test(
      value,
    )
  );
}

function isCrewSearchFacets(value: unknown): value is CrewSearchFacets {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const facets = value as Record<string, unknown>;
  return [
    "positions",
    "locations",
    "availabilities",
    "employmentTypes",
    "nationalities",
    "maritalStatuses",
    "skills",
    "characteristics",
    "workPreferences",
    "languages",
  ].every(
    (key) =>
      Array.isArray(facets[key]) &&
      (facets[key] as unknown[]).length <= 250 &&
      (facets[key] as unknown[]).every(
        (item) => typeof item === "string" && item.length <= 120,
      ),
  );
}

function isDiscoverableCrewPreview(
  value: unknown,
): value is DiscoverableCrewPreview {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const profile = value as Record<string, unknown>;
  const stringFields = [
    "crewId",
    "displayName",
    "initials",
    "profilePhotoUrl",
    "currentPosition",
    "location",
    "nationality",
    "availabilityStatus",
    "memberSince",
  ];
  const arrayFields = [
    "seekingPositions",
    "preferredLocations",
    "employmentTypes",
    "personalSkills",
  ];
  return (
    stringFields.every(
      (field) =>
        typeof profile[field] === "string" &&
        (profile[field] as string).length <= 300,
    ) &&
    arrayFields.every(
      (field) =>
        Array.isArray(profile[field]) &&
        (profile[field] as unknown[]).length <= 30 &&
        (profile[field] as unknown[]).every(
          (item) => typeof item === "string" && item.length <= 120,
        ),
    ) &&
    typeof profile.experienceYears === "number" &&
    Number.isFinite(profile.experienceYears) &&
    profile.experienceYears >= 0 &&
    profile.experienceYears <= 100 &&
    typeof profile.premiumProfile === "boolean"
  );
}

const copy = {
  en: {
    eyebrow: "Public crew directory",
    title: "Find the right yacht crew with precision.",
    intro:
      "Search privacy-protected Crew and Captain profiles by professional experience, position, location, language, skills, work preferences and profile readiness.",
    filters: "Search and filters",
    filterHint: "Results update automatically as you refine the criteria.",
    advanced: "More filters",
    search: "Search crew",
    searchPlaceholder: "Position, skill, language or location",
    position: "All positions",
    location: "All locations",
    availability: "Any availability",
    contract: "Any contract",
    nationalityFilter: "Any nationality",
    maritalStatus: "Any marital status",
    minimumExperience: "Minimum experience",
    skill: "Any skill",
    characteristic: "Any professional trait",
    workPreference: "Any work preference",
    language: "Any language",
    profileQuality: "Profile readiness",
    premiumOnly: "Premium profiles",
    hasPhoto: "Profile photo",
    hasGallery: "Blue gallery",
    fairHiringNote:
      "Use all personal filters responsibly and only where relevant and lawful.",
    results: "Matching crew",
    profiles: "crew profiles",
    searching: "Searching crew",
    clear: "Clear filters",
    activeProfile: "Active profile",
    memberSince: "Member since",
    nameLocked: "Crew member name protected",
    crewMember: "Yacht crew",
    premium: "Premium",
    nationality: "Nationality",
    notProvided: "Not provided",
    availableToStart: "Available to start",
    experience: "Experience",
    lessThanOneYear: "Less than 1 year",
    years: "years",
    noExperience: "Not added",
    viewProfile: "View profile",
    noMatchesTitle: "No profiles match these filters",
    noMatchesText:
      "Broaden one or more criteria to see other active Crew and Captain profiles.",
    emptyTitle: "No active crew profiles yet",
    emptyText:
      "Email-confirmed Crew and Captain accounts will appear here as the network grows.",
    createCrewAccount: "Create a crew account",
    loadMore: "Load more crew",
    loadingMore: "Loading crew…",
    loadMoreError: "More crew profiles could not be loaded. Please try again.",
    searchErrorTitle: "Crew search is temporarily unavailable",
    searchErrorText: "Your filters are safe. Please retry the search.",
    retry: "Retry search",
  },
  tr: {
    eyebrow: "Herkese açık crew rehberi",
    title: "Doğru yat mürettebatını hassasiyetle bulun.",
    intro:
      "Gizliliği korunan Crew ve Captain profillerini mesleki deneyim, pozisyon, konum, dil, beceri, çalışma tercihi ve profil yeterliliğine göre arayın.",
    filters: "Arama ve filtreler",
    filterHint: "Kriterleri değiştirdikçe sonuçlar otomatik güncellenir.",
    advanced: "Daha fazla filtre",
    search: "Crew ara",
    searchPlaceholder: "Pozisyon, beceri, dil veya konum",
    position: "Tüm pozisyonlar",
    location: "Tüm konumlar",
    availability: "Tüm müsaitlik durumları",
    contract: "Tüm çalışma türleri",
    nationalityFilter: "Tüm uyruklar",
    maritalStatus: "Tüm medeni durumlar",
    minimumExperience: "Minimum deneyim",
    skill: "Tüm beceriler",
    characteristic: "Tüm profesyonel özellikler",
    workPreference: "Tüm çalışma tercihleri",
    language: "Tüm diller",
    profileQuality: "Profil yeterliliği",
    premiumOnly: "Premium profiller",
    hasPhoto: "Profil fotoğrafı",
    hasGallery: "Blue gallery",
    fairHiringNote:
      "Kişisel filtreleri yalnızca ilgili ve hukuka uygun olduğunda sorumlu biçimde kullanın.",
    results: "Eşleşen crew",
    profiles: "crew profili",
    searching: "Crew aranıyor",
    clear: "Filtreleri temizle",
    activeProfile: "Aktif profil",
    memberSince: "Üyelik",
    nameLocked: "Crew üyesinin adı korumalı",
    crewMember: "Yat mürettebatı",
    premium: "Premium",
    nationality: "Uyruk",
    notProvided: "Belirtilmedi",
    availableToStart: "İşe başlama müsaitliği",
    experience: "Deneyim",
    lessThanOneYear: "1 yıldan az",
    years: "yıl",
    noExperience: "Eklenmedi",
    viewProfile: "Profili görüntüle",
    noMatchesTitle: "Bu filtrelerle eşleşen profil yok",
    noMatchesText:
      "Diğer aktif Crew ve Captain profillerini görmek için bazı kriterleri genişletin.",
    emptyTitle: "Henüz aktif crew profili yok",
    emptyText:
      "E-posta adresi onaylanmış Crew ve Captain hesapları ağ büyüdükçe burada görünecek.",
    createCrewAccount: "Crew hesabı oluştur",
    loadMore: "Daha fazla crew yükle",
    loadingMore: "Crew profilleri yükleniyor…",
    loadMoreError: "Diğer crew profilleri yüklenemedi. Lütfen tekrar deneyin.",
    searchErrorTitle: "Crew araması geçici olarak kullanılamıyor",
    searchErrorText: "Filtreleriniz korundu. Lütfen aramayı tekrar deneyin.",
    retry: "Aramayı tekrar dene",
  },
} as const;

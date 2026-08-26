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
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CrewCandidatePassportCard } from "../components/CrewCandidatePresentation";
import {
  NATIONALITY_CONTROL_SIZE_CLASS_NAME,
  NationalitySearchField,
} from "../components/NationalitySearchField";
import { PublicFooter, PublicHeader } from "../components/PublicSiteChrome";
import { useLanguage } from "../components/LanguageProvider";
import { crewDirectoryAvailabilityStatuses } from "../lib/crewDiscovery";
import type { DiscoverableCrewPreview } from "../lib/findCrewData";
import {
  formatJobMinimumYachtExperience,
  type JobMinimumYachtExperience,
} from "../lib/jobPosts";
import { capitalizeInitialInput } from "../lib/inputText";
import {
  crewExperienceTypes,
  crewGenderOptions,
  crewMaritalStatuses,
  maximumCrewPositionSelections,
  crewSearchFilterCount,
  crewSearchParams,
  crewYesNoOptions,
  defaultCrewSearchFilters,
  normalizeCrewSearchFilters,
  type CrewExperienceType,
  type CrewSearchFacets,
  type CrewSearchFilters,
} from "../lib/crewSearch";
import { parseCrewSearchRequest } from "../lib/crewSearchRequest";
import { translatePhrase, type Language } from "../lib/i18n";
import { publicJobSearchTaxonomy } from "../lib/publicJobSearchConfig";

const experienceTypeLabels = {
  en: { any: "Any", yacht: "Yacht", other: "Other" },
  tr: { any: "Tümü", yacht: "Yat", other: "Diğer" },
} as const;

const crewFilterSelectClassName = `${NATIONALITY_CONTROL_SIZE_CLASS_NAME} appearance-none cursor-pointer rounded-xl border border-slate-200 bg-slate-50 py-0 pl-4 pr-12 text-sm font-semibold text-slate-950 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100`;
const crewPositionMultiSelectSelector =
  'details[data-crew-position-multi-select="true"]';

const findCrewMinimumExperienceThresholds = [
  "0_6_months",
  "1_year",
  "2_years",
  "3_years",
  "5_plus_years",
  "10_plus_years",
  "15_plus_years",
  "20_plus_years",
] as const satisfies readonly JobMinimumYachtExperience[];

type FindCrewClientProps = {
  profiles: DiscoverableCrewPreview[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
  initialTotal: number;
  initialFilters: CrewSearchFilters;
};

type SelectOption = { value: string; label: string };
const crewPositionSelectOptions: readonly SelectOption[] =
  publicJobSearchTaxonomy.positions.map((value) => ({ value, label: value }));

export function FindCrewClient({
  profiles: initialProfiles,
  initialNextCursor,
  initialHasMore,
  initialTotal,
  initialFilters,
}: FindCrewClientProps) {
  const { language } = useLanguage();
  const c = copy[language];
  const [profiles, setProfiles] = useState(initialProfiles);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [total, setTotal] = useState(initialTotal);
  const [filters, setFilters] = useState(() =>
    normalizeCrewSearchFilters(initialFilters),
  );
  const [draftFilters, setDraftFilters] = useState(() =>
    normalizeCrewSearchFilters(initialFilters),
  );
  const [advancedOpen, setAdvancedOpen] = useState(() =>
    hasAdvancedCrewFilters(initialFilters),
  );
  const [filterResetVersion, setFilterResetVersion] = useState(0);
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
  const hasFilters = activeFilterCount > 0;

  useEffect(() => {
    function restoreFilters() {
      const parsed = parseCrewSearchRequest(
        new URLSearchParams(window.location.search),
      );
      const restored =
        parsed.ok && !parsed.cursor
          ? parsed.filters
          : defaultCrewSearchFilters;
      setFilters(restored);
      setDraftFilters(restored);
      if (hasAdvancedCrewFilters(restored)) setAdvancedOpen(true);
    }

    window.addEventListener("popstate", restoreFilters);
    return () => window.removeEventListener("popstate", restoreFilters);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(crewPositionMultiSelectSelector)
      ) {
        return;
      }
      closeOpenCrewPositionMultiSelects();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const openDetails = document.querySelector<HTMLDetailsElement>(
        `${crewPositionMultiSelectSelector}[open]`,
      );
      if (!openDetails) return;
      closeOpenCrewPositionMultiSelects();
      openDetails.querySelector<HTMLElement>("summary")?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
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

  function setDraftFilter<Key extends keyof CrewSearchFilters>(
    key: Key,
    value: CrewSearchFilters[Key],
  ) {
    setDraftFilters((current) =>
      normalizeCrewSearchFilters({ ...current, [key]: value }),
    );
  }

  function clearFilters() {
    setFilters(defaultCrewSearchFilters);
    setDraftFilters(defaultCrewSearchFilters);
    setFilterResetVersion((version) => version + 1);
  }

  function submitCrewKeywordSearch() {
    setFilters((current) =>
      normalizeCrewSearchFilters({ ...current, query: draftFilters.query }),
    );
  }

  function submitAllCrewFilters() {
    closeOpenCrewPositionMultiSelects();
    setFilters(normalizeCrewSearchFilters(draftFilters));
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
        <section
          aria-labelledby="crew-results-heading"
          className="bd-page-frame bd-page-gutter mx-auto w-full max-w-7xl px-5 pb-12 pt-7 sm:px-8 sm:pt-8 lg:px-10 lg:pb-14 lg:pt-10"
        >
          <section
            aria-labelledby="crew-filter-heading"
            className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,45,72,0.07)] sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1
                  id="crew-filter-heading"
                  className="flex items-center gap-2 text-base font-black text-[#071f3c]"
                >
                  <SlidersHorizontal
                    className="h-5 w-5 text-cyan-700"
                    aria-hidden
                  />
                  {c.filters}
                </h1>
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
                <ChevronDown
                  className={`h-4 w-4 transition ${advancedOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            </div>

            <div
              className={`mt-4 grid gap-3 md:grid-cols-2 ${
                advancedOpen
                  ? "xl:grid-cols-4"
                  : "xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
              }`}
            >
              <form
                className="block min-w-0"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitCrewKeywordSearch();
                }}
              >
                <label
                  htmlFor="crew-keyword-search"
                  className="mb-1.5 block text-xs font-bold text-slate-600"
                >
                  {c.search}
                </label>
                <span className="relative block min-w-0">
                  <input
                    id="crew-keyword-search"
                    type="search"
                    value={draftFilters.query}
                    onChange={(event) =>
                      setDraftFilter(
                        "query",
                        capitalizeInitialInput(event.target.value, language),
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      submitCrewKeywordSearch();
                    }}
                    placeholder={c.searchPlaceholder}
                    maxLength={120}
                    autoCapitalize="sentences"
                    className={`${NATIONALITY_CONTROL_SIZE_CLASS_NAME} rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-14 text-sm font-semibold text-slate-950 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100`}
                  />
                  <button
                    type="submit"
                    aria-label={c.keywordSearchAction}
                    title={c.keywordSearchAction}
                    className="bd-focus absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-cyan-700 transition hover:bg-cyan-50 hover:text-cyan-950"
                  >
                    <Search className="h-5 w-5" aria-hidden />
                  </button>
                </span>
              </form>
              <PositionMultiSelectField
                label={c.position}
                placeholder={c.allPositions}
                searchPlaceholder={c.searchPositions}
                selectedLabel={c.selected}
                emptyLabel={c.noOptions}
                options={crewPositionSelectOptions}
                values={draftFilters.positions}
                maxSelections={maximumCrewPositionSelections}
                searchLocale={language}
                onChange={(positions) => setDraftFilter("positions", positions)}
              />
              <NationalitySearchField
                key={`crew-nationality-${filterResetVersion}`}
                label={c.nationalityFilter}
                value={draftFilters.nationality}
                onChange={(value) => setDraftFilter("nationality", value)}
                placeholder={c.nationalityFilter}
              />
              <FilterSelect
                label={c.availability}
                emptyOptionLabel={c.selectAvailability}
                value={draftFilters.availability}
                onChange={(value) => setDraftFilter("availability", value)}
                options={crewDirectoryAvailabilityStatuses}
                language={language}
              />
              {!advancedOpen ? (
                <div className="flex items-center justify-end gap-3 self-end md:col-span-2 xl:col-span-1">
                  <CrewFilterClearAction
                    label={c.clear}
                    onClick={clearFilters}
                  />
                  <CrewFilterSearchButton
                    label={c.applyFilters}
                    accessibleLabel={c.applyFiltersLabel}
                    searchingLabel={c.searching}
                    searching={searching}
                    onClick={submitAllCrewFilters}
                    className="min-w-32 flex-1 md:flex-none"
                  />
                </div>
              ) : null}
            </div>

            {advancedOpen ? (
              <div
                id="crew-advanced-filters"
                className="mt-5 border-t border-slate-200 pt-5"
              >
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <FilterToggle
                    label={c.premiumOnly}
                    checked={draftFilters.premiumOnly}
                    onChange={(checked) => setDraftFilter("premiumOnly", checked)}
                  />
                  <FilterToggle
                    label={c.hasPhoto}
                    checked={draftFilters.hasPhoto}
                    onChange={(checked) => setDraftFilter("hasPhoto", checked)}
                  />
                  <FilterToggle
                    label={c.hasGallery}
                    checked={draftFilters.hasGallery}
                    onChange={(checked) => setDraftFilter("hasGallery", checked)}
                  />
                  <FilterToggle
                    label={c.hasTeamCouple}
                    checked={draftFilters.hasTeamCouple}
                    onChange={(checked) =>
                      setDraftFilter("hasTeamCouple", checked)
                    }
                  />
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <FilterSelect
                    label={c.maritalStatus}
                    emptyOptionLabel={c.any}
                    value={draftFilters.maritalStatus}
                    onChange={(value) => setDraftFilter("maritalStatus", value)}
                    options={crewMaritalStatuses}
                    language={language}
                  />
                  <FilterSelect
                    label={c.gender}
                    emptyOptionLabel={c.any}
                    value={draftFilters.gender}
                    onChange={(value) => setDraftFilter("gender", value)}
                    options={crewGenderOptions}
                    language={language}
                  />
                  <FilterSelect
                    label={c.smoker}
                    emptyOptionLabel={c.any}
                    value={draftFilters.smoker}
                    onChange={(value) => setDraftFilter("smoker", value)}
                    options={crewYesNoOptions}
                    language={language}
                  />
                  <FilterSelect
                    label={c.visibleTattoos}
                    emptyOptionLabel={c.any}
                    value={draftFilters.visibleTattoos}
                    onChange={(value) => setDraftFilter("visibleTattoos", value)}
                    options={crewYesNoOptions}
                    language={language}
                  />
                  <ExperienceTypeFilterSelect
                    label={c.experienceType}
                    value={draftFilters.experienceType}
                    onChange={(value) =>
                      setDraftFilter("experienceType", value)
                    }
                    language={language}
                  />
                  <MinimumExperienceFilterSelect
                    label={c.minimumExperience}
                    value={draftFilters.minimumExperience}
                    onChange={(value) => setDraftFilter("minimumExperience", value)}
                    language={language}
                  />
                </div>
                <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
                  <ShieldCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700"
                    aria-hidden
                  />
                  {c.fairHiringNote}
                </p>
                <div className="mt-5 flex items-center justify-end gap-4 border-t border-slate-200 pt-5">
                  <CrewFilterClearAction
                    label={c.clear}
                    onClick={clearFilters}
                  />
                  <CrewFilterSearchButton
                    label={c.applyFilters}
                    accessibleLabel={c.applyFiltersLabel}
                    searchingLabel={c.searching}
                    searching={searching}
                    onClick={submitAllCrewFilters}
                    className="w-full sm:w-auto sm:min-w-40"
                  />
                </div>
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
                  experienceLanguage={language}
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
                <CrewFilterClearAction
                  label={c.clear}
                  onClick={clearFilters}
                  className="mt-4"
                />
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

function CrewFilterSearchButton({
  label,
  accessibleLabel,
  searchingLabel,
  searching,
  onClick,
  className = "",
}: {
  label: string;
  accessibleLabel: string;
  searchingLabel: string;
  searching: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <button
        type="button"
        aria-label={searching ? searchingLabel : accessibleLabel}
        onClick={onClick}
        disabled={searching}
        className="bd-focus inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-6 text-sm font-black text-white shadow-sm transition hover:bg-cyan-800 disabled:cursor-wait disabled:opacity-60"
      >
        {searching ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Search className="h-4 w-4" aria-hidden />
        )}
        {searching ? searchingLabel : label}
      </button>
    </div>
  );
}

function CrewFilterClearAction({
  label,
  onClick,
  className = "",
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bd-focus inline-flex min-h-11 items-center justify-center px-1 text-sm font-bold text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-cyan-900 ${className}`.trim()}
    >
      {label}
    </button>
  );
}

function FilterSelect({
  label,
  emptyOptionLabel = label,
  value,
  options,
  onChange,
  language,
}: {
  label: string;
  emptyOptionLabel?: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  language: Language;
}) {
  const visibleOptions =
    value && !options.includes(value) ? [value, ...options] : options;
  return (
    <CrewFilterSelectControl label={label} value={value} onChange={onChange}>
      <option value="">{emptyOptionLabel}</option>
      {visibleOptions.map((option) => (
        <option key={option} value={option}>
          {formatFilterOption(option, language)}
        </option>
      ))}
    </CrewFilterSelectControl>
  );
}

function PositionMultiSelectField({
  label,
  placeholder,
  searchPlaceholder,
  selectedLabel,
  emptyLabel,
  options,
  values,
  maxSelections,
  searchLocale,
  onChange,
}: {
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  selectedLabel: string;
  emptyLabel: string;
  options: readonly SelectOption[];
  values: readonly string[];
  maxSelections: number;
  searchLocale: Language;
  onChange: (values: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleOptions = normalizedSearch
    ? options.filter((option) =>
        option.label.toLocaleLowerCase().includes(normalizedSearch),
      )
    : options;
  const selectionLimitReached = values.length >= maxSelections;
  const selectionSummary =
    values.length > 0 ? `${values.length} ${selectedLabel}` : placeholder;

  return (
    <div className="relative min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">
        {label}
      </span>
      <details
        name="crew-position-multi-select"
        data-crew-position-multi-select="true"
        className="group relative"
        onToggle={(event) => {
          if (event.currentTarget.open) {
            closeOpenCrewPositionMultiSelects(event.currentTarget);
          }
        }}
      >
        <summary
          aria-label={`${label}: ${selectionSummary}`}
          className="bd-focus flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-cyan-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 [&::-webkit-details-marker]:hidden"
        >
          <span className="min-w-0 truncate">{selectionSummary}</span>
          <ChevronDown
            className="h-4 w-4 shrink-0 transition group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="absolute left-0 z-40 mt-2 w-full min-w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-950/10">
          <label className="mb-2 block">
            <span className="sr-only">{searchPlaceholder}</span>
            <input
              type="search"
              value={search}
              placeholder={searchPlaceholder}
              onChange={(event) =>
                setSearch(
                  capitalizeFirstPositionSearchLetter(
                    event.target.value,
                    searchLocale,
                  ),
                )
              }
              className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
          <div
            role="group"
            aria-label={label}
            className="max-h-64 space-y-0.5 overflow-y-auto overscroll-contain pr-1"
          >
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => {
                const checked = values.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="flex min-h-9 cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-cyan-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && selectionLimitReached}
                      onChange={() =>
                        onChange(
                          checked
                            ? values.filter((value) => value !== option.value)
                            : [...values, option.value],
                        )
                      }
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-500 disabled:opacity-40"
                    />
                    <span data-i18n-ignore>{option.label}</span>
                  </label>
                );
              })
            ) : (
              <p className="px-2 py-3 text-sm text-slate-500">{emptyLabel}</p>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}

function closeOpenCrewPositionMultiSelects(except?: HTMLDetailsElement) {
  document
    .querySelectorAll<HTMLDetailsElement>(
      `${crewPositionMultiSelectSelector}[open]`,
    )
    .forEach((details) => {
      if (details !== except) details.open = false;
    });
}

function capitalizeFirstPositionSearchLetter(
  value: string,
  language: Language,
) {
  const firstLetter = value.match(/\p{L}/u);
  if (!firstLetter || firstLetter.index === undefined) return value;
  const index = firstLetter.index;
  const letter = firstLetter[0];
  const locale = language === "tr" ? "tr-TR" : "en-US";
  return `${value.slice(0, index)}${letter.toLocaleUpperCase(locale)}${value.slice(
    index + letter.length,
  )}`;
}

function CrewFilterSelectControl({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">
        {label}
      </span>
      <span className="relative block min-w-0">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={crewFilterSelectClassName}
        >
          {children}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-1 top-1/2 flex h-10 w-9 -translate-y-1/2 items-center justify-center text-cyan-700"
        >
          <ChevronDown className="h-4 w-4" />
        </span>
      </span>
    </label>
  );
}

function formatFilterOption(
  option: string,
  language: Language,
) {
  if (language === "en") return option;
  return translatePhrase(option, language);
}

function MinimumExperienceFilterSelect({
  label,
  value,
  onChange,
  language,
}: {
  label: string;
  value: JobMinimumYachtExperience | null;
  onChange: (value: JobMinimumYachtExperience | null) => void;
  language: Language;
}) {
  return (
    <CrewFilterSelectControl
      label={label}
      value={value === null ? "" : String(value)}
      onChange={(nextValue) =>
        onChange((nextValue as JobMinimumYachtExperience) || null)
      }
    >
      <option value="">{label}</option>
      {findCrewMinimumExperienceThresholds.map((option) => (
        <option key={option} value={option}>
          {formatFindCrewMinimumExperience(option, language)}
        </option>
      ))}
    </CrewFilterSelectControl>
  );
}

function formatFindCrewMinimumExperience(
  value: JobMinimumYachtExperience,
  language: Language,
) {
  if (value === "0_6_months") {
    return language === "tr" ? "6+ ay" : "6+ months";
  }
  return formatJobMinimumYachtExperience(value, language);
}

function ExperienceTypeFilterSelect({
  label,
  value,
  onChange,
  language,
}: {
  label: string;
  value: CrewExperienceType;
  onChange: (value: CrewExperienceType) => void;
  language: Language;
}) {
  return (
    <CrewFilterSelectControl
      label={label}
      value={value}
      onChange={(nextValue) => {
        const typedValue = nextValue as CrewExperienceType;
        onChange(
          crewExperienceTypes.includes(typedValue) ? typedValue : "any",
        );
      }}
    >
      {crewExperienceTypes.map((option) => (
        <option key={option} value={option}>
          {experienceTypeLabel(option, language)}
        </option>
      ))}
    </CrewFilterSelectControl>
  );
}

function experienceTypeLabel(
  value: CrewExperienceType,
  language: Language,
) {
  return experienceTypeLabels[language][value];
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
    maritalStatus: filters.maritalStatus,
    gender: filters.gender,
    smoker: filters.smoker,
    visibleTattoos: filters.visibleTattoos,
    minimumExperience: filters.minimumExperience,
    experienceType: filters.experienceType,
    premiumOnly: filters.premiumOnly,
    hasPhoto: filters.hasPhoto,
    hasGallery: filters.hasGallery,
    hasTeamCouple: filters.hasTeamCouple,
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
    "availabilities",
    "employmentTypes",
    "nationalities",
    "maritalStatuses",
    "skills",
    "characteristics",
    "workPreferences",
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
    typeof profile.yachtExperienceYears === "number" &&
    Number.isFinite(profile.yachtExperienceYears) &&
    profile.yachtExperienceYears >= 0 &&
    profile.yachtExperienceYears <= 100 &&
    typeof profile.otherExperienceYears === "number" &&
    Number.isFinite(profile.otherExperienceYears) &&
    profile.otherExperienceYears >= 0 &&
    profile.otherExperienceYears <= 100 &&
    typeof profile.premiumProfile === "boolean"
  );
}

const copy = {
  en: {
    filters: "Search and filters",
    filterHint: "Choose your criteria, then use Search to update the results.",
    advanced: "More filters",
    search: "Keyword",
    keywordSearchAction: "Search keyword",
    applyFilters: "Search",
    applyFiltersLabel: "Search with selected filters",
    any: "Any",
    searchPlaceholder: "Position, skill, language or location",
    position: "Position",
    allPositions: "All positions",
    searchPositions: "Search positions",
    selected: "selected",
    noOptions: "No options found",
    availability: "Availability",
    selectAvailability: "Select availability",
    nationalityFilter: "Nationality",
    maritalStatus: "Marital status",
    gender: "Gender",
    smoker: "Smoker",
    visibleTattoos: "Visible tattoos",
    experienceType: "Experience type",
    minimumExperience: "Minimum experience",
    premiumOnly: "Premium profiles",
    hasPhoto: "Profile photo",
    hasGallery: "Blue gallery",
    hasTeamCouple: "Team/Couple",
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
    filters: "Arama ve filtreler",
    filterHint:
      "Kriterlerinizi seçin, sonuçları güncellemek için Ara düğmesine basın.",
    advanced: "Daha fazla filtre",
    search: "Anahtar kelime",
    keywordSearchAction: "Anahtar kelimeyi ara",
    applyFilters: "Ara",
    applyFiltersLabel: "Seçili filtrelerle ara",
    any: "Herhangi",
    searchPlaceholder: "Pozisyon, beceri, dil veya konum",
    position: "Pozisyon",
    allPositions: "Tüm pozisyonlar",
    searchPositions: "Pozisyon ara",
    selected: "seçili",
    noOptions: "Seçenek bulunamadı",
    availability: "Müsaitlik durumları",
    selectAvailability: "Müsaitlik durumu seçin",
    nationalityFilter: "Uyruklar",
    maritalStatus: "Medeni durumlar",
    gender: "Cinsiyet",
    smoker: "Sigara kullanımı",
    visibleTattoos: "Görünür dövme",
    experienceType: "Deneyim türü",
    minimumExperience: "Minimum deneyim",
    premiumOnly: "Premium profiller",
    hasPhoto: "Profil fotoğrafı",
    hasGallery: "Blue gallery",
    hasTeamCouple: "Team/Couple",
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

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
  Filter,
  LoaderCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { PublicFooter, PublicHeader } from "../components/PublicSiteChrome";
import { LocationSearchField } from "../components/LocationSearchField";
import { useLanguage } from "../components/LanguageProvider";
import { formatCountryWithFlag, nationalityOptions } from "../lib/countries";
import {
  formatJobEmploymentType,
  formatJobSalaryCurrencyOption,
  formatJobSalaryPeriod,
  formatJobVisa,
  formatJobYachtType,
  isJobTeamCouple,
  type PublicJobCard as ServerPublicJobCard,
} from "../lib/jobPosts";
import {
  createDefaultPublicJobSearchFilters,
  hasPublicJobSearchFilters,
  parsePublicJobSearchParams,
  publicJobSearchParams,
  type PublicJobSearchFilters,
  type PublicJobSearchSort,
} from "../lib/publicJobSearch";
import { publicJobSearchTaxonomy } from "../lib/publicJobSearchConfig";
import { parsePublicJobCards, type PublicJobCard } from "./job-data";
import { useJobListingViewer } from "./JobListingAction";
import {
  PublicJobListingCard,
  PublicJobListingSkeleton,
} from "./PublicJobListingCard";

type LoadState = "loading" | "ready" | "error";
type Language = "en" | "tr";
type TeamCoupleFilterValue = "" | "yes" | "no";
type SelectOption = { value: string; label: string };
type ActiveFilterChip = {
  id: string;
  label: string;
  clear: (filters: PublicJobSearchFilters) => PublicJobSearchFilters;
};

export type InitialPublicJobSearchPage = {
  jobs: PublicJobCard[];
  total: number;
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
};

export type JobsClientProps = {
  initialFilters?: PublicJobSearchFilters;
  initialJobs?: PublicJobCard[] | ServerPublicJobCard[];
  initialTotal?: number;
  initialNextCursor?: string | null;
  initialHasMore?: boolean;
  initialLoadError?: boolean;
};

const cursorPattern = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{24,2000}$/;
const jobMultiSelectSelector = 'details[data-job-multi-select="true"]';

export function JobsClient({
  initialFilters,
  initialJobs,
  initialTotal,
  initialNextCursor,
  initialHasMore,
  initialLoadError = false,
}: JobsClientProps = {}) {
  const { language } = useLanguage();
  const c = copy[language];
  const viewer = useJobListingViewer();
  const parsedInitialJobs = initialJobs
    ? parsePublicJobCards(initialJobs)
    : null;
  const suppliedInitialPage: InitialPublicJobSearchPage | undefined =
    initialFilters &&
    parsedInitialJobs &&
    parsedInitialJobs.length === initialJobs?.length &&
    initialTotal !== undefined &&
    initialHasMore !== undefined
      ? {
          jobs: parsedInitialJobs,
          total: initialTotal,
          limit: initialFilters.limit,
          nextCursor: initialNextCursor ?? null,
          hasMore: initialHasMore,
        }
      : undefined;
  const initialFiltersRef = useRef(initialFilters);
  const initialPageRef = useRef(suppliedInitialPage);
  const initialLoadErrorRef = useRef(initialLoadError);
  const skipInitialFetch = useRef(false);
  const requestSequence = useRef(0);
  const hasInitialPage = Boolean(initialFilters && suppliedInitialPage);
  const hasInitialError = Boolean(initialFilters && initialLoadError);
  const [filters, setFilters] = useState(
    initialFilters || createDefaultPublicJobSearchFilters,
  );
  const [draftFilters, setDraftFilters] = useState(
    initialFilters || createDefaultPublicJobSearchFilters,
  );
  const [initialized, setInitialized] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(
    Boolean(initialFilters && hasAdvancedPublicJobFilters(initialFilters)),
  );
  const [loadState, setLoadState] = useState<LoadState>(
    hasInitialError ? "error" : hasInitialPage ? "ready" : "loading",
  );
  const [refreshing, setRefreshing] = useState(
    !hasInitialPage && !hasInitialError,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [jobs, setJobs] = useState<PublicJobCard[]>(
    suppliedInitialPage?.jobs || [],
  );
  const [total, setTotal] = useState(suppliedInitialPage?.total || 0);
  const [nextCursor, setNextCursor] = useState<string | null>(
    suppliedInitialPage?.nextCursor || null,
  );
  const [hasMore, setHasMore] = useState(suppliedInitialPage?.hasMore || false);
  const [requestVersion, setRequestVersion] = useState(0);
  const loadMoreController = useRef<AbortController | null>(null);

  const validationError = validateFilterRanges(filters, c);
  const draftValidationError = validateFilterRanges(draftFilters, c);
  const serializedFilters = useMemo(
    () => publicJobSearchParams(filters).toString(),
    [filters],
  );
  const activeFilters = useMemo(
    () => buildActiveFilterChips(filters, language, c),
    [c, filters, language],
  );
  const hasFilters = hasPublicJobSearchFilters(filters);
  const hasPrimaryDraftFilters =
    draftFilters.positions.length > 0 ||
    draftFilters.location.trim().length > 0 ||
    draftFilters.employmentTypes.length > 0;

  const optionSets = useMemo(() => buildOptionSets(language, c), [c, language]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(jobMultiSelectSelector)
      ) {
        return;
      }
      closeOpenJobMultiSelects();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const openDetails = document.querySelector<HTMLDetailsElement>(
        `${jobMultiSelectSelector}[open]`,
      );
      if (!openDetails) return;
      closeOpenJobMultiSelects();
      openDetails.querySelector<HTMLElement>("summary")?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    function applyUrl(allowInitialPage: boolean) {
      const params = new URLSearchParams(window.location.search);

      // Preserve links created by the former client-side search implementation.
      if (!params.has("q") && params.has("query")) {
        params.set("q", params.get("query") || "");
      }
      params.delete("query");

      const parsed = parsePublicJobSearchParams(
        params,
        publicJobSearchTaxonomy,
      );
      const nextFilters = normalizeTeamCoupleFilters(
        parsed.ok ? parsed.filters : createDefaultPublicJobSearchFilters(),
      );

      const serverFilters = initialFiltersRef.current;
      const serverPage = initialPageRef.current;
      const initialMatchesUrl = Boolean(
        parsed.ok &&
        serverFilters &&
        publicJobSearchParams(serverFilters).toString() ===
          publicJobSearchParams(nextFilters).toString(),
      );
      const useInitialPage = Boolean(
        allowInitialPage &&
        initialMatchesUrl &&
        serverPage &&
        serverFilters &&
        isValidInitialPage(serverPage, serverFilters.limit) &&
        !initialLoadErrorRef.current,
      );
      const useInitialError = Boolean(
        allowInitialPage && initialMatchesUrl && initialLoadErrorRef.current,
      );

      requestSequence.current += 1;
      loadMoreController.current?.abort();
      setFilters(nextFilters);
      setDraftFilters(nextFilters);
      setAdvancedOpen(hasAdvancedPublicJobFilters(nextFilters));
      if (useInitialError) {
        setJobs([]);
        setTotal(0);
        setNextCursor(null);
        setHasMore(false);
        setLoadState("error");
        setRefreshing(false);
        skipInitialFetch.current = true;
      } else if (useInitialPage && serverPage) {
        setJobs(serverPage.jobs);
        setTotal(serverPage.total);
        setNextCursor(serverPage.nextCursor);
        setHasMore(serverPage.hasMore);
        setLoadState("ready");
        setRefreshing(false);
        skipInitialFetch.current = true;
      } else {
        setJobs([]);
        setTotal(0);
        setNextCursor(null);
        setHasMore(false);
        setLoadState("loading");
        setRefreshing(true);
      }
      setInitialized(true);
    }

    const handlePopState = () => applyUrl(false);
    applyUrl(true);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const nextUrl = `${window.location.pathname}${
      serializedFilters ? `?${serializedFilters}` : ""
    }`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [initialized, serializedFilters]);

  useEffect(() => {
    if (!initialized || validationError) return;
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    const requestId = ++requestSequence.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetchJobsPage(filters, null, controller.signal);
        if (requestId !== requestSequence.current) return;
        setJobs(response.jobs);
        setTotal(response.total);
        setNextCursor(response.nextCursor);
        setHasMore(response.hasMore);
        setLoadMoreFailed(false);
        setLoadState("ready");
      } catch (error) {
        if (isAbortError(error) || requestId !== requestSequence.current)
          return;
        setJobs([]);
        setTotal(0);
        setNextCursor(null);
        setHasMore(false);
        setLoadState("error");
      } finally {
        if (
          !controller.signal.aborted &&
          requestId === requestSequence.current
        ) {
          setRefreshing(false);
        }
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filters, initialized, requestVersion, validationError]);

  const isEmployerViewer =
    viewer.kind === "signed-in" &&
    (viewer.role === "owner" || viewer.role === "management");
  const emptyAction =
    viewer.kind === "loading"
      ? null
      : isEmployerViewer
        ? { href: "/hiring", label: c.openHiring }
        : viewer.kind === "signed-in"
          ? viewer.role === "crew" || viewer.role === "captain"
            ? { href: "/profile", label: c.manageProfile }
            : { href: "/dashboard", label: c.openDashboard }
          : {
              href: "/login?mode=signup&role=crew",
              label: c.createProfile,
            };

  function updateDraftFilters(
    update: (current: PublicJobSearchFilters) => PublicJobSearchFilters,
  ) {
    setDraftFilters(update);
  }

  function applyFilterUpdate(
    update: (current: PublicJobSearchFilters) => PublicJobSearchFilters,
  ) {
    requestSequence.current += 1;
    loadMoreController.current?.abort();
    setLoadMoreFailed(false);
    setRefreshing(true);
    setFilters(update);
  }

  function applyKeywordSearch() {
    const query = capitalizeFirstLetter(draftFilters.query, language);
    setDraftFilters((current) => ({ ...current, query }));
    applyFilterUpdate((current) => ({ ...current, query }));
  }

  function applyAllFilters() {
    if (draftValidationError) return;
    closeOpenJobMultiSelects();
    applyFilterUpdate(() => draftFilters);
  }

  function clearFilters() {
    const emptyFilters = createDefaultPublicJobSearchFilters();
    setDraftFilters(emptyFilters);
    applyFilterUpdate(() => emptyFilters);
  }

  function removeAppliedFilter(chip: ActiveFilterChip) {
    setDraftFilters((current) => chip.clear(current));
    applyFilterUpdate((current) => chip.clear(current));
  }

  function updateSort(sort: PublicJobSearchSort) {
    const withSort = (current: PublicJobSearchFilters) => ({
      ...current,
      sort,
      salaryCurrency:
        sort.startsWith("salary_") && !current.salaryCurrency
          ? ("EUR" as const)
          : current.salaryCurrency,
      salaryPeriod:
        sort.startsWith("salary_") && !current.salaryPeriod
          ? ("month" as const)
          : current.salaryPeriod,
    });
    setDraftFilters(withSort);
    applyFilterUpdate(withSort);
  }

  function retry() {
    setRefreshing(true);
    setLoadState("loading");
    setRequestVersion((current) => current + 1);
  }

  async function loadMoreJobs() {
    if (!nextCursor || loadingMore) return;
    const requestedCursor = nextCursor;
    const requestId = requestSequence.current;
    const controller = new AbortController();
    loadMoreController.current?.abort();
    loadMoreController.current = controller;
    setLoadingMore(true);
    setLoadMoreFailed(false);

    try {
      const response = await fetchJobsPage(
        filters,
        requestedCursor,
        controller.signal,
      );
      if (requestId !== requestSequence.current) return;
      if (response.hasMore && response.nextCursor === requestedCursor) {
        throw new Error("jobs_cursor_did_not_advance");
      }
      const ids = new Set(jobs.map((job) => job.id));
      if (
        response.jobs.some((job) => ids.has(job.id)) ||
        response.total < jobs.length + response.jobs.length
      ) {
        throw new Error("jobs_page_contains_duplicates");
      }

      setJobs((current) => [...current, ...response.jobs]);
      setTotal(response.total);
      setNextCursor(response.nextCursor);
      setHasMore(response.hasMore);
    } catch (error) {
      if (
        isCursorRefreshError(error) &&
        requestId === requestSequence.current
      ) {
        setLoadMoreFailed(false);
        setRefreshing(true);
        setLoadState("loading");
        setRequestVersion((current) => current + 1);
      } else if (
        !isAbortError(error) &&
        requestId === requestSequence.current
      ) {
        setLoadMoreFailed(true);
      }
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
        <h1 className="sr-only">{c.pageTitle}</h1>

        <section
          id="jobs-board"
          aria-label={c.results}
          className="bd-page-frame bd-page-gutter mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10"
        >
          <section
            aria-labelledby="jobs-filter-heading"
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2
                  id="jobs-filter-heading"
                  className="flex items-center gap-2 text-sm font-black text-[#071f3c]"
                >
                  <SlidersHorizontal
                    className="h-5 w-5 text-cyan-700"
                    aria-hidden
                  />
                  {c.filters}
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {c.filterHint}
                </p>
              </div>
              <button
                type="button"
                aria-expanded={advancedOpen}
                aria-controls="advanced-job-filters"
                onClick={() => setAdvancedOpen((current) => !current)}
                className="bd-focus inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-black text-slate-700 transition hover:border-cyan-500 hover:text-cyan-900"
              >
                <Filter className="h-4 w-4" aria-hidden />
                {c.advanced}
                <ChevronDown
                  className={`h-4 w-4 transition ${advancedOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            </div>

            <div
              className={`mt-4 grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.45fr)_repeat(3,minmax(145px,1fr))_auto] ${
                !advancedOpen && hasPrimaryDraftFilters ? "pb-11" : ""
              }`}
            >
              <div className="block min-w-0">
                <label
                  htmlFor="jobs-keyword-search"
                  className="mb-1.5 block text-xs font-bold text-slate-600"
                >
                  {c.search}
                </label>
                <span className="relative block">
                  <input
                    id="jobs-keyword-search"
                    type="search"
                    value={draftFilters.query}
                    onChange={(event) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        query: capitalizeFirstLetter(
                          event.target.value,
                          language,
                        ),
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      applyKeywordSearch();
                    }}
                    placeholder={c.searchPlaceholder}
                    maxLength={120}
                    className="min-h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-14 text-sm font-semibold text-slate-950 outline-none transition [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  />
                  <button
                    type="button"
                    onClick={applyKeywordSearch}
                    aria-label={c.searchKeyword}
                    title={c.searchKeyword}
                    className="bd-focus absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-cyan-700 transition hover:bg-cyan-50 hover:text-cyan-950"
                  >
                    <Search className="h-5 w-5" aria-hidden />
                  </button>
                </span>
              </div>
              <MultiSelectField
                label={c.position}
                placeholder={c.allPositions}
                searchPlaceholder={c.searchPositions}
                selectedLabel={c.selected}
                emptyLabel={c.noOptions}
                options={optionSets.positions}
                values={draftFilters.positions}
                maxSelections={12}
                capitalizeSearch
                searchLocale={language}
                onChange={(positions) =>
                  updateDraftFilters((current) => ({ ...current, positions }))
                }
              />
              <LocationSearchField
                label={c.location}
                ariaLabel={c.location}
                value={draftFilters.location}
                placeholder={c.locationPlaceholder}
                searchingText={c.locationSearching}
                noResultsText={c.locationNoResults}
                resultsText={c.locationResults}
                maxLength={120}
                className="relative min-w-0"
                labelClassName="mb-1.5 block text-xs font-bold text-slate-600"
                popupClassName="absolute left-0 top-full z-50 w-full min-w-64"
                popupListClassName="max-h-72 overflow-y-auto overscroll-contain"
                onChange={(location) =>
                  updateDraftFilters((current) => ({
                    ...current,
                    location,
                  }))
                }
              />
              <MultiSelectField
                label={c.employmentType}
                placeholder={c.allEmploymentTypes}
                selectedLabel={c.selected}
                emptyLabel={c.noOptions}
                options={optionSets.employmentTypes}
                values={draftFilters.employmentTypes}
                onChange={(employmentTypes) =>
                  updateDraftFilters((current) => ({
                    ...current,
                    employmentTypes:
                      employmentTypes as PublicJobSearchFilters["employmentTypes"],
                  }))
                }
              />
              {!advancedOpen ? (
                <div className="relative flex min-h-12 items-end justify-end self-end md:col-span-2 xl:col-span-1">
                  <JobFilterSearchButton
                    label={c.applyFilters}
                    searchDisabled={Boolean(draftValidationError)}
                    onSearch={applyAllFilters}
                  />
                  {hasPrimaryDraftFilters ? (
                    <JobFilterClearAction
                      label={c.clear}
                      onClick={clearFilters}
                      className="absolute right-0 top-full mt-1 whitespace-nowrap"
                    />
                  ) : null}
                </div>
              ) : null}
            </div>

            {advancedOpen ? (
              <div
                id="advanced-job-filters"
                role="region"
                aria-label={c.advanced}
                className="mt-5 border-t border-slate-200 pt-5"
              >
                <div className="grid grid-cols-1 gap-x-3 gap-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
                  <MultiSelectField
                    label={c.department}
                    placeholder={c.allDepartments}
                    selectedLabel={c.selected}
                    emptyLabel={c.noOptions}
                    options={optionSets.departments}
                    values={draftFilters.departments}
                    onChange={(departments) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        departments,
                      }))
                    }
                  />
                  <FilterSelect
                    allowEmpty
                    label={c.teamCouple}
                    placeholder={c.anyTeamCouple}
                    options={optionSets.teamCouple}
                    value={teamCoupleFilterValue(draftFilters.candidateTypes)}
                    onChange={(value) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        candidateTypes: candidateTypesForTeamCouple(
                          value as TeamCoupleFilterValue,
                        ),
                      }))
                    }
                  />
                  <MultiSelectField
                    label={c.yachtType}
                    placeholder={c.allYachtTypes}
                    selectedLabel={c.selected}
                    emptyLabel={c.noOptions}
                    options={optionSets.yachtTypes}
                    values={draftFilters.yachtTypes}
                    onChange={(yachtTypes) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        yachtTypes:
                          yachtTypes as PublicJobSearchFilters["yachtTypes"],
                      }))
                    }
                  />
                  <MultiSelectField
                    label={c.yachtFlag}
                    placeholder={c.anyFlag}
                    searchPlaceholder={c.searchFlags}
                    selectedLabel={c.selected}
                    emptyLabel={c.noOptions}
                    options={optionSets.flags}
                    values={draftFilters.yachtFlagCountryCodes}
                    maxSelections={12}
                    onChange={(yachtFlagCountryCodes) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        yachtFlagCountryCodes,
                      }))
                    }
                  />
                  <RangeField
                    label={c.yachtLength}
                    unit={c.metres}
                    minimum={draftFilters.yachtLengthMinMetres}
                    maximum={draftFilters.yachtLengthMaxMetres}
                    minValue={0.01}
                    maxValue={999}
                    step={0.01}
                    minLabel={c.minimum}
                    maxLabel={c.maximum}
                    onMinimumChange={(yachtLengthMinMetres) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        yachtLengthMinMetres,
                      }))
                    }
                    onMaximumChange={(yachtLengthMaxMetres) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        yachtLengthMaxMetres,
                      }))
                    }
                  />
                  <RangeField
                    label={c.crewCount}
                    minimum={draftFilters.crewMemberCountMin}
                    maximum={draftFilters.crewMemberCountMax}
                    minValue={1}
                    maxValue={200}
                    step={1}
                    minLabel={c.minimum}
                    maxLabel={c.maximum}
                    onMinimumChange={(crewMemberCountMin) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        crewMemberCountMin,
                      }))
                    }
                    onMaximumChange={(crewMemberCountMax) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        crewMemberCountMax,
                      }))
                    }
                  />
                  <MultiSelectField
                    label={c.visas}
                    placeholder={c.anyVisa}
                    selectedLabel={c.selected}
                    emptyLabel={c.noOptions}
                    options={optionSets.visas}
                    values={draftFilters.requiredVisas}
                    onChange={(requiredVisas) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        requiredVisas:
                          requiredVisas as PublicJobSearchFilters["requiredVisas"],
                      }))
                    }
                  />
                  <FilterSelect
                    label={c.currency}
                    placeholder={c.anyCurrency}
                    value={draftFilters.salaryCurrency || ""}
                    options={optionSets.salaryCurrencies}
                    onChange={(value) =>
                      updateDraftFilters((current) =>
                        clearSalaryDependency(current, {
                          salaryCurrency: (value ||
                            null) as PublicJobSearchFilters["salaryCurrency"],
                        }),
                      )
                    }
                  />
                  <FilterSelect
                    label={c.payPeriod}
                    placeholder={c.anyPeriod}
                    value={draftFilters.salaryPeriod || ""}
                    options={optionSets.salaryPeriods}
                    onChange={(value) =>
                      updateDraftFilters((current) =>
                        clearSalaryDependency(current, {
                          salaryPeriod: (value ||
                            null) as PublicJobSearchFilters["salaryPeriod"],
                        }),
                      )
                    }
                  />
                  <div className="grid min-w-0 grid-cols-2 gap-2">
                    <NumberField
                      label={c.minimumSalary}
                      value={draftFilters.salaryMin}
                      min={0}
                      max={99_999_999.99}
                      step={0.01}
                      onChange={(salaryMin) =>
                        updateDraftFilters((current) => ({
                          ...current,
                          salaryMin,
                          salaryCurrency:
                            salaryMin !== null && !current.salaryCurrency
                              ? "EUR"
                              : current.salaryCurrency,
                          salaryPeriod:
                            salaryMin !== null && !current.salaryPeriod
                              ? "month"
                              : current.salaryPeriod,
                        }))
                      }
                    />
                    <NumberField
                      label={c.maximumSalary}
                      value={draftFilters.salaryMax}
                      min={0}
                      max={99_999_999.99}
                      step={0.01}
                      onChange={(salaryMax) =>
                        updateDraftFilters((current) => ({
                          ...current,
                          salaryMax,
                          salaryCurrency:
                            salaryMax !== null && !current.salaryCurrency
                              ? "EUR"
                              : current.salaryCurrency,
                          salaryPeriod:
                            salaryMax !== null && !current.salaryPeriod
                              ? "month"
                              : current.salaryPeriod,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-end gap-4">
                  <JobFilterClearAction
                    label={c.clear}
                    onClick={clearFilters}
                  />
                  <JobFilterSearchButton
                    label={c.applyFilters}
                    searchDisabled={Boolean(draftValidationError)}
                    onSearch={applyAllFilters}
                    className="w-full sm:w-auto sm:min-w-40"
                  />
                </div>
              </div>
            ) : null}

            {draftValidationError ? (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
              >
                {draftValidationError}
              </p>
            ) : null}

            {activeFilters.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <span className="mr-1 text-xs font-black uppercase tracking-[0.1em] text-slate-500">
                  {c.activeFilters}
                </span>
                {activeFilters.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => removeAppliedFilter(chip)}
                    aria-label={`${c.removeFilter}: ${chip.label}`}
                    className="bd-focus inline-flex min-h-8 items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-3 text-xs font-bold text-cyan-950 transition hover:border-cyan-400 hover:bg-cyan-100"
                  >
                    <span data-i18n-ignore>{chip.label}</span>
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
            <div aria-live="polite" aria-atomic="true">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-800">
                {c.results}
              </p>
              <h2
                id="jobs-results-heading"
                className="mt-1 flex items-center gap-3 text-3xl font-semibold tracking-[-0.03em] text-[#071f3c]"
              >
                <span>
                  <span data-i18n-ignore>{total}</span> {c.roles}
                </span>
                {refreshing && !validationError ? (
                  <LoaderCircle
                    className="h-5 w-5 animate-spin text-cyan-700"
                    aria-label={c.searching}
                  />
                ) : null}
              </h2>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <FilterSelect
                compact
                label={c.sortBy}
                placeholder={c.sortBy}
                value={filters.sort}
                options={optionSets.sorts}
                onChange={(value) => updateSort(value as PublicJobSearchSort)}
              />
            </div>
          </div>

          {validationError ? (
            <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 px-6 py-10 text-center">
              <Filter className="mx-auto h-9 w-9 text-amber-700" aria-hidden />
              <h3 className="mt-4 text-xl font-semibold text-[#071f3c]">
                {c.fixFiltersTitle}
              </h3>
              <p className="mx-auto mt-2 max-w-xl leading-7 text-slate-600">
                {validationError}
              </p>
            </div>
          ) : loadState === "loading" && jobs.length === 0 ? (
            <JobsLoadingState label={c.loading} />
          ) : loadState === "error" ? (
            <RequestError
              title={c.errorTitle}
              text={c.errorText}
              retry={c.retry}
              onRetry={retry}
            />
          ) : total === 0 && !hasFilters ? (
            <EmptyState
              title={c.emptyTitle}
              text={isEmployerViewer ? c.employerEmptyText : c.emptyText}
              action={emptyAction}
            />
          ) : total === 0 ? (
            <NoMatches copy={c} onClear={clearFilters} />
          ) : (
            <div aria-busy={refreshing}>
              <div
                className={`mt-5 grid gap-5 transition-opacity ${
                  refreshing ? "opacity-55" : "opacity-100"
                }`}
              >
                {jobs.map((job) => (
                  <PublicJobListingCard
                    key={job.id}
                    job={job}
                    language={language}
                    viewer={viewer}
                  />
                ))}
              </div>

              {hasMore || loadMoreFailed ? (
                <div className="mt-7 text-center">
                  {loadMoreFailed ? (
                    <p
                      role="alert"
                      className="mb-3 text-sm font-semibold text-rose-700"
                    >
                      {c.loadMoreError}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={loadingMore || refreshing || !nextCursor}
                    onClick={() => void loadMoreJobs()}
                    className="bd-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-sm font-black text-slate-800 transition hover:border-cyan-500 hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {loadingMore ? (
                      <LoaderCircle
                        className="h-4 w-4 animate-spin"
                        aria-hidden
                      />
                    ) : null}
                    {loadingMore ? c.loadingMore : c.loadMore}
                  </button>
                  <p className="mt-2 text-xs text-slate-500">
                    <span data-i18n-ignore>{jobs.length}</span> /{" "}
                    <span data-i18n-ignore>{total}</span> {c.shown}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

function JobFilterSearchButton({
  label,
  searchDisabled,
  onSearch,
  className = "",
}: {
  label: string;
  searchDisabled: boolean;
  onSearch: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onSearch}
        disabled={searchDisabled}
        className="bd-focus inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white shadow-sm transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Search className="h-4 w-4" aria-hidden />
        {label}
      </button>
    </div>
  );
}

function JobFilterClearAction({
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

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  step: number;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(readNullableNumber(event.target.value))}
        className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
      />
    </label>
  );
}

function RangeField({
  label,
  unit,
  minimum,
  maximum,
  minValue,
  maxValue,
  step,
  minLabel,
  maxLabel,
  onMinimumChange,
  onMaximumChange,
}: {
  label: string;
  unit?: string;
  minimum: number | null;
  maximum: number | null;
  minValue: number;
  maxValue: number;
  step: number;
  minLabel: string;
  maxLabel: string;
  onMinimumChange: (value: number | null) => void;
  onMaximumChange: (value: number | null) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-bold text-slate-600">
        {label}
        {unit ? ` (${unit})` : ""}
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="sr-only">{`${label} ${minLabel}`}</span>
          <input
            type="number"
            inputMode="decimal"
            aria-label={`${label} ${minLabel}`}
            placeholder={minLabel}
            value={minimum ?? ""}
            min={minValue}
            max={maxValue}
            step={step}
            onChange={(event) =>
              onMinimumChange(readNullableNumber(event.target.value))
            }
            className="min-h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none placeholder:font-normal placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
          />
        </label>
        <label>
          <span className="sr-only">{`${label} ${maxLabel}`}</span>
          <input
            type="number"
            inputMode="decimal"
            aria-label={`${label} ${maxLabel}`}
            placeholder={maxLabel}
            value={maximum ?? ""}
            min={minValue}
            max={maxValue}
            step={step}
            onChange={(event) =>
              onMaximumChange(readNullableNumber(event.target.value))
            }
            className="min-h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none placeholder:font-normal placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
          />
        </label>
      </div>
    </fieldset>
  );
}

function FilterSelect({
  label,
  value,
  options,
  placeholder,
  compact = false,
  allowEmpty = false,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly SelectOption[];
  placeholder: string;
  compact?: boolean;
  allowEmpty?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`block min-w-0 ${compact ? "w-full sm:w-64" : ""}`}>
      <span className="mb-1.5 block text-xs font-bold text-slate-600">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
      >
        {!value || allowEmpty ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option data-i18n-ignore key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MultiSelectField({
  label,
  placeholder,
  searchPlaceholder,
  selectedLabel,
  emptyLabel,
  options,
  values,
  maxSelections,
  capitalizeSearch = false,
  searchLocale = "en",
  onChange,
}: {
  label: string;
  placeholder: string;
  searchPlaceholder?: string;
  selectedLabel: string;
  emptyLabel: string;
  options: readonly SelectOption[];
  values: readonly string[];
  maxSelections?: number;
  capitalizeSearch?: boolean;
  searchLocale?: Language;
  onChange: (values: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleOptions = normalizedSearch
    ? options.filter((option) =>
        option.label.toLocaleLowerCase().includes(normalizedSearch),
      )
    : options;
  const selectionLimitReached =
    typeof maxSelections === "number" && values.length >= maxSelections;
  const selectionSummary =
    values.length > 0 ? `${values.length} ${selectedLabel}` : placeholder;

  return (
    <div className="relative min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">
        {label}
      </span>
      <details
        name="job-multi-select"
        data-job-multi-select="true"
        className="group relative"
        onToggle={(event) => {
          if (event.currentTarget.open) {
            closeOpenJobMultiSelects(event.currentTarget);
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
          {searchPlaceholder ? (
            <label className="mb-2 block">
              <span className="sr-only">{searchPlaceholder}</span>
              <input
                type="search"
                value={search}
                placeholder={searchPlaceholder}
                onChange={(event) =>
                  setSearch(
                    capitalizeSearch
                      ? capitalizeFirstLetter(event.target.value, searchLocale)
                      : event.target.value,
                  )
                }
                className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              />
            </label>
          ) : null}
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

function closeOpenJobMultiSelects(except?: HTMLDetailsElement) {
  document
    .querySelectorAll<HTMLDetailsElement>(`${jobMultiSelectSelector}[open]`)
    .forEach((details) => {
      if (details !== except) details.open = false;
    });
}

function JobsLoadingState({ label }: { label: string }) {
  return (
    <div className="mt-5" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3 text-sm font-black text-cyan-800">
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
        {label}
      </div>
      <div className="mt-5 grid gap-5">
        {[0, 1].map((item) => (
          <PublicJobListingSkeleton key={item} />
        ))}
      </div>
    </div>
  );
}

function RequestError({
  title,
  text,
  retry,
  onRetry,
}: {
  title: string;
  text: string;
  retry: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="mt-5 rounded-2xl border border-rose-200 bg-rose-50/70 px-6 py-12 text-center"
    >
      <RefreshCw className="mx-auto h-10 w-10 text-rose-700" aria-hidden />
      <h2 className="mt-5 text-2xl font-semibold text-[#071f3c]">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">{text}</p>
      <button
        type="button"
        onClick={onRetry}
        className="bd-focus mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        {retry}
      </button>
    </div>
  );
}

function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action: { href: string; label: string } | null;
}) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-cyan-300 bg-cyan-50/50 px-6 py-12 text-center">
      <BriefcaseBusiness
        className="mx-auto h-10 w-10 text-cyan-700"
        aria-hidden
      />
      <h2 className="mt-5 text-2xl font-semibold text-[#071f3c]">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">{text}</p>
      {action ? (
        <Link
          href={action.href}
          className="bd-focus mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

function NoMatches({
  copy: c,
  onClear,
}: {
  copy: SearchCopy;
  onClear: () => void;
}) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-cyan-300 bg-cyan-50/50 px-6 py-12 text-center">
      <Search className="mx-auto h-9 w-9 text-cyan-700" aria-hidden />
      <h3 className="mt-4 text-2xl font-semibold text-[#071f3c]">
        {c.noMatchesTitle}
      </h3>
      <p className="mx-auto mt-2 max-w-xl leading-7 text-slate-600">
        {c.noMatchesText}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="bd-focus mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
      >
        {c.clear}
      </button>
    </div>
  );
}

async function fetchJobsPage(
  filters: PublicJobSearchFilters,
  cursor: string | null,
  signal: AbortSignal,
) {
  const params = publicJobSearchParams(filters, cursor);
  const response = await fetch(`/api/jobs?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok || !isRecord(payload) || payload.ok !== true) {
    throw new JobSearchRequestError(response.status);
  }
  if (!Array.isArray(payload.jobs)) throw new Error("jobs_response_invalid");

  const parsedJobs = parsePublicJobCards(payload.jobs);
  if (!parsedJobs || parsedJobs.length !== payload.jobs.length) {
    throw new Error("jobs_response_invalid");
  }
  if (
    !isNonNegativeInteger(payload.total) ||
    !isPositiveInteger(payload.limit) ||
    payload.limit > 50 ||
    payload.limit !== filters.limit ||
    parsedJobs.length > payload.limit ||
    parsedJobs.length > payload.total ||
    typeof payload.hasMore !== "boolean" ||
    !isValidNextCursor(payload.nextCursor, payload.hasMore) ||
    (payload.hasMore && parsedJobs.length === 0) ||
    (cursor === null &&
      payload.hasMore !== parsedJobs.length < payload.total) ||
    new Set(parsedJobs.map((job) => job.id)).size !== parsedJobs.length
  ) {
    throw new Error("jobs_response_invalid");
  }

  return {
    jobs: parsedJobs,
    total: payload.total,
    limit: payload.limit,
    nextCursor: payload.nextCursor,
    hasMore: payload.hasMore,
  };
}

function buildOptionSets(language: Language, c: SearchCopy) {
  const option = (value: string, label = value): SelectOption => ({
    value,
    label,
  });
  return {
    positions: publicJobSearchTaxonomy.positions.map((value) => option(value)),
    departments: publicJobSearchTaxonomy.departments.map((value) =>
      option(value, formatDepartment(value, language)),
    ),
    employmentTypes: publicJobSearchTaxonomy.employmentTypes.map((value) =>
      option(value, formatJobEmploymentType(value, language)),
    ),
    teamCouple: [option("yes", c.yes), option("no", c.no)],
    yachtTypes: publicJobSearchTaxonomy.yachtTypes.map((value) =>
      option(value, formatJobYachtType(value, language)),
    ),
    flags: nationalityOptions.map(({ code }) =>
      option(code, formatCountryWithFlag(code) || code),
    ),
    visas: publicJobSearchTaxonomy.visas.map((value) =>
      option(value, formatJobVisa(value)),
    ),
    salaryCurrencies: publicJobSearchTaxonomy.salaryCurrencies.map((value) =>
      option(value, formatJobSalaryCurrencyOption(value)),
    ),
    salaryPeriods: publicJobSearchTaxonomy.salaryPeriods.map((value) =>
      option(value, formatJobSalaryPeriod(value, language)),
    ),
    sorts: (Object.keys(c.sorts) as PublicJobSearchSort[]).map((value) =>
      option(value, c.sorts[value]),
    ),
  };
}

function buildActiveFilterChips(
  filters: PublicJobSearchFilters,
  language: Language,
  c: SearchCopy,
) {
  const chips: ActiveFilterChip[] = [];
  const add = (id: string, label: string, clear: ActiveFilterChip["clear"]) =>
    chips.push({ id, label, clear });

  if (filters.query) {
    add("q", `${c.keywordChip}: ${filters.query}`, (current) => ({
      ...current,
      query: "",
    }));
  }
  filters.positions.forEach((value) =>
    add(`position-${value}`, value, (current) => ({
      ...current,
      positions: current.positions.filter((item) => item !== value),
    })),
  );
  filters.departments.forEach((value) =>
    add(
      `department-${value}`,
      formatDepartment(value, language),
      (current) => ({
        ...current,
        departments: current.departments.filter((item) => item !== value),
      }),
    ),
  );
  if (filters.location) {
    add("location", `${c.locationChip}: ${filters.location}`, (current) => ({
      ...current,
      location: "",
    }));
  }
  filters.employmentTypes.forEach((value) =>
    add(
      `employment-${value}`,
      formatJobEmploymentType(value, language),
      (current) => ({
        ...current,
        employmentTypes: current.employmentTypes.filter(
          (item) => item !== value,
        ),
      }),
    ),
  );
  const teamCouple = teamCoupleFilterValue(filters.candidateTypes);
  if (teamCouple) {
    add("team-couple", `${c.teamCouple}: ${c[teamCouple]}`, (current) => ({
      ...current,
      candidateTypes: [],
    }));
  }
  filters.yachtTypes.forEach((value) =>
    add(
      `yacht-type-${value}`,
      formatJobYachtType(value, language),
      (current) => ({
        ...current,
        yachtTypes: current.yachtTypes.filter((item) => item !== value),
      }),
    ),
  );
  filters.yachtFlagCountryCodes.forEach((value) =>
    add(`flag-${value}`, formatCountryWithFlag(value) || value, (current) => ({
      ...current,
      yachtFlagCountryCodes: current.yachtFlagCountryCodes.filter(
        (item) => item !== value,
      ),
    })),
  );

  addNumberChip(
    chips,
    "length-min",
    filters.yachtLengthMinMetres,
    `${c.yachtLength} ≥`,
    c.metres,
    (current) => ({ ...current, yachtLengthMinMetres: null }),
  );
  addNumberChip(
    chips,
    "length-max",
    filters.yachtLengthMaxMetres,
    `${c.yachtLength} ≤`,
    c.metres,
    (current) => ({ ...current, yachtLengthMaxMetres: null }),
  );
  addNumberChip(
    chips,
    "crew-min",
    filters.crewMemberCountMin,
    `${c.crewCount} ≥`,
    "",
    (current) => ({ ...current, crewMemberCountMin: null }),
  );
  addNumberChip(
    chips,
    "crew-max",
    filters.crewMemberCountMax,
    `${c.crewCount} ≤`,
    "",
    (current) => ({ ...current, crewMemberCountMax: null }),
  );

  filters.requiredVisas.forEach((value) =>
    add(`visa-${value}`, formatJobVisa(value), (current) => ({
      ...current,
      requiredVisas: current.requiredVisas.filter((item) => item !== value),
    })),
  );

  if (filters.salaryCurrency) {
    add("salary-currency", filters.salaryCurrency, (current) =>
      clearSalaryDependency(current, { salaryCurrency: null }),
    );
  }
  if (filters.salaryPeriod) {
    add(
      "salary-period",
      formatJobSalaryPeriod(filters.salaryPeriod, language),
      (current) => clearSalaryDependency(current, { salaryPeriod: null }),
    );
  }
  addNumberChip(
    chips,
    "salary-min",
    filters.salaryMin,
    `${c.minimumSalary}:`,
    filters.salaryCurrency || "",
    (current) => ({ ...current, salaryMin: null }),
  );
  addNumberChip(
    chips,
    "salary-max",
    filters.salaryMax,
    `${c.maximumSalary}:`,
    filters.salaryCurrency || "",
    (current) => ({ ...current, salaryMax: null }),
  );

  return chips;
}

function addNumberChip(
  chips: ActiveFilterChip[],
  id: string,
  value: number | null,
  prefix: string,
  suffix: string,
  clear: ActiveFilterChip["clear"],
) {
  if (value === null) return;
  chips.push({
    id,
    label: `${prefix} ${value}${suffix ? ` ${suffix}` : ""}`,
    clear,
  });
}

function clearSalaryDependency(
  filters: PublicJobSearchFilters,
  update: Partial<
    Pick<PublicJobSearchFilters, "salaryCurrency" | "salaryPeriod">
  >,
) {
  const next = { ...filters, ...update };
  if (!next.salaryCurrency || !next.salaryPeriod) {
    next.salaryMin = null;
    next.salaryMax = null;
    if (next.sort.startsWith("salary_")) next.sort = "newest";
  }
  return next;
}

function validateFilterRanges(filters: PublicJobSearchFilters, c: SearchCopy) {
  const reversed = (minimum: number | null, maximum: number | null) =>
    minimum !== null && maximum !== null && minimum > maximum;
  const outside = (
    value: number | null,
    minimum: number,
    maximum: number,
    integer = false,
  ) =>
    value !== null &&
    (!Number.isFinite(value) ||
      value < minimum ||
      value > maximum ||
      (integer && !Number.isSafeInteger(value)));
  const tooManyDecimals = (value: number | null) =>
    value !== null && !/^\d+(?:\.\d{1,2})?$/.test(String(value));
  if (
    outside(filters.yachtLengthMinMetres, 0.01, 999) ||
    outside(filters.yachtLengthMaxMetres, 0.01, 999) ||
    outside(filters.crewMemberCountMin, 1, 200, true) ||
    outside(filters.crewMemberCountMax, 1, 200, true) ||
    outside(filters.salaryMin, 0, 99_999_999.99) ||
    outside(filters.salaryMax, 0, 99_999_999.99) ||
    tooManyDecimals(filters.yachtLengthMinMetres) ||
    tooManyDecimals(filters.yachtLengthMaxMetres) ||
    tooManyDecimals(filters.salaryMin) ||
    tooManyDecimals(filters.salaryMax)
  ) {
    return c.valueError;
  }
  if (
    reversed(filters.yachtLengthMinMetres, filters.yachtLengthMaxMetres) ||
    reversed(filters.crewMemberCountMin, filters.crewMemberCountMax) ||
    reversed(filters.salaryMin, filters.salaryMax)
  ) {
    return c.rangeError;
  }
  if (
    (filters.salaryMin !== null ||
      filters.salaryMax !== null ||
      filters.sort.startsWith("salary_")) &&
    (!filters.salaryCurrency || !filters.salaryPeriod)
  ) {
    return c.salaryDependencyError;
  }
  return "";
}

function hasAdvancedPublicJobFilters(filters: PublicJobSearchFilters) {
  return countAdvancedPublicJobFilters(filters) > 0;
}

function countAdvancedPublicJobFilters(filters: PublicJobSearchFilters) {
  return (
    filters.departments.length +
    (filters.candidateTypes.length > 0 ? 1 : 0) +
    filters.yachtTypes.length +
    filters.yachtFlagCountryCodes.length +
    (filters.yachtLengthMinMetres !== null ? 1 : 0) +
    (filters.yachtLengthMaxMetres !== null ? 1 : 0) +
    (filters.crewMemberCountMin !== null ? 1 : 0) +
    (filters.crewMemberCountMax !== null ? 1 : 0) +
    filters.requiredVisas.length +
    (filters.salaryCurrency ? 1 : 0) +
    (filters.salaryPeriod ? 1 : 0) +
    (filters.salaryMin !== null ? 1 : 0) +
    (filters.salaryMax !== null ? 1 : 0)
  );
}

function teamCoupleFilterValue(
  candidateTypes: PublicJobSearchFilters["candidateTypes"],
): TeamCoupleFilterValue {
  const includesNo = candidateTypes.includes("individual");
  const includesYes = candidateTypes.some(isJobTeamCouple);
  if (includesNo === includesYes) return "";
  return includesYes ? "yes" : "no";
}

function candidateTypesForTeamCouple(
  value: TeamCoupleFilterValue,
): PublicJobSearchFilters["candidateTypes"] {
  if (value === "yes") return ["team", "couple"];
  if (value === "no") return ["individual"];
  return [];
}

function normalizeTeamCoupleFilters(
  filters: PublicJobSearchFilters,
): PublicJobSearchFilters {
  return {
    ...filters,
    candidateTypes: candidateTypesForTeamCouple(
      teamCoupleFilterValue(filters.candidateTypes),
    ),
  };
}

function formatDepartment(value: string, language: Language) {
  if (language === "en") return value;
  return (
    {
      Command: "Komuta",
      Deck: "Güverte",
      Engineering: "Makine",
      Interior: "İç Hizmetler",
      Galley: "Mutfak",
      Purser: "Purser",
      Guest: "Misafir",
      Toys: "Su Sporları",
      Safety: "Emniyet",
      Security: "Güvenlik",
      Medical: "Sağlık",
    }[value] || value
  );
}

function readNullableNumber(value: string) {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function capitalizeFirstLetter(value: string, language: Language) {
  const firstLetter = value.match(/\p{L}/u);
  if (!firstLetter || firstLetter.index === undefined) return value;
  const index = firstLetter.index;
  const letter = firstLetter[0];
  const locale = language === "tr" ? "tr-TR" : "en-US";
  return `${value.slice(0, index)}${letter.toLocaleUpperCase(locale)}${value.slice(index + letter.length)}`;
}

function isValidNextCursor(
  value: unknown,
  hasMore: boolean,
): value is string | null {
  if (!hasMore) return value === null;
  return (
    typeof value === "string" &&
    value.length <= 2_048 &&
    cursorPattern.test(value)
  );
}

function isValidInitialPage(
  page: InitialPublicJobSearchPage,
  expectedLimit: number,
) {
  return (
    Array.isArray(page.jobs) &&
    isNonNegativeInteger(page.total) &&
    isPositiveInteger(page.limit) &&
    page.limit === expectedLimit &&
    page.jobs.length <= page.limit &&
    page.jobs.length <= page.total &&
    typeof page.hasMore === "boolean" &&
    isValidNextCursor(page.nextCursor, page.hasMore) &&
    page.hasMore === page.jobs.length < page.total &&
    new Set(page.jobs.map((job) => job.id)).size === page.jobs.length
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value > 0;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

class JobSearchRequestError extends Error {
  constructor(readonly status: number) {
    super("jobs_request_failed");
  }
}

function isCursorRefreshError(error: unknown) {
  return error instanceof JobSearchRequestError && error.status === 400;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const copy = {
  en: {
    pageTitle: "Open yacht roles",
    filters: "Search and filters",
    filterHint:
      "Choose your filters, then select Search to update the results.",
    search: "Keyword",
    searchPlaceholder: "Position, skill, language or any",
    searchKeyword: "Search this keyword",
    applyFilters: "Search",
    position: "Position",
    allPositions: "All positions",
    searchPositions: "Search positions",
    location: "Location",
    locationPlaceholder: "Search location",
    locationSearching: "Searching locations…",
    locationNoResults: "No matching location found. You can keep your own text.",
    locationResults: "location options available.",
    employmentType: "Employment type",
    allEmploymentTypes: "All employment types",
    advanced: "Advanced filters",
    activeFilters: "Active",
    removeFilter: "Remove filter",
    selected: "selected",
    noOptions: "No options found",
    department: "Department",
    allDepartments: "All departments",
    teamCouple: "Team/Couple",
    anyTeamCouple: "Any",
    yes: "Yes",
    no: "No",
    yachtType: "Yacht type",
    allYachtTypes: "All yacht types",
    yachtFlag: "Yacht flag",
    anyFlag: "Any flag",
    searchFlags: "Search flags",
    yachtLength: "Yacht length",
    metres: "m",
    crewCount: "Crew size",
    minimum: "Min",
    maximum: "Max",
    visas: "Visas",
    anyVisa: "Any visa",
    currency: "Salary currency",
    anyCurrency: "Any currency",
    payPeriod: "Salary period",
    anyPeriod: "Any period",
    minimumSalary: "Minimum salary",
    maximumSalary: "Maximum salary",
    results: "Current opportunities",
    roles: "open roles",
    searching: "Searching jobs",
    sortBy: "Sort by",
    sorts: {
      newest: "Newest first",
      start_soonest: "Start date: soonest",
      salary_highest: "Salary: highest first",
      salary_lowest: "Salary: lowest first",
      yacht_length_desc: "Yacht length: largest first",
      yacht_length_asc: "Yacht length: smallest first",
    },
    keywordChip: "Keyword",
    locationChip: "Location",
    clear: "Clear filters",
    fixFiltersTitle: "Check the selected range",
    rangeError: "A minimum value or date cannot be later than its maximum.",
    valueError: "Enter a value within the limits shown in the field.",
    salaryDependencyError:
      "Choose a salary currency and period before using a salary range or salary sorting.",
    loading: "Loading current opportunities…",
    errorTitle: "The job board could not be loaded",
    errorText: "Check your connection and try again.",
    retry: "Try again",
    emptyTitle: "There are no open roles right now",
    emptyText:
      "New opportunities will appear here when they are published. You can prepare your BlueDeck crew profile in the meantime.",
    employerEmptyText:
      "New opportunities will appear here when they are published. Continue to your hiring workspace to create and manage your own roles.",
    createProfile: "Create crew profile",
    manageProfile: "Manage crew profile",
    openHiring: "My Job Postings & Hiring",
    openDashboard: "Open dashboard",
    noMatchesTitle: "No roles match these filters",
    noMatchesText:
      "Remove one or more filters to explore the other open roles.",
    loadMore: "Load more roles",
    loadingMore: "Loading more…",
    loadMoreError: "More roles could not be loaded. Please try again.",
    shown: "shown",
  },
  tr: {
    pageTitle: "Açık yat pozisyonları",
    filters: "Arama ve filtreler",
    filterHint:
      "Filtrelerinizi seçin, ardından sonuçları güncellemek için Ara'ya basın.",
    search: "Anahtar kelime",
    searchPlaceholder: "Pozisyon, beceri, dil veya herhangi bir anahtar kelime",
    searchKeyword: "Bu anahtar kelimeyi ara",
    applyFilters: "Ara",
    position: "Pozisyon",
    allPositions: "Tüm pozisyonlar",
    searchPositions: "Pozisyon ara",
    location: "Konum",
    locationPlaceholder: "Konum ara",
    locationSearching: "Konumlar aranıyor…",
    locationNoResults:
      "Eşleşen konum bulunamadı. Yazdığınız konumu kullanabilirsiniz.",
    locationResults: "konum seçeneği bulundu.",
    employmentType: "Çalışma türü",
    allEmploymentTypes: "Tüm çalışma biçimleri",
    advanced: "Gelişmiş filtreler",
    activeFilters: "Etkin",
    removeFilter: "Filtreyi kaldır",
    selected: "seçili",
    noOptions: "Seçenek bulunamadı",
    department: "Departman",
    allDepartments: "Tüm departmanlar",
    teamCouple: "Team/Couple",
    anyTeamCouple: "Tümü",
    yes: "Evet",
    no: "Hayır",
    yachtType: "Yat türü",
    allYachtTypes: "Tüm yat türleri",
    yachtFlag: "Yat bayrağı",
    anyFlag: "Tüm bayraklar",
    searchFlags: "Bayrak ara",
    yachtLength: "Yat uzunluğu",
    metres: "m",
    crewCount: "Mürettebat sayısı",
    minimum: "Min",
    maximum: "Maks",
    visas: "Vizeler",
    anyVisa: "Tüm vizeler",
    currency: "Ücret para birimi",
    anyCurrency: "Tüm para birimleri",
    payPeriod: "Ücret dönemi",
    anyPeriod: "Tüm dönemler",
    minimumSalary: "Minimum ücret",
    maximumSalary: "Maksimum ücret",
    results: "Güncel fırsatlar",
    roles: "açık pozisyon",
    searching: "İş ilanları aranıyor",
    sortBy: "Sırala",
    sorts: {
      newest: "En yeni önce",
      start_soonest: "Başlangıç tarihi: en yakın",
      salary_highest: "Ücret: yüksekten düşüğe",
      salary_lowest: "Ücret: düşükten yükseğe",
      yacht_length_desc: "Yat uzunluğu: büyükten küçüğe",
      yacht_length_asc: "Yat uzunluğu: küçükten büyüğe",
    },
    keywordChip: "Anahtar kelime",
    locationChip: "Konum",
    clear: "Filtreleri temizle",
    fixFiltersTitle: "Seçilen aralığı kontrol edin",
    rangeError: "Minimum değer veya tarih maksimumdan büyük olamaz.",
    valueError: "Alanda gösterilen sınırlar içinde bir değer girin.",
    salaryDependencyError:
      "Ücret aralığı veya ücret sıralaması için para birimi ve ücret dönemi seçin.",
    loading: "Güncel fırsatlar yükleniyor…",
    errorTitle: "İş ilanları yüklenemedi",
    errorText: "Bağlantınızı kontrol edip yeniden deneyin.",
    retry: "Tekrar dene",
    emptyTitle: "Şu anda açık pozisyon yok",
    emptyText:
      "Yeni fırsatlar yayınlandığında burada görünecek. Bu sırada BlueDeck crew profilinizi hazırlayabilirsiniz.",
    employerEmptyText:
      "Yeni fırsatlar yayınlandığında burada görünecek. Kendi ilanlarınızı oluşturmak ve yönetmek için işe alım alanınıza devam edin.",
    createProfile: "Crew profili oluştur",
    manageProfile: "Crew profilini yönet",
    openHiring: "İş İlanlarım ve İşe Alım",
    openDashboard: "Dashboard’u aç",
    noMatchesTitle: "Bu filtrelere uygun ilan yok",
    noMatchesText:
      "Diğer açık pozisyonları görmek için bir veya daha fazla filtreyi kaldırın.",
    loadMore: "Daha fazla ilan yükle",
    loadingMore: "Daha fazlası yükleniyor…",
    loadMoreError: "Diğer ilanlar yüklenemedi. Lütfen tekrar deneyin.",
    shown: "gösteriliyor",
  },
} as const;

type SearchCopy = (typeof copy)[keyof typeof copy];

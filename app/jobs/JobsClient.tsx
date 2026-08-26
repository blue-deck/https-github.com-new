"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
  formatJobSalaryAmountInput,
  formatJobSalaryCurrencyOption,
  formatJobSalaryPeriod,
  formatJobVisa,
  formatJobYachtType,
  isJobTeamCouple,
  maximumJobSalaryAmount,
  normalizeJobSalaryAmountInput,
  parseJobSalaryAmountInput,
  type PublicJobCard as ServerPublicJobCard,
} from "../lib/jobPosts";
import {
  createDefaultPublicJobSearchFilters,
  hasPublicJobSearchFilters,
  parsePublicJobSearchParams,
  publicJobCrewSizeSlider,
  publicJobSearchParams,
  publicJobYachtLengthSlider,
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
const defaultSalaryCurrency = "EUR" as const;
const defaultSalaryPeriod = "month" as const;

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
          ? defaultSalaryCurrency
          : current.salaryCurrency,
      salaryPeriod:
        sort.startsWith("salary_") && !current.salaryPeriod
          ? defaultSalaryPeriod
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
                  <YachtLengthRangeSlider
                    label={c.yachtLength}
                    anyLabel={c.anyYachtLength}
                    fromLabel={c.from}
                    upToLabel={c.upTo}
                    minimumLabel={c.minimumYachtLength}
                    maximumLabel={c.maximumYachtLength}
                    noMinimumLabel={c.noMinimumYachtLength}
                    noMaximumLabel={c.noMaximumYachtLength}
                    unit={c.metres}
                    minimumValue={draftFilters.yachtLengthMinMetres}
                    maximumValue={draftFilters.yachtLengthMaxMetres}
                    minimum={publicJobYachtLengthSlider.minimumMetres}
                    maximum={publicJobYachtLengthSlider.maximumMetres}
                    step={publicJobYachtLengthSlider.stepMetres}
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
                  <CrewSizeSlider
                    label={c.crewSize}
                    anyLabel={c.anyCrewSize}
                    language={language}
                    value={draftFilters.crewMemberCountMin}
                    minimum={publicJobCrewSizeSlider.minimumCrewMembers}
                    maximum={publicJobCrewSizeSlider.maximumCrewMembers}
                    step={publicJobCrewSizeSlider.stepCrewMembers}
                    onChange={(crewMemberCountMin) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        crewMemberCountMin,
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
                  <SalaryFilterGroup
                    salaryLabel={c.salary}
                    minimumLabel={c.minimumSalary}
                    maximumLabel={c.maximumSalary}
                    currencyLabel={c.currency}
                    periodLabel={c.payPeriod}
                    minimum={draftFilters.salaryMin}
                    maximum={draftFilters.salaryMax}
                    currency={
                      draftFilters.salaryCurrency ?? defaultSalaryCurrency
                    }
                    period={draftFilters.salaryPeriod ?? defaultSalaryPeriod}
                    currencyOptions={optionSets.salaryCurrencies}
                    periodOptions={optionSets.salaryPeriods}
                    onMinimumChange={(salaryMin) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        salaryMin,
                        salaryCurrency:
                          salaryMin !== null && !current.salaryCurrency
                            ? defaultSalaryCurrency
                            : current.salaryCurrency,
                        salaryPeriod:
                          salaryMin !== null && !current.salaryPeriod
                            ? defaultSalaryPeriod
                            : current.salaryPeriod,
                      }))
                    }
                    onMaximumChange={(salaryMax) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        salaryMax,
                        salaryCurrency:
                          salaryMax !== null && !current.salaryCurrency
                            ? defaultSalaryCurrency
                            : current.salaryCurrency,
                        salaryPeriod:
                          salaryMax !== null && !current.salaryPeriod
                            ? defaultSalaryPeriod
                            : current.salaryPeriod,
                      }))
                    }
                    onCurrencyChange={(value) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        salaryCurrency:
                          value as PublicJobSearchFilters["salaryCurrency"],
                        salaryPeriod:
                          current.salaryPeriod ?? defaultSalaryPeriod,
                      }))
                    }
                    onPeriodChange={(value) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        salaryCurrency:
                          current.salaryCurrency ?? defaultSalaryCurrency,
                        salaryPeriod:
                          value as PublicJobSearchFilters["salaryPeriod"],
                      }))
                    }
                  />
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

function SalaryFilterGroup({
  salaryLabel,
  minimumLabel,
  maximumLabel,
  currencyLabel,
  periodLabel,
  minimum,
  maximum,
  currency,
  period,
  currencyOptions,
  periodOptions,
  onMinimumChange,
  onMaximumChange,
  onCurrencyChange,
  onPeriodChange,
}: {
  salaryLabel: string;
  minimumLabel: string;
  maximumLabel: string;
  currencyLabel: string;
  periodLabel: string;
  minimum: number | null;
  maximum: number | null;
  currency: string;
  period: string;
  currencyOptions: readonly SelectOption[];
  periodOptions: readonly SelectOption[];
  onMinimumChange: (value: number | null) => void;
  onMaximumChange: (value: number | null) => void;
  onCurrencyChange: (value: string) => void;
  onPeriodChange: (value: string) => void;
}) {
  return (
    <fieldset className="min-w-0 rounded-2xl border border-cyan-100 bg-white/80 p-3 sm:col-span-2 sm:p-4 lg:col-span-2">
      <legend className="sr-only">{salaryLabel}</legend>
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <SalaryAmountField
          label={minimumLabel}
          currencyLabel={currencyLabel}
          periodLabel={periodLabel}
          value={minimum}
          currency={currency}
          period={period}
          currencyOptions={currencyOptions}
          periodOptions={periodOptions}
          onAmountChange={onMinimumChange}
          onCurrencyChange={onCurrencyChange}
          onPeriodChange={onPeriodChange}
        />
        <SalaryAmountField
          label={maximumLabel}
          currencyLabel={currencyLabel}
          periodLabel={periodLabel}
          value={maximum}
          currency={currency}
          period={period}
          currencyOptions={currencyOptions}
          periodOptions={periodOptions}
          onAmountChange={onMaximumChange}
          onCurrencyChange={onCurrencyChange}
          onPeriodChange={onPeriodChange}
        />
      </div>
    </fieldset>
  );
}

function SalaryAmountField({
  label,
  currencyLabel,
  periodLabel,
  value,
  currency,
  period,
  currencyOptions,
  periodOptions,
  onAmountChange,
  onCurrencyChange,
  onPeriodChange,
}: {
  label: string;
  currencyLabel: string;
  periodLabel: string;
  value: number | null;
  currency: string;
  period: string;
  currencyOptions: readonly SelectOption[];
  periodOptions: readonly SelectOption[];
  onAmountChange: (value: number | null) => void;
  onCurrencyChange: (value: string) => void;
  onPeriodChange: (value: string) => void;
}) {
  const inputId = useId();

  return (
    <div className="min-w-0">
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-xs font-bold text-slate-600"
      >
        {label}
      </label>
      <div className="grid min-h-12 min-w-0 grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-100 min-[390px]:grid-cols-[minmax(0,1fr)_6.75rem_5.75rem] sm:grid-cols-[minmax(0,1fr)_7.25rem_6.75rem]">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          pattern="[0-9.]*"
          maxLength={9}
          autoComplete="off"
          value={formatJobSalaryAmountInput(value)}
          onChange={(event) =>
            onAmountChange(
              parseJobSalaryAmountInput(
                normalizeJobSalaryAmountInput(event.target.value),
              ),
            )
          }
          className="col-span-2 min-h-12 min-w-0 bg-transparent px-3 text-sm font-semibold tabular-nums text-slate-950 outline-none placeholder:text-slate-400 focus-visible:bg-cyan-50/60 focus-visible:shadow-[inset_0_0_0_2px_#06b6d4] min-[390px]:col-span-1"
        />
        <span className="relative flex min-h-12 min-w-0 border-t border-slate-200 bg-slate-50 min-[390px]:border-l min-[390px]:border-t-0">
          <select
            aria-label={`${label} ${currencyLabel}`}
            title={`${label} ${currencyLabel}`}
            value={currency}
            onChange={(event) => onCurrencyChange(event.target.value)}
            className="min-h-12 w-full cursor-pointer appearance-none bg-transparent py-0 pl-3 pr-7 text-xs font-black text-slate-800 outline-none focus-visible:bg-cyan-50 focus-visible:shadow-[inset_0_0_0_2px_#06b6d4] sm:text-sm"
          >
            {currencyOptions.map((option) => (
              <option data-i18n-ignore key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
        </span>
        <span className="relative flex min-h-12 min-w-0 border-l border-t border-slate-200 bg-slate-50 min-[390px]:border-t-0">
          <select
            aria-label={`${label} ${periodLabel}`}
            title={`${label} ${periodLabel}`}
            value={period}
            onChange={(event) => onPeriodChange(event.target.value)}
            className="min-h-12 w-full cursor-pointer appearance-none bg-transparent py-0 pl-2.5 pr-7 text-xs font-black text-slate-800 outline-none focus-visible:bg-cyan-50 focus-visible:shadow-[inset_0_0_0_2px_#06b6d4] sm:pl-3 sm:text-sm"
          >
            {periodOptions.map((option) => (
              <option data-i18n-ignore key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
        </span>
      </div>
    </div>
  );
}

function YachtLengthRangeSlider({
  label,
  anyLabel,
  fromLabel,
  upToLabel,
  minimumLabel,
  maximumLabel,
  noMinimumLabel,
  noMaximumLabel,
  unit,
  minimumValue,
  maximumValue,
  minimum,
  maximum,
  step,
  onMinimumChange,
  onMaximumChange,
}: {
  label: string;
  anyLabel: string;
  fromLabel: string;
  upToLabel: string;
  minimumLabel: string;
  maximumLabel: string;
  noMinimumLabel: string;
  noMaximumLabel: string;
  unit: string;
  minimumValue: number | null;
  maximumValue: number | null;
  minimum: number;
  maximum: number;
  step: number;
  onMinimumChange: (value: number | null) => void;
  onMaximumChange: (value: number | null) => void;
}) {
  const summaryId = useId();
  const minimumInputRef = useRef<HTMLInputElement>(null);
  const maximumInputRef = useRef<HTMLInputElement>(null);
  const draggedThumb = useRef<{
    pointerId: number;
    thumb: "minimum" | "maximum";
  } | null>(null);
  const lowerValue = minimumValue ?? minimum;
  const upperValue = maximumValue ?? maximum;
  const minimumOnTop = lowerValue === upperValue && lowerValue === maximum;
  const span = maximum - minimum;
  const start = ((lowerValue - minimum) / span) * 100;
  const end = ((upperValue - minimum) / span) * 100;
  const valueText =
    minimumValue === null && maximumValue === null
      ? anyLabel
      : minimumValue !== null && maximumValue !== null
        ? `${minimumValue}–${maximumValue} ${unit}`
        : minimumValue !== null
          ? `${fromLabel} ${minimumValue} ${unit}`
          : `${upToLabel} ${maximumValue} ${unit}`;
  const minimumValueText =
    minimumValue === null
      ? noMinimumLabel
      : `${minimumValue} ${unit}`;
  const maximumValueText =
    maximumValue === null
      ? noMaximumLabel
      : `${maximumValue} ${unit}`;
  const valueFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const thumbInset =
      Number.parseFloat(
        getComputedStyle(event.currentTarget).getPropertyValue(
          "--bd-range-thumb-inset",
        ),
      ) || 12;
    const usableWidth = Math.max(1, bounds.width - thumbInset * 2);
    const ratio = Math.max(
      0,
      Math.min(
        1,
        (event.clientX - bounds.left - thumbInset) / usableWidth,
      ),
    );
    return Math.min(
      maximum,
      minimum + Math.round((ratio * span) / step) * step,
    );
  };
  const updateThumb = (
    thumb: "minimum" | "maximum",
    nextValue: number,
  ) => {
    if (thumb === "minimum") {
      const clampedValue = Math.min(nextValue, upperValue);
      onMinimumChange(clampedValue === minimum ? null : clampedValue);
      return;
    }
    const clampedValue = Math.max(nextValue, lowerValue);
    onMaximumChange(clampedValue === maximum ? null : clampedValue);
  };
  const handleThumbKeyDown = (
    thumb: "minimum" | "maximum",
    value: number,
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) => {
    let nextValue: number | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      nextValue = Math.max(minimum, value - step);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      nextValue = Math.min(maximum, value + step);
    } else if (event.key === "Home") {
      nextValue = minimum;
    } else if (event.key === "End") {
      nextValue = maximum;
    }
    if (nextValue === null) return;
    event.preventDefault();
    updateThumb(thumb, nextValue);
  };
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }
    event.preventDefault();
    const nextValue = valueFromPointer(event);
    const minimumDistance = Math.abs(nextValue - lowerValue);
    const maximumDistance = Math.abs(nextValue - upperValue);
    const thumb =
      minimumDistance < maximumDistance ||
      (minimumDistance === maximumDistance && nextValue <= lowerValue)
        ? "minimum"
        : "maximum";
    draggedThumb.current = { pointerId: event.pointerId, thumb };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (thumb === "minimum") minimumInputRef.current?.focus();
    else maximumInputRef.current?.focus();
    updateThumb(thumb, nextValue);
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = draggedThumb.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updateThumb(drag.thumb, valueFromPointer(event));
  };
  const stopPointerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggedThumb.current?.pointerId !== event.pointerId) return;
    draggedThumb.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const handleLostPointerCapture = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (draggedThumb.current?.pointerId === event.pointerId) {
      draggedThumb.current = null;
    }
  };

  return (
    <fieldset className="block min-w-0">
      <legend className="sr-only">{label}</legend>
      <div className="mb-1.5 flex min-h-5 items-center justify-between gap-3">
        <span aria-hidden className="text-xs font-bold text-slate-600">
          {label}
        </span>
        <span
          id={summaryId}
          className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-bold text-cyan-800"
        >
          {valueText}
        </span>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
        <div
          className="bd-job-length-range"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopPointerDrag}
          onPointerCancel={stopPointerDrag}
          onLostPointerCapture={handleLostPointerCapture}
          style={
            {
              "--bd-range-start": `${start}%`,
              "--bd-range-end": `${end}%`,
            } as CSSProperties
          }
        >
          <span className="bd-job-length-range-track" aria-hidden />
          <input
            ref={minimumInputRef}
            type="range"
            value={lowerValue}
            min={minimum}
            max={maximum}
            step={step}
            aria-label={minimumLabel}
            aria-describedby={summaryId}
            aria-valuemax={upperValue}
            aria-valuetext={minimumValueText}
            onKeyDown={(event) =>
              handleThumbKeyDown("minimum", lowerValue, event)
            }
            onChange={(event) => {
              const nextValue = Math.min(
                Number(event.target.value),
                upperValue,
              );
              onMinimumChange(nextValue === minimum ? null : nextValue);
            }}
            style={{ zIndex: minimumOnTop ? 4 : 3 }}
            className="bd-job-length-range-input"
          />
          <input
            ref={maximumInputRef}
            type="range"
            value={upperValue}
            min={minimum}
            max={maximum}
            step={step}
            aria-label={maximumLabel}
            aria-describedby={summaryId}
            aria-valuemin={lowerValue}
            aria-valuetext={maximumValueText}
            onKeyDown={(event) =>
              handleThumbKeyDown("maximum", upperValue, event)
            }
            onChange={(event) => {
              const nextValue = Math.max(
                Number(event.target.value),
                lowerValue,
              );
              onMaximumChange(nextValue === maximum ? null : nextValue);
            }}
            style={{ zIndex: minimumOnTop ? 3 : 4 }}
            className="bd-job-length-range-input"
          />
        </div>
        <span
          aria-hidden
          className="mt-0.5 flex justify-between text-[11px] font-semibold text-slate-400"
        >
          <span>{minimum} {unit}</span>
          <span>{maximum} {unit}</span>
        </span>
      </div>
    </fieldset>
  );
}

function CrewSizeSlider({
  label,
  anyLabel,
  language,
  value,
  minimum,
  maximum,
  step,
  onChange,
}: {
  label: string;
  anyLabel: string;
  language: Language;
  value: number | null;
  minimum: number;
  maximum: number;
  step: number;
  onChange: (value: number | null) => void;
}) {
  const inputId = useId();
  const summaryId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const draggedPointerId = useRef<number | null>(null);
  const sliderValue = value ?? minimum;
  const span = maximum - minimum;
  const start = ((sliderValue - minimum) / span) * 100;
  const summaryText = value === null ? anyLabel : `${value}+`;
  const accessibleValueText = formatCrewSizeSliderValue(value, language);

  const valueFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const thumbInset =
      Number.parseFloat(
        getComputedStyle(event.currentTarget).getPropertyValue(
          "--bd-range-thumb-inset",
        ),
      ) || 12;
    const usableWidth = Math.max(1, bounds.width - thumbInset * 2);
    const ratio = Math.max(
      0,
      Math.min(
        1,
        (event.clientX - bounds.left - thumbInset) / usableWidth,
      ),
    );
    return Math.min(
      maximum,
      minimum + Math.round((ratio * span) / step) * step,
    );
  };
  const updateValue = (nextValue: number) => {
    const clampedValue = Math.max(minimum, Math.min(maximum, nextValue));
    onChange(clampedValue === minimum ? null : clampedValue);
  };
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }
    event.preventDefault();
    draggedPointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    inputRef.current?.focus();
    updateValue(valueFromPointer(event));
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggedPointerId.current !== event.pointerId) return;
    updateValue(valueFromPointer(event));
  };
  const stopPointerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggedPointerId.current !== event.pointerId) return;
    draggedPointerId.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const handleLostPointerCapture = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (draggedPointerId.current === event.pointerId) {
      draggedPointerId.current = null;
    }
  };

  return (
    <div className="block min-w-0">
      <div className="mb-1.5 flex min-h-5 items-center justify-between gap-3">
        <label
          htmlFor={inputId}
          className="min-w-0 text-xs font-bold text-slate-600"
        >
          {label}
        </label>
        <span
          id={summaryId}
          className="shrink-0 rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-bold text-cyan-800"
        >
          {summaryText}
        </span>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
        <div
          className="bd-job-length-range"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopPointerDrag}
          onPointerCancel={stopPointerDrag}
          onLostPointerCapture={handleLostPointerCapture}
          style={
            {
              "--bd-range-start": `${start}%`,
              "--bd-range-end": "100%",
            } as CSSProperties
          }
        >
          <span className="bd-job-length-range-track" aria-hidden />
          <input
            id={inputId}
            ref={inputRef}
            type="range"
            value={sliderValue}
            min={minimum}
            max={maximum}
            step={step}
            aria-describedby={summaryId}
            aria-valuetext={accessibleValueText}
            onChange={(event) => updateValue(Number(event.target.value))}
            className="bd-job-length-range-input"
          />
        </div>
        <span
          aria-hidden
          className="mt-0.5 flex justify-between text-[11px] font-semibold text-slate-400"
        >
          <span>{minimum}</span>
          <span>{maximum}</span>
        </span>
      </div>
    </div>
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

  if (
    filters.yachtLengthMinMetres !== null ||
    filters.yachtLengthMaxMetres !== null
  ) {
    const range =
      filters.yachtLengthMinMetres !== null &&
      filters.yachtLengthMaxMetres !== null
        ? `${filters.yachtLengthMinMetres}–${filters.yachtLengthMaxMetres} ${c.metres}`
        : filters.yachtLengthMinMetres !== null
          ? `${c.from} ${filters.yachtLengthMinMetres} ${c.metres}`
          : `${c.upTo} ${filters.yachtLengthMaxMetres} ${c.metres}`;
    add("yacht-length", `${c.yachtLength}: ${range}`, (current) => ({
      ...current,
      yachtLengthMinMetres: null,
      yachtLengthMaxMetres: null,
    }));
  }
  if (filters.crewMemberCountMin !== null) {
    add(
      "crew-min",
      `${c.crewSize}: ${filters.crewMemberCountMin}+`,
      (current) => ({ ...current, crewMemberCountMin: null }),
    );
  }

  filters.requiredVisas.forEach((value) =>
    add(`visa-${value}`, formatJobVisa(value), (current) => ({
      ...current,
      requiredVisas: current.requiredVisas.filter((item) => item !== value),
    })),
  );

  if (
    filters.salaryCurrency ||
    filters.salaryPeriod ||
    filters.salaryMin !== null ||
    filters.salaryMax !== null
  ) {
    let amount = "";
    if (filters.salaryMin !== null && filters.salaryMax !== null) {
      const minimum = formatJobSalaryAmountInput(filters.salaryMin);
      const maximum = formatJobSalaryAmountInput(filters.salaryMax);
      amount = minimum === maximum ? minimum : `${minimum}–${maximum}`;
    } else if (filters.salaryMin !== null) {
      amount = `${c.from} ${formatJobSalaryAmountInput(filters.salaryMin)}`;
    } else if (filters.salaryMax !== null) {
      amount = `${c.upTo} ${formatJobSalaryAmountInput(filters.salaryMax)}`;
    }

    const salaryAmount =
      amount && filters.salaryCurrency
        ? `${amount} ${filters.salaryCurrency}`
        : amount;
    const salaryDetails = [
      salaryAmount,
      !amount ? filters.salaryCurrency || "" : "",
      filters.salaryPeriod
        ? formatJobSalaryPeriod(filters.salaryPeriod, language)
        : "",
    ].filter(Boolean);
    add(
      "salary",
      `${c.salary}: ${salaryDetails.join(" · ")}`,
      clearSalaryFilters,
    );
  }

  return chips;
}

function clearSalaryFilters(filters: PublicJobSearchFilters) {
  return {
    ...filters,
    salaryCurrency: null,
    salaryPeriod: null,
    salaryMin: null,
    salaryMax: null,
    sort: filters.sort.startsWith("salary_") ? "newest" : filters.sort,
  } as PublicJobSearchFilters;
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
  if (
    outside(
      filters.yachtLengthMinMetres,
      publicJobYachtLengthSlider.minimumMetres,
      publicJobYachtLengthSlider.maximumMetres,
      true,
    ) ||
    (filters.yachtLengthMinMetres !== null &&
      filters.yachtLengthMinMetres % publicJobYachtLengthSlider.stepMetres !==
        0) ||
    outside(
      filters.yachtLengthMaxMetres,
      publicJobYachtLengthSlider.minimumMetres,
      publicJobYachtLengthSlider.maximumMetres,
      true,
    ) ||
    (filters.yachtLengthMaxMetres !== null &&
      filters.yachtLengthMaxMetres % publicJobYachtLengthSlider.stepMetres !==
        0) ||
    outside(
      filters.crewMemberCountMin,
      publicJobCrewSizeSlider.minimumActiveCrewMembers,
      publicJobCrewSizeSlider.maximumCrewMembers,
      true,
    ) ||
    outside(filters.salaryMin, 0, maximumJobSalaryAmount, true) ||
    outside(filters.salaryMax, 0, maximumJobSalaryAmount, true)
  ) {
    return c.valueError;
  }
  if (
    reversed(filters.yachtLengthMinMetres, filters.yachtLengthMaxMetres) ||
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
    (filters.yachtLengthMinMetres !== null ||
      filters.yachtLengthMaxMetres !== null
      ? 1
      : 0) +
    (filters.crewMemberCountMin !== null ? 1 : 0) +
    filters.requiredVisas.length +
    (filters.salaryCurrency ||
    filters.salaryPeriod ||
    filters.salaryMin !== null ||
    filters.salaryMax !== null
      ? 1
      : 0)
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

function capitalizeFirstLetter(value: string, language: Language) {
  const firstLetter = value.match(/\p{L}/u);
  if (!firstLetter || firstLetter.index === undefined) return value;
  const index = firstLetter.index;
  const letter = firstLetter[0];
  const locale = language === "tr" ? "tr-TR" : "en-US";
  return `${value.slice(0, index)}${letter.toLocaleUpperCase(locale)}${value.slice(index + letter.length)}`;
}

function formatCrewSizeSliderValue(value: number | null, language: Language) {
  if (value === null) {
    return language === "tr" ? "Tüm mürettebat sayıları" : "Any crew size";
  }
  if (language === "tr") return `En az ${value} mürettebat`;
  return `At least ${value} crew member${value === 1 ? "" : "s"}`;
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
    minimumYachtLength: "Minimum yacht length",
    maximumYachtLength: "Maximum yacht length",
    anyYachtLength: "Any length",
    noMinimumYachtLength: "No minimum yacht length",
    noMaximumYachtLength: "No maximum yacht length",
    upTo: "Up to",
    metres: "m",
    crewSize: "Crew size",
    anyCrewSize: "Any",
    visas: "Visas",
    anyVisa: "Any visa",
    salary: "Salary",
    from: "From",
    currency: "Salary currency",
    payPeriod: "Salary period",
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
    minimumYachtLength: "Minimum yat uzunluğu",
    maximumYachtLength: "Maksimum yat uzunluğu",
    anyYachtLength: "Tüm uzunluklar",
    noMinimumYachtLength: "Minimum yat uzunluğu sınırı yok",
    noMaximumYachtLength: "Maksimum yat uzunluğu sınırı yok",
    upTo: "En fazla",
    metres: "m",
    crewSize: "Mürettebat sayısı",
    anyCrewSize: "Tümü",
    visas: "Vizeler",
    anyVisa: "Tüm vizeler",
    salary: "Maaş",
    from: "Başlangıç",
    currency: "Ücret para birimi",
    payPeriod: "Ücret dönemi",
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

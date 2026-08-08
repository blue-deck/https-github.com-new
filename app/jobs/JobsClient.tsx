"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
  Compass,
  Filter,
  LoaderCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { PublicFooter, PublicHeader } from "../components/PublicSiteChrome";
import { useLanguage } from "../components/LanguageProvider";
import { formatCountryWithFlag, nationalityOptions } from "../lib/countries";
import {
  formatJobCandidateType,
  formatJobEmploymentType,
  formatJobMinimumYachtExperience,
  formatJobRequiredLanguage,
  formatJobSmokerPolicy,
  formatJobVisa,
  formatJobVisibleTattooPolicy,
  formatJobYachtType,
  type PublicJobCard as ServerPublicJobCard,
} from "../lib/jobPosts";
import {
  createDefaultPublicJobSearchFilters,
  hasPublicJobSearchFilters,
  parsePublicJobSearchParams,
  publicJobPostedWithinOptions,
  publicJobSearchParams,
  type PublicJobSearchFilters,
  type PublicJobSearchSort,
} from "../lib/publicJobSearch";
import { publicJobSearchTaxonomy } from "../lib/publicJobSearchConfig";
import {
  parsePublicJobCards,
  type PublicJobCard,
} from "./job-data";
import { useJobListingViewer } from "./JobListingAction";
import {
  PublicJobListingCard,
  PublicJobListingSkeleton,
} from "./PublicJobListingCard";

type LoadState = "loading" | "ready" | "error";
type Language = "en" | "tr";
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
  const [hasMore, setHasMore] = useState(
    suppliedInitialPage?.hasMore || false,
  );
  const [requestVersion, setRequestVersion] = useState(0);
  const loadMoreController = useRef<AbortController | null>(null);

  const validationError = validateFilterRanges(filters, c);
  const serializedFilters = useMemo(
    () => publicJobSearchParams(filters).toString(),
    [filters],
  );
  const activeFilters = useMemo(
    () => buildActiveFilterChips(filters, language, c),
    [c, filters, language],
  );
  const hasFilters = hasPublicJobSearchFilters(filters);

  const optionSets = useMemo(
    () => buildOptionSets(language, c),
    [c, language],
  );

  useEffect(() => {
    function applyUrl(allowInitialPage: boolean) {
      const params = new URLSearchParams(window.location.search);

      // Preserve links created by the former client-side search implementation.
      if (!params.has("q") && params.has("query")) {
        params.set("q", params.get("query") || "");
      }
      params.delete("query");

      const parsed = parsePublicJobSearchParams(params, publicJobSearchTaxonomy);
      const nextFilters = parsed.ok
        ? parsed.filters
        : createDefaultPublicJobSearchFilters();

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
        allowInitialPage &&
          initialMatchesUrl &&
          initialLoadErrorRef.current,
      );

      requestSequence.current += 1;
      loadMoreController.current?.abort();
      setFilters(nextFilters);
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
        if (isAbortError(error) || requestId !== requestSequence.current) return;
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
    }, 300);

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

  function updateFilters(
    update: (current: PublicJobSearchFilters) => PublicJobSearchFilters,
  ) {
    requestSequence.current += 1;
    loadMoreController.current?.abort();
    setLoadMoreFailed(false);
    setRefreshing(true);
    setFilters(update);
  }

  function clearFilters() {
    setAdvancedOpen(false);
    updateFilters(() => createDefaultPublicJobSearchFilters());
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
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-800">
              <Compass className="h-4 w-4" aria-hidden />
              {c.eyebrow}
            </p>
            <h1 className="bd-serif mt-4 max-w-4xl text-4xl leading-[1.02] text-[#071f3c] sm:text-5xl lg:text-6xl">
              {c.title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#526b83]">
              {c.intro}
            </p>
          </div>
        </section>

        <section
          id="jobs-board"
          aria-label={c.results}
          className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10"
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
                {activeFilters.length > 0 ? (
                  <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] text-cyan-900">
                    {activeFilters.length}
                  </span>
                ) : null}
                <ChevronDown
                  className={`h-4 w-4 transition ${advancedOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.45fr_repeat(3,minmax(0,1fr))]">
              <TextField
                label={c.search}
                type="search"
                value={filters.query}
                maxLength={120}
                placeholder={c.searchPlaceholder}
                icon="search"
                onChange={(value) =>
                  updateFilters((current) => ({ ...current, query: value }))
                }
              />
              <MultiSelectField
                label={c.position}
                placeholder={c.allPositions}
                searchPlaceholder={c.searchPositions}
                selectedLabel={c.selected}
                emptyLabel={c.noOptions}
                options={optionSets.positions}
                values={filters.positions}
                maxSelections={12}
                onChange={(positions) =>
                  updateFilters((current) => ({ ...current, positions }))
                }
              />
              <TextField
                label={c.location}
                value={filters.location}
                maxLength={120}
                placeholder={c.locationPlaceholder}
                onChange={(value) =>
                  updateFilters((current) => ({ ...current, location: value }))
                }
              />
              <MultiSelectField
                label={c.employmentType}
                placeholder={c.allEmploymentTypes}
                selectedLabel={c.selected}
                emptyLabel={c.noOptions}
                options={optionSets.employmentTypes}
                values={filters.employmentTypes}
                onChange={(employmentTypes) =>
                  updateFilters((current) => ({
                    ...current,
                    employmentTypes: employmentTypes as PublicJobSearchFilters["employmentTypes"],
                  }))
                }
              />
            </div>

            {advancedOpen ? (
              <div
                id="advanced-job-filters"
                className="mt-5 border-t border-slate-200 pt-5"
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <FilterGroup title={c.roleAndContract}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MultiSelectField
                        label={c.department}
                        placeholder={c.allDepartments}
                        selectedLabel={c.selected}
                        emptyLabel={c.noOptions}
                        options={optionSets.departments}
                        values={filters.departments}
                        onChange={(departments) =>
                          updateFilters((current) => ({
                            ...current,
                            departments,
                          }))
                        }
                      />
                      <MultiSelectField
                        label={c.candidateType}
                        placeholder={c.allCandidateTypes}
                        selectedLabel={c.selected}
                        emptyLabel={c.noOptions}
                        options={optionSets.candidateTypes}
                        values={filters.candidateTypes}
                        onChange={(candidateTypes) =>
                          updateFilters((current) => ({
                            ...current,
                            candidateTypes: candidateTypes as PublicJobSearchFilters["candidateTypes"],
                          }))
                        }
                      />
                    </div>
                  </FilterGroup>

                  <FilterGroup title={c.yachtDetails}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MultiSelectField
                        label={c.yachtType}
                        placeholder={c.allYachtTypes}
                        selectedLabel={c.selected}
                        emptyLabel={c.noOptions}
                        options={optionSets.yachtTypes}
                        values={filters.yachtTypes}
                        onChange={(yachtTypes) =>
                          updateFilters((current) => ({
                            ...current,
                            yachtTypes: yachtTypes as PublicJobSearchFilters["yachtTypes"],
                          }))
                        }
                      />
                      <TextField
                        label={c.yachtBrand}
                        value={filters.yachtBrand}
                        maxLength={80}
                        placeholder={c.anyBrand}
                        onChange={(yachtBrand) =>
                          updateFilters((current) => ({
                            ...current,
                            yachtBrand,
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
                        values={filters.yachtFlagCountryCodes}
                        maxSelections={12}
                        onChange={(yachtFlagCountryCodes) =>
                          updateFilters((current) => ({
                            ...current,
                            yachtFlagCountryCodes,
                          }))
                        }
                      />
                      <MultiSelectField
                        label={c.minimumExperience}
                        placeholder={c.anyExperience}
                        selectedLabel={c.selected}
                        emptyLabel={c.noOptions}
                        options={optionSets.minimumExperiences}
                        values={filters.minimumYachtExperiences}
                        onChange={(minimumYachtExperiences) =>
                          updateFilters((current) => ({
                            ...current,
                            minimumYachtExperiences: minimumYachtExperiences as PublicJobSearchFilters["minimumYachtExperiences"],
                          }))
                        }
                      />
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <RangeField
                        label={c.yachtLength}
                        unit={c.metres}
                        minimum={filters.yachtLengthMinMetres}
                        maximum={filters.yachtLengthMaxMetres}
                        minValue={0.01}
                        maxValue={999}
                        step={0.01}
                        minLabel={c.minimum}
                        maxLabel={c.maximum}
                        onMinimumChange={(yachtLengthMinMetres) =>
                          updateFilters((current) => ({
                            ...current,
                            yachtLengthMinMetres,
                          }))
                        }
                        onMaximumChange={(yachtLengthMaxMetres) =>
                          updateFilters((current) => ({
                            ...current,
                            yachtLengthMaxMetres,
                          }))
                        }
                      />
                      <RangeField
                        label={c.buildYear}
                        minimum={filters.yachtBuildYearMin}
                        maximum={filters.yachtBuildYearMax}
                        minValue={1800}
                        maxValue={2100}
                        step={1}
                        minLabel={c.minimum}
                        maxLabel={c.maximum}
                        onMinimumChange={(yachtBuildYearMin) =>
                          updateFilters((current) => ({
                            ...current,
                            yachtBuildYearMin,
                          }))
                        }
                        onMaximumChange={(yachtBuildYearMax) =>
                          updateFilters((current) => ({
                            ...current,
                            yachtBuildYearMax,
                          }))
                        }
                      />
                      <RangeField
                        label={c.crewCount}
                        minimum={filters.crewMemberCountMin}
                        maximum={filters.crewMemberCountMax}
                        minValue={1}
                        maxValue={200}
                        step={1}
                        minLabel={c.minimum}
                        maxLabel={c.maximum}
                        onMinimumChange={(crewMemberCountMin) =>
                          updateFilters((current) => ({
                            ...current,
                            crewMemberCountMin,
                          }))
                        }
                        onMaximumChange={(crewMemberCountMax) =>
                          updateFilters((current) => ({
                            ...current,
                            crewMemberCountMax,
                          }))
                        }
                      />
                    </div>
                  </FilterGroup>

                  <FilterGroup className="lg:col-span-2" title={c.requirements}>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <MultiSelectField
                        label={c.languages}
                        placeholder={c.anyLanguage}
                        selectedLabel={c.selected}
                        emptyLabel={c.noOptions}
                        options={optionSets.languages}
                        values={filters.requiredLanguages}
                        onChange={(requiredLanguages) =>
                          updateFilters((current) => ({
                            ...current,
                            requiredLanguages: requiredLanguages as PublicJobSearchFilters["requiredLanguages"],
                          }))
                        }
                      />
                      <MultiSelectField
                        label={c.skills}
                        placeholder={c.anySkill}
                        searchPlaceholder={c.searchSkills}
                        selectedLabel={c.selected}
                        emptyLabel={c.noOptions}
                        options={optionSets.skills}
                        values={filters.requiredSkills}
                        onChange={(requiredSkills) =>
                          updateFilters((current) => ({
                            ...current,
                            requiredSkills: requiredSkills as PublicJobSearchFilters["requiredSkills"],
                          }))
                        }
                      />
                      <MultiSelectField
                        label={c.characteristics}
                        placeholder={c.anyCharacteristic}
                        searchPlaceholder={c.searchCharacteristics}
                        selectedLabel={c.selected}
                        emptyLabel={c.noOptions}
                        options={optionSets.characteristics}
                        values={filters.requiredCharacteristics}
                        onChange={(requiredCharacteristics) =>
                          updateFilters((current) => ({
                            ...current,
                            requiredCharacteristics: requiredCharacteristics as PublicJobSearchFilters["requiredCharacteristics"],
                          }))
                        }
                      />
                      <MultiSelectField
                        label={c.certificates}
                        placeholder={c.anyCertificate}
                        searchPlaceholder={c.searchCertificates}
                        selectedLabel={c.selected}
                        emptyLabel={c.noOptions}
                        options={optionSets.certificates}
                        values={filters.requiredCertificates}
                        onChange={(requiredCertificates) =>
                          updateFilters((current) => ({
                            ...current,
                            requiredCertificates: requiredCertificates as PublicJobSearchFilters["requiredCertificates"],
                          }))
                        }
                      />
                      <MultiSelectField
                        label={c.visas}
                        placeholder={c.anyVisa}
                        selectedLabel={c.selected}
                        emptyLabel={c.noOptions}
                        options={optionSets.visas}
                        values={filters.requiredVisas}
                        onChange={(requiredVisas) =>
                          updateFilters((current) => ({
                            ...current,
                            requiredVisas: requiredVisas as PublicJobSearchFilters["requiredVisas"],
                          }))
                        }
                      />
                      <MultiSelectField
                        label={c.smoking}
                        placeholder={c.anyPolicy}
                        selectedLabel={c.selected}
                        emptyLabel={c.noOptions}
                        options={optionSets.smokerPolicies}
                        values={filters.smokerPolicies}
                        onChange={(smokerPolicies) =>
                          updateFilters((current) => ({
                            ...current,
                            smokerPolicies: smokerPolicies as PublicJobSearchFilters["smokerPolicies"],
                          }))
                        }
                      />
                      <MultiSelectField
                        label={c.visibleTattoos}
                        placeholder={c.anyPolicy}
                        selectedLabel={c.selected}
                        emptyLabel={c.noOptions}
                        options={optionSets.tattooPolicies}
                        values={filters.visibleTattooPolicies}
                        onChange={(visibleTattooPolicies) =>
                          updateFilters((current) => ({
                            ...current,
                            visibleTattooPolicies: visibleTattooPolicies as PublicJobSearchFilters["visibleTattooPolicies"],
                          }))
                        }
                      />
                    </div>
                  </FilterGroup>

                  <FilterGroup title={c.dates}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextField
                        label={c.startFrom}
                        type="date"
                        value={filters.startDateFrom}
                        onChange={(startDateFrom) =>
                          updateFilters((current) => ({
                            ...current,
                            startDateFrom,
                          }))
                        }
                      />
                      <TextField
                        label={c.startTo}
                        type="date"
                        value={filters.startDateTo}
                        onChange={(startDateTo) =>
                          updateFilters((current) => ({
                            ...current,
                            startDateTo,
                          }))
                        }
                      />
                      <FilterSelect
                        label={c.published}
                        placeholder={c.anyTime}
                        value={filters.postedWithinDays?.toString() || ""}
                        options={publicJobPostedWithinOptions.map((days) => ({
                          value: String(days),
                          label: c.days(days),
                        }))}
                        onChange={(value) =>
                          updateFilters((current) => ({
                            ...current,
                            postedWithinDays: value ? Number(value) : null,
                          }))
                        }
                      />
                    </div>
                  </FilterGroup>

                  <FilterGroup title={c.salaryAndDisplay}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FilterSelect
                        label={c.currency}
                        placeholder={c.anyCurrency}
                        value={filters.salaryCurrency || ""}
                        options={optionSets.salaryCurrencies}
                        onChange={(value) =>
                          updateFilters((current) =>
                            clearSalaryDependency(current, {
                              salaryCurrency: (value || null) as PublicJobSearchFilters["salaryCurrency"],
                            }),
                          )
                        }
                      />
                      <FilterSelect
                        label={c.payPeriod}
                        placeholder={c.anyPeriod}
                        value={filters.salaryPeriod || ""}
                        options={optionSets.salaryPeriods}
                        onChange={(value) =>
                          updateFilters((current) =>
                            clearSalaryDependency(current, {
                              salaryPeriod: (value || null) as PublicJobSearchFilters["salaryPeriod"],
                            }),
                          )
                        }
                      />
                      <NumberField
                        label={c.minimumSalary}
                        value={filters.salaryMin}
                        min={0}
                        max={99_999_999.99}
                        step={0.01}
                        onChange={(salaryMin) =>
                          updateFilters((current) => ({
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
                        value={filters.salaryMax}
                        min={0}
                        max={99_999_999.99}
                        step={0.01}
                        onChange={(salaryMax) =>
                          updateFilters((current) => ({
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
                      <FilterSelect
                        label={c.pageSize}
                        placeholder={c.pageSize}
                        value={String(filters.limit)}
                        options={Array.from(
                          new Set([10, 20, 30, 50, filters.limit]),
                        )
                          .sort((left, right) => left - right)
                          .map((limit) => ({
                          value: String(limit),
                          label: c.perPage(limit),
                          }))}
                        onChange={(value) =>
                          updateFilters((current) => ({
                            ...current,
                            limit: Number(value),
                          }))
                        }
                      />
                    </div>
                  </FilterGroup>
                </div>
              </div>
            ) : null}

            {validationError ? (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
              >
                {validationError}
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
                    onClick={() => updateFilters((current) => chip.clear(current))}
                    aria-label={`${c.removeFilter}: ${chip.label}`}
                    className="bd-focus inline-flex min-h-8 items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-3 text-xs font-bold text-cyan-950 transition hover:border-cyan-400 hover:bg-cyan-100"
                  >
                    <span data-i18n-ignore>{chip.label}</span>
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="bd-focus min-h-8 px-2 text-xs font-black text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-cyan-900"
                >
                  {c.clear}
                </button>
              </div>
            ) : null}
          </section>

          <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
            <div aria-live="polite" aria-atomic="true">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-800">
                {c.results}
              </p>
              <h2
                id="jobs-results-heading"
                className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-[#071f3c]"
              >
                {refreshing && !validationError ? (
                  <span className="inline-flex items-center gap-2 text-xl text-slate-600">
                    <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
                    {c.updating}
                  </span>
                ) : (
                  <>
                    <span data-i18n-ignore>{total}</span> {c.roles}
                  </>
                )}
              </h2>
            </div>
            <FilterSelect
              compact
              label={c.sortBy}
              placeholder={c.sortBy}
              value={filters.sort}
              options={optionSets.sorts}
              onChange={(value) =>
                updateFilters((current) => ({
                  ...current,
                  sort: value as PublicJobSearchSort,
                  salaryCurrency:
                    value.startsWith("salary_") && !current.salaryCurrency
                      ? "EUR"
                      : current.salaryCurrency,
                  salaryPeriod:
                    value.startsWith("salary_") && !current.salaryPeriod
                      ? "month"
                      : current.salaryPeriod,
                }))
              }
            />
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
                  refreshing ? "pointer-events-none opacity-45" : ""
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
                    <p role="alert" className="mb-3 text-sm font-semibold text-rose-700">
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
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
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

function FilterGroup({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset
      className={`min-w-0 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 ${className}`}
    >
      <legend className="px-1 text-xs font-black uppercase tracking-[0.1em] text-cyan-900">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function TextField({
  label,
  value,
  type = "text",
  placeholder,
  maxLength,
  icon,
  onChange,
}: {
  label: string;
  value: string;
  type?: "text" | "search" | "date";
  placeholder?: string;
  maxLength?: number;
  icon?: "search";
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">
        {label}
      </span>
      <span className="relative block">
        {icon === "search" ? (
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-700"
            aria-hidden
          />
        ) : null}
        <input
          type={type}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 ${icon ? "pl-11" : ""}`}
        />
      </span>
    </label>
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
        className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
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
        {label}{unit ? ` (${unit})` : ""}
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
            className="min-h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
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
            className="min-h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
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
  onChange,
}: {
  label: string;
  value: string;
  options: readonly SelectOption[];
  placeholder: string;
  compact?: boolean;
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
        {!value ? <option value="">{placeholder}</option> : null}
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
      <details className="group relative">
        <summary
          aria-label={`${label}: ${selectionSummary}`}
          className="bd-focus flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-cyan-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 [&::-webkit-details-marker]:hidden"
        >
          <span className="min-w-0 truncate">
            {selectionSummary}
          </span>
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
                onChange={(event) => setSearch(event.target.value)}
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
      <BriefcaseBusiness className="mx-auto h-10 w-10 text-cyan-700" aria-hidden />
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
      payload.hasMore !== (parsedJobs.length < payload.total)) ||
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
    candidateTypes: publicJobSearchTaxonomy.candidateTypes.map((value) =>
      option(value, formatCandidateType(value, language)),
    ),
    yachtTypes: publicJobSearchTaxonomy.yachtTypes.map((value) =>
      option(value, formatJobYachtType(value, language)),
    ),
    flags: nationalityOptions.map(({ code }) =>
      option(code, formatCountryWithFlag(code) || code),
    ),
    minimumExperiences: publicJobSearchTaxonomy.minimumYachtExperiences.map(
      (value) => option(value, formatJobMinimumYachtExperience(value, language)),
    ),
    languages: publicJobSearchTaxonomy.requiredLanguages.map((value) =>
      option(value, formatJobRequiredLanguage(value, language)),
    ),
    skills: publicJobSearchTaxonomy.skills.map((value) => option(value)),
    characteristics: publicJobSearchTaxonomy.characteristics.map((value) =>
      option(value),
    ),
    certificates: publicJobSearchTaxonomy.certificates.map((value) =>
      option(value),
    ),
    visas: publicJobSearchTaxonomy.visas.map((value) =>
      option(value, formatJobVisa(value)),
    ),
    smokerPolicies: publicJobSearchTaxonomy.smokerPolicies.map((value) =>
      option(value, formatJobSmokerPolicy(value, language)),
    ),
    tattooPolicies: publicJobSearchTaxonomy.visibleTattooPolicies.map((value) =>
      option(value, formatJobVisibleTattooPolicy(value, language)),
    ),
    salaryCurrencies: publicJobSearchTaxonomy.salaryCurrencies.map((value) =>
      option(value),
    ),
    salaryPeriods: publicJobSearchTaxonomy.salaryPeriods.map((value) =>
      option(value, formatSalaryPeriod(value, language)),
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
  const add = (
    id: string,
    label: string,
    clear: ActiveFilterChip["clear"],
  ) => chips.push({ id, label, clear });

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
    add(`department-${value}`, formatDepartment(value, language), (current) => ({
      ...current,
      departments: current.departments.filter((item) => item !== value),
    })),
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
  filters.candidateTypes.forEach((value) =>
    add(`candidate-${value}`, formatCandidateType(value, language), (current) => ({
      ...current,
      candidateTypes: current.candidateTypes.filter((item) => item !== value),
    })),
  );
  filters.yachtTypes.forEach((value) =>
    add(`yacht-type-${value}`, formatJobYachtType(value, language), (current) => ({
      ...current,
      yachtTypes: current.yachtTypes.filter((item) => item !== value),
    })),
  );
  if (filters.yachtBrand) {
    add("yacht-brand", `${c.brandChip}: ${filters.yachtBrand}`, (current) => ({
      ...current,
      yachtBrand: "",
    }));
  }
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
    "year-min",
    filters.yachtBuildYearMin,
    `${c.buildYear} ≥`,
    "",
    (current) => ({ ...current, yachtBuildYearMin: null }),
  );
  addNumberChip(
    chips,
    "year-max",
    filters.yachtBuildYearMax,
    `${c.buildYear} ≤`,
    "",
    (current) => ({ ...current, yachtBuildYearMax: null }),
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

  filters.minimumYachtExperiences.forEach((value) =>
    add(
      `experience-${value}`,
      `${c.minimumExperience}: ${formatJobMinimumYachtExperience(value, language)}`,
      (current) => ({
        ...current,
        minimumYachtExperiences: current.minimumYachtExperiences.filter(
          (item) => item !== value,
        ),
      }),
    ),
  );
  filters.requiredLanguages.forEach((value) =>
    add(
      `language-${value}`,
      formatJobRequiredLanguage(value, language),
      (current) => ({
        ...current,
        requiredLanguages: current.requiredLanguages.filter(
          (item) => item !== value,
        ),
      }),
    ),
  );
  addStringListChips(chips, filters.requiredSkills, "skill", (current, value) => ({
    ...current,
    requiredSkills: current.requiredSkills.filter((item) => item !== value),
  }));
  addStringListChips(
    chips,
    filters.requiredCharacteristics,
    "trait",
    (current, value) => ({
      ...current,
      requiredCharacteristics: current.requiredCharacteristics.filter(
        (item) => item !== value,
      ),
    }),
  );
  addStringListChips(
    chips,
    filters.requiredCertificates,
    "certificate",
    (current, value) => ({
      ...current,
      requiredCertificates: current.requiredCertificates.filter(
        (item) => item !== value,
      ),
    }),
  );
  filters.requiredVisas.forEach((value) =>
    add(`visa-${value}`, formatJobVisa(value), (current) => ({
      ...current,
      requiredVisas: current.requiredVisas.filter((item) => item !== value),
    })),
  );
  filters.smokerPolicies.forEach((value) =>
    add(`smoker-${value}`, formatJobSmokerPolicy(value, language), (current) => ({
      ...current,
      smokerPolicies: current.smokerPolicies.filter((item) => item !== value),
    })),
  );
  filters.visibleTattooPolicies.forEach((value) =>
    add(
      `tattoo-${value}`,
      formatJobVisibleTattooPolicy(value, language),
      (current) => ({
        ...current,
        visibleTattooPolicies: current.visibleTattooPolicies.filter(
          (item) => item !== value,
        ),
      }),
    ),
  );

  if (filters.startDateFrom) {
    add("start-from", `${c.startFrom}: ${filters.startDateFrom}`, (current) => ({
      ...current,
      startDateFrom: "",
    }));
  }
  if (filters.startDateTo) {
    add("start-to", `${c.startTo}: ${filters.startDateTo}`, (current) => ({
      ...current,
      startDateTo: "",
    }));
  }
  if (filters.postedWithinDays !== null) {
    add(
      "posted-within",
      c.days(filters.postedWithinDays),
      (current) => ({ ...current, postedWithinDays: null }),
    );
  }
  if (filters.salaryCurrency) {
    add("salary-currency", filters.salaryCurrency, (current) =>
      clearSalaryDependency(current, { salaryCurrency: null }),
    );
  }
  if (filters.salaryPeriod) {
    add(
      "salary-period",
      formatSalaryPeriod(filters.salaryPeriod, language),
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

function addStringListChips(
  chips: ActiveFilterChip[],
  values: readonly string[],
  prefix: string,
  clear: (filters: PublicJobSearchFilters, value: string) => PublicJobSearchFilters,
) {
  values.forEach((value) =>
    chips.push({
      id: `${prefix}-${value}`,
      label: value,
      clear: (filters) => clear(filters, value),
    }),
  );
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

function validateFilterRanges(
  filters: PublicJobSearchFilters,
  c: SearchCopy,
) {
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
    outside(filters.yachtBuildYearMin, 1800, 2100, true) ||
    outside(filters.yachtBuildYearMax, 1800, 2100, true) ||
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
    reversed(filters.yachtBuildYearMin, filters.yachtBuildYearMax) ||
    reversed(filters.crewMemberCountMin, filters.crewMemberCountMax) ||
    reversed(filters.salaryMin, filters.salaryMax) ||
    (filters.startDateFrom &&
      filters.startDateTo &&
      filters.startDateFrom > filters.startDateTo)
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
  return Boolean(
    filters.departments.length ||
      filters.candidateTypes.length ||
      filters.yachtTypes.length ||
      filters.yachtBrand ||
      filters.yachtFlagCountryCodes.length ||
      filters.yachtLengthMinMetres !== null ||
      filters.yachtLengthMaxMetres !== null ||
      filters.yachtBuildYearMin !== null ||
      filters.yachtBuildYearMax !== null ||
      filters.crewMemberCountMin !== null ||
      filters.crewMemberCountMax !== null ||
      filters.minimumYachtExperiences.length ||
      filters.requiredLanguages.length ||
      filters.requiredSkills.length ||
      filters.requiredCharacteristics.length ||
      filters.requiredCertificates.length ||
      filters.requiredVisas.length ||
      filters.smokerPolicies.length ||
      filters.visibleTattooPolicies.length ||
      filters.startDateFrom ||
      filters.startDateTo ||
      filters.postedWithinDays !== null ||
      filters.salaryCurrency ||
      filters.salaryPeriod ||
      filters.salaryMin !== null ||
      filters.salaryMax !== null ||
      filters.limit !== createDefaultPublicJobSearchFilters().limit
  );
}

function formatCandidateType(
  value: PublicJobSearchFilters["candidateTypes"][number],
  language: Language,
) {
  if (value === "individual") {
    return language === "tr" ? "Bireysel" : "Individual";
  }
  return formatJobCandidateType(value, language);
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

function formatSalaryPeriod(value: string, language: Language) {
  const labels: Record<string, { en: string; tr: string }> = {
    day: { en: "Per day", tr: "Günlük" },
    week: { en: "Per week", tr: "Haftalık" },
    month: { en: "Per month", tr: "Aylık" },
    year: { en: "Per year", tr: "Yıllık" },
  };
  return labels[value]?.[language] || value;
}

function readNullableNumber(value: string) {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
    page.hasMore === (page.jobs.length < page.total) &&
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
    eyebrow: "Open yacht roles",
    title: "Your next role may already be on deck.",
    intro:
      "Search every detail employers publish, from vessel specifications and start dates to certificates, visas and working preferences.",
    filters: "Search and filters",
    filterHint: "Choose multiple options to broaden a category; categories work together.",
    search: "Keyword",
    searchPlaceholder: "Role, requirement, yacht or listing number",
    position: "Position",
    allPositions: "All positions",
    searchPositions: "Search positions",
    location: "Location",
    locationPlaceholder: "City, marina or cruising area",
    employmentType: "Employment",
    allEmploymentTypes: "All employment types",
    advanced: "Advanced filters",
    activeFilters: "Active",
    removeFilter: "Remove filter",
    selected: "selected",
    noOptions: "No options found",
    roleAndContract: "Role and contract",
    department: "Department",
    allDepartments: "All departments",
    candidateType: "Candidate type",
    allCandidateTypes: "All candidate types",
    yachtDetails: "Yacht and experience",
    yachtType: "Yacht type",
    allYachtTypes: "All yacht types",
    yachtBrand: "Yacht brand",
    anyBrand: "Any brand",
    yachtFlag: "Yacht flag",
    anyFlag: "Any flag",
    searchFlags: "Search flags",
    yachtLength: "Yacht length",
    metres: "m",
    buildYear: "Build year",
    crewCount: "Crew size",
    minimumExperience: "Minimum yacht experience",
    anyExperience: "Any experience",
    minimum: "Min",
    maximum: "Max",
    requirements: "Published requirements",
    languages: "Languages",
    anyLanguage: "Any language",
    skills: "Skills",
    anySkill: "Any skill",
    searchSkills: "Search skills",
    characteristics: "Characteristics",
    anyCharacteristic: "Any characteristic",
    searchCharacteristics: "Search characteristics",
    certificates: "Certificates",
    anyCertificate: "Any certificate",
    searchCertificates: "Search certificates",
    visas: "Visas",
    anyVisa: "Any visa",
    smoking: "Smoking policy",
    visibleTattoos: "Visible tattoo policy",
    anyPolicy: "Any policy",
    dates: "Dates and recency",
    startFrom: "Start date from",
    startTo: "Start date to",
    published: "Published",
    anyTime: "Any time",
    days: (days: number) => `Last ${days} days`,
    salaryAndDisplay: "Salary and display",
    currency: "Salary currency",
    anyCurrency: "Any currency",
    payPeriod: "Salary period",
    anyPeriod: "Any period",
    minimumSalary: "Minimum salary",
    maximumSalary: "Maximum salary",
    pageSize: "Results per page",
    perPage: (count: number) => `${count} per page`,
    results: "Current opportunities",
    roles: "open roles",
    updating: "Updating results…",
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
    brandChip: "Brand",
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
    noMatchesText: "Remove one or more filters to explore the other open roles.",
    loadMore: "Load more roles",
    loadingMore: "Loading more…",
    loadMoreError: "More roles could not be loaded. Please try again.",
    shown: "shown",
  },
  tr: {
    eyebrow: "Açık yat pozisyonları",
    title: "Sıradaki göreviniz güvertede sizi bekliyor olabilir.",
    intro:
      "İşverenlerin yayınladığı yat özelliklerinden başlangıç tarihlerine, sertifikalardan vize ve çalışma tercihlerine kadar her ayrıntıda arayın.",
    filters: "Arama ve filtreler",
    filterHint: "Bir kategoride birden fazla seçenek seçilebilir; kategoriler birlikte çalışır.",
    search: "Anahtar kelime",
    searchPlaceholder: "Pozisyon, gereklilik, yat veya ilan numarası",
    position: "Pozisyon",
    allPositions: "Tüm pozisyonlar",
    searchPositions: "Pozisyon ara",
    location: "Konum",
    locationPlaceholder: "Şehir, marina veya seyir bölgesi",
    employmentType: "Çalışma biçimi",
    allEmploymentTypes: "Tüm çalışma biçimleri",
    advanced: "Gelişmiş filtreler",
    activeFilters: "Etkin",
    removeFilter: "Filtreyi kaldır",
    selected: "seçili",
    noOptions: "Seçenek bulunamadı",
    roleAndContract: "Pozisyon ve sözleşme",
    department: "Departman",
    allDepartments: "Tüm departmanlar",
    candidateType: "Aday türü",
    allCandidateTypes: "Tüm aday türleri",
    yachtDetails: "Yat ve deneyim",
    yachtType: "Yat türü",
    allYachtTypes: "Tüm yat türleri",
    yachtBrand: "Yat markası",
    anyBrand: "Tüm markalar",
    yachtFlag: "Yat bayrağı",
    anyFlag: "Tüm bayraklar",
    searchFlags: "Bayrak ara",
    yachtLength: "Yat uzunluğu",
    metres: "m",
    buildYear: "Yapım yılı",
    crewCount: "Mürettebat sayısı",
    minimumExperience: "Minimum yat deneyimi",
    anyExperience: "Tüm deneyim düzeyleri",
    minimum: "Min",
    maximum: "Maks",
    requirements: "Yayınlanan gereklilikler",
    languages: "Diller",
    anyLanguage: "Tüm diller",
    skills: "Beceriler",
    anySkill: "Tüm beceriler",
    searchSkills: "Beceri ara",
    characteristics: "Kişisel özellikler",
    anyCharacteristic: "Tüm özellikler",
    searchCharacteristics: "Özellik ara",
    certificates: "Sertifikalar",
    anyCertificate: "Tüm sertifikalar",
    searchCertificates: "Sertifika ara",
    visas: "Vizeler",
    anyVisa: "Tüm vizeler",
    smoking: "Sigara politikası",
    visibleTattoos: "Görünür dövme politikası",
    anyPolicy: "Tüm politikalar",
    dates: "Tarih ve güncellik",
    startFrom: "Başlangıç tarihi — en erken",
    startTo: "Başlangıç tarihi — en geç",
    published: "Yayınlanma",
    anyTime: "Tüm zamanlar",
    days: (days: number) => `Son ${days} gün`,
    salaryAndDisplay: "Ücret ve görünüm",
    currency: "Ücret para birimi",
    anyCurrency: "Tüm para birimleri",
    payPeriod: "Ücret dönemi",
    anyPeriod: "Tüm dönemler",
    minimumSalary: "Minimum ücret",
    maximumSalary: "Maksimum ücret",
    pageSize: "Sayfa başına sonuç",
    perPage: (count: number) => `Sayfa başına ${count}`,
    results: "Güncel fırsatlar",
    roles: "açık pozisyon",
    updating: "Sonuçlar güncelleniyor…",
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
    brandChip: "Marka",
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
    noMatchesText: "Diğer açık pozisyonları görmek için bir veya daha fazla filtreyi kaldırın.",
    loadMore: "Daha fazla ilan yükle",
    loadingMore: "Daha fazlası yükleniyor…",
    loadMoreError: "Diğer ilanlar yüklenemedi. Lütfen tekrar deneyin.",
    shown: "gösteriliyor",
  },
} as const;

type SearchCopy = (typeof copy)[keyof typeof copy];

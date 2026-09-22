"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { publicJobSearchTaxonomy } from "../lib/publicJobSearchConfig";
import { LocationSearchField } from "./LocationSearchField";

type Language = "en" | "tr";
type SelectOption = { value: string; label: string };

const jobMultiSelectSelector = 'details[data-job-multi-select="true"]';
const jobPositionSelectOptions = publicJobSearchTaxonomy.positions.map(
  (value) => ({ value, label: value }),
);

export const jobPrimarySearchCopy = {
  en: {
    search: "Keyword",
    searchPlaceholder: "Position, location, yacht type or any",
    searchKeyword: "Search this keyword",
    position: "Position",
    allPositions: "All positions",
    searchPositions: "Search positions",
    location: "Location",
    locationPlaceholder: "Search location",
    locationSearching: "Searching locations…",
    locationNoResults:
      "No matching location found. You can keep your own text.",
    locationResults: "location options available.",
    selected: "selected",
    noOptions: "No options found",
  },
  tr: {
    search: "Anahtar kelime",
    searchPlaceholder: "Pozisyon, beceri, dil veya herhangi bir anahtar kelime",
    searchKeyword: "Bu anahtar kelimeyi ara",
    position: "Pozisyon",
    allPositions: "Tüm pozisyonlar",
    searchPositions: "Pozisyon ara",
    location: "Konum",
    locationPlaceholder: "Konum ara",
    locationSearching: "Konumlar aranıyor…",
    locationNoResults:
      "Eşleşen konum bulunamadı. Yazdığınız konumu kullanabilirsiniz.",
    locationResults: "konum seçeneği bulundu.",
    selected: "seçili",
    noOptions: "Seçenek bulunamadı",
  },
} as const;

export function JobKeywordSearchField({
  language,
  value,
  onChange,
  onKeywordSearch,
  inputId,
}: {
  language: Language;
  value: string;
  onChange: (value: string) => void;
  onKeywordSearch: () => void;
  inputId?: string;
}) {
  const c = jobPrimarySearchCopy[language];
  const generatedId = useId();
  const resolvedInputId = inputId ?? `${generatedId}-job-keyword`;
  return (
    <div className="block min-w-0">
      <label
        htmlFor={resolvedInputId}
        className="mb-1.5 block text-xs font-bold text-slate-600"
      >
        {c.search}
      </label>
      <span className="relative block">
        <input
          id={resolvedInputId}
          type="search"
          value={value}
          onChange={(event) =>
            onChange(capitalizeJobSearchInput(event.target.value, language))
          }
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            onKeywordSearch();
          }}
          placeholder={c.searchPlaceholder}
          maxLength={120}
          className="min-h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-14 text-sm font-semibold text-slate-950 outline-none transition [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
        />
        <button
          type="button"
          onClick={onKeywordSearch}
          aria-label={c.searchKeyword}
          title={c.searchKeyword}
          className="bd-focus absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-cyan-700 transition hover:bg-cyan-50 hover:text-cyan-950"
        >
          <Search className="h-5 w-5" aria-hidden />
        </button>
      </span>
    </div>
  );
}

export function JobPositionSearchField({
  language,
  values,
  onChange,
}: {
  language: Language;
  values: readonly string[];
  onChange: (values: string[]) => void;
}) {
  const c = jobPrimarySearchCopy[language];
  useJobMultiSelectDismiss();
  return (
    <MultiSelectField
      label={c.position}
      placeholder={c.allPositions}
      searchPlaceholder={c.searchPositions}
      selectedLabel={c.selected}
      emptyLabel={c.noOptions}
      options={jobPositionSelectOptions}
      values={values}
      maxSelections={12}
      capitalizeSearch
      searchLocale={language}
      onChange={onChange}
    />
  );
}

export function JobLocationSearchField({
  language,
  value,
  onChange,
}: {
  language: Language;
  value: string;
  onChange: (value: string) => void;
}) {
  const c = jobPrimarySearchCopy[language];
  return (
    <LocationSearchField
      label={c.location}
      ariaLabel={c.location}
      value={value}
      placeholder={c.locationPlaceholder}
      searchingText={c.locationSearching}
      noResultsText={c.locationNoResults}
      resultsText={c.locationResults}
      maxLength={120}
      className="relative min-w-0"
      labelClassName="mb-1.5 block text-xs font-bold text-slate-600"
      popupClassName="absolute left-0 top-full z-50 w-full min-w-64"
      popupListClassName="max-h-72 overflow-y-auto overscroll-contain"
      onChange={onChange}
    />
  );
}

function useJobMultiSelectDismiss() {
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

}

export function MultiSelectField({
  label,
  placeholder,
  searchPlaceholder,
  selectedLabel,
  emptyLabel,
  options,
  values,
  maxSelections,
  dense = false,
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
  dense?: boolean;
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
          className={`bd-focus flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-cyan-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 [&::-webkit-details-marker]:hidden ${dense ? "min-h-11" : "min-h-12"}`}
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
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
                onChange={(event) =>
                  setSearch(
                    capitalizeSearch
                      ? capitalizeJobSearchInput(event.target.value, searchLocale)
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

export function closeOpenJobMultiSelects(except?: HTMLDetailsElement) {
  document
    .querySelectorAll<HTMLDetailsElement>(`${jobMultiSelectSelector}[open]`)
    .forEach((details) => {
      if (details !== except) details.open = false;
    });
}

export function capitalizeJobSearchInput(value: string, language: Language) {
  const firstLetter = value.match(/\p{L}/u);
  if (!firstLetter || firstLetter.index === undefined) return value;
  const index = firstLetter.index;
  const letter = firstLetter[0];
  const locale = language === "tr" ? "tr-TR" : "en-US";
  return `${value.slice(0, index)}${letter.toLocaleUpperCase(locale)}${value.slice(index + letter.length)}`;
}


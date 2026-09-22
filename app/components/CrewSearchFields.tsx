"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  NATIONALITY_CONTROL_SIZE_CLASS_NAME,
  NationalitySearchField,
} from "./NationalitySearchField";
import { maximumCrewPositionSelections } from "../lib/crewSearch";
import { capitalizeInitialInput } from "../lib/inputText";
import type { Language } from "../lib/i18n";
import { publicJobSearchTaxonomy } from "../lib/publicJobSearchConfig";

export const crewPrimarySearchCopy = {
  en: {
    search: "Keyword",
    keywordSearchAction: "Search keyword",
    searchPlaceholder: "Position, skills, language or any",
    position: "Position",
    allPositions: "All positions",
    searchPositions: "Search positions",
    selected: "selected",
    noOptions: "No options found",
    nationalityFilter: "Nationality",
  },
  tr: {
    search: "Anahtar kelime",
    keywordSearchAction: "Anahtar kelimeyi ara",
    searchPlaceholder: "Pozisyon, beceri, dil veya diğer",
    position: "Pozisyon",
    allPositions: "Tüm pozisyonlar",
    searchPositions: "Pozisyon ara",
    selected: "seçili",
    noOptions: "Seçenek bulunamadı",
    nationalityFilter: "Uyruklar",
  },
} as const;

export const crewFilterControlSurfaceClassName = `${NATIONALITY_CONTROL_SIZE_CLASS_NAME} rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-950 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100`;
const crewPositionMultiSelectSelector =
  'details[data-crew-position-multi-select="true"]';
type SelectOption = { value: string; label: string };
const crewPositionSelectOptions: readonly SelectOption[] =
  publicJobSearchTaxonomy.positions.map((value) => ({ value, label: value }));

export function CrewKeywordSearchField({
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
  const generatedId = useId();
  const id = inputId ?? `${generatedId}-crew-keyword-search`;
  const c = crewPrimarySearchCopy[language];

  return (
    <div className="block min-w-0">
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-bold text-slate-600"
      >
        {c.search}
      </label>
      <span className="relative block min-w-0">
        <input
          id={id}
          type="search"
          value={value}
          onChange={(event) =>
            onChange(capitalizeInitialInput(event.target.value, language))
          }
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            onKeywordSearch();
          }}
          placeholder={c.searchPlaceholder}
          maxLength={120}
          autoCapitalize="sentences"
          className={`${NATIONALITY_CONTROL_SIZE_CLASS_NAME} appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-12 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-[clamp(0.72rem,3.6vw,0.875rem)] placeholder:font-normal placeholder:tracking-[-0.01em] [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100`}
        />
        <button
          type="button"
          onClick={onKeywordSearch}
          aria-label={c.keywordSearchAction}
          title={c.keywordSearchAction}
          className="bd-focus absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-cyan-700 transition hover:bg-cyan-50 hover:text-cyan-950"
        >
          <Search className="h-5 w-5" aria-hidden />
        </button>
      </span>
    </div>
  );
}

export function CrewPositionSearchField({
  language,
  values,
  onChange,
}: {
  language: Language;
  values: readonly string[];
  onChange: (values: string[]) => void;
}) {
  const c = crewPrimarySearchCopy[language];

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

  return (
    <PositionMultiSelectField
      label={c.position}
      placeholder={c.allPositions}
      searchPlaceholder={c.searchPositions}
      selectedLabel={c.selected}
      emptyLabel={c.noOptions}
      options={crewPositionSelectOptions}
      values={values}
      maxSelections={maximumCrewPositionSelections}
      searchLocale={language}
      onChange={onChange}
    />
  );
}

export function CrewNationalitySearchField({
  language,
  value,
  onChange,
}: {
  language: Language;
  value: string;
  onChange: (value: string) => void;
}) {
  const c = crewPrimarySearchCopy[language];

  return (
    <NationalitySearchField
      label={c.nationalityFilter}
      value={value}
      onChange={onChange}
      placeholder={c.nationalityFilter}
    />
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
          className={`${crewFilterControlSurfaceClassName} relative flex cursor-pointer list-none items-center pl-4 pr-12 hover:border-cyan-400 [&::-webkit-details-marker]:hidden`}
        >
          <span className="min-w-0 flex-1 truncate">{selectionSummary}</span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-1 top-1/2 flex h-10 w-9 -translate-y-1/2 items-center justify-center text-cyan-700"
          >
            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
          </span>
        </summary>
        <div className="absolute left-0 z-40 mt-2 w-full min-w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-950/10">
          <label className="mb-2 block">
            <span className="sr-only">{searchPlaceholder}</span>
            <input
              type="search"
              value={search}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
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

export function closeOpenCrewPositionMultiSelects(except?: HTMLDetailsElement) {
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


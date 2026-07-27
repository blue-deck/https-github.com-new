"use client";

import { MapPin } from "lucide-react";
import { nationalityOptions } from "../lib/countries";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

type LocationSuggestion = {
  key: string;
  label: string;
  detail: string;
};

type OpenMeteoSearchResponse = {
  results?: Array<{
    id: number;
    name: string;
    country?: string;
    admin1?: string;
    admin2?: string;
  }>;
};

export type LocationSearchFieldProps = {
  label: ReactNode;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchingText: string;
  noResultsText: string;
  resultsText?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
};

const defaultLabelClassName =
  "mb-1.5 block select-text text-xs font-semibold leading-4 text-slate-700";
const defaultInputClassName =
  "h-full min-w-0 flex-1 px-3 py-0 text-base font-medium text-slate-950 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-65 sm:text-sm";

export function LocationSearchField({
  label,
  ariaLabel,
  value,
  onChange,
  placeholder,
  searchingText,
  noResultsText,
  resultsText = "location options available.",
  disabled = false,
  required = false,
  maxLength,
  className = "",
  labelClassName = defaultLabelClassName,
  inputClassName = defaultInputClassName,
}: LocationSearchFieldProps) {
  const generatedId = useId();
  const inputId = `${generatedId}-location`;
  const listboxId = `${generatedId}-location-results`;
  const statusId = `${generatedId}-location-status`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const trimmedQuery = query.trim();
  const searchComplete =
    (trimmedQuery.length >= 3 || Boolean(exactCountrySuggestion(trimmedQuery))) &&
    searchedQuery === trimmedQuery;
  const noResults = searchComplete && !searching && suggestions.length === 0;
  const popupVisible =
    open && !disabled && (searching || suggestions.length > 0 || noResults);
  const listboxVisible = open && !disabled && suggestions.length > 0;

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!open || disabled) return;

    const exactCountry = exactCountrySuggestion(trimmedQuery);
    if (exactCountry) {
      setSuggestions([exactCountry]);
      setSearchedQuery(trimmedQuery);
      setSearching(false);
      setActiveIndex(-1);
      return;
    }
    if (trimmedQuery.length < 3) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      setSearchedQuery("");

      try {
        const response = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmedQuery)}&count=8&language=en&format=json`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("location_search_failed");

        const data = (await response.json()) as OpenMeteoSearchResponse;
        const seen = new Set<string>();
        const cleanResults = (data.results || []).flatMap((item) => {
          const country = cleanLocationCountry(item.country);
          const label = [item.name, country].filter(Boolean).join(", ");
          const detail = [item.admin1, item.admin2]
            .filter(
              (part) =>
                part && part !== item.name && part !== country,
            )
            .join(" · ");
          const identity = `${label}\n${detail}`;

          if (!label || seen.has(identity)) return [];
          seen.add(identity);
          return [
            {
              key: `${item.id}-${identity}`,
              label,
              detail,
            },
          ];
        });

        setSuggestions(
          mergeLocationSuggestions(
            countrySuggestions(trimmedQuery),
            cleanResults,
          ),
        );
        setSearchedQuery(trimmedQuery);
        setActiveIndex(-1);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setSearchedQuery(trimmedQuery);
          setActiveIndex(-1);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [disabled, open, trimmedQuery]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) closePopup();
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function closePopup() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function selectSuggestion(suggestion: LocationSuggestion) {
    const nextValue =
      typeof maxLength === "number"
        ? suggestion.label.slice(0, maxLength)
        : suggestion.label;
    setQuery(nextValue);
    onChange(nextValue);
    setSuggestions([]);
    setSearchedQuery("");
    closePopup();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (open) event.preventDefault();
      closePopup();
      return;
    }

    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        current < suggestions.length - 1 ? current + 1 : 0,
      );
      return;
    }

    if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        current > 0 ? current - 1 : suggestions.length - 1,
      );
      return;
    }

    if (
      event.key === "Enter" &&
      activeIndex >= 0 &&
      suggestions[activeIndex]
    ) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      closePopup();
    }
  }

  const activeOptionId =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;
  const statusText = searching
    ? searchingText
    : noResults
      ? noResultsText
      : suggestions.length > 0
        ? `${suggestions.length} ${resultsText}`
        : "";

  return (
    <div
      ref={wrapperRef}
      className={`block ${className}`}
      onBlur={handleBlur}
    >
      <label htmlFor={inputId} className={labelClassName}>
        {label}
      </label>
      <div className="flex h-12 overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/15">
        <span className="flex items-center pl-3 text-cyan-700">
          <MapPin className="h-4 w-4" aria-hidden />
        </span>
        <input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxVisible ? listboxId : undefined}
          aria-describedby={statusId}
          aria-expanded={listboxVisible}
          aria-activedescendant={listboxVisible ? activeOptionId : undefined}
          autoComplete="off"
          value={query}
          required={required}
          disabled={disabled}
          maxLength={maxLength}
          onFocus={() => {
            setOpen(true);
            setActiveIndex(-1);
            if (query.trim().length < 3) {
              setSuggestions([]);
              setSearchedQuery("");
              setSearching(false);
            }
          }}
          onKeyDown={handleKeyDown}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            onChange(nextQuery);
            setOpen(true);
            setActiveIndex(-1);
            setSuggestions([]);
            setSearchedQuery("");
            if (nextQuery.trim().length < 3) setSearching(false);
          }}
          placeholder={placeholder}
          className={inputClassName}
        />
      </div>

      {popupVisible ? (
        <div
          className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10"
        >
          {searching ? (
            <p className="px-3 py-2 text-sm text-slate-500">
              {searchingText}
            </p>
          ) : null}
          {!searching && noResults ? (
            <p className="px-3 py-2 text-sm text-slate-500">
              {noResultsText}
            </p>
          ) : null}
          {suggestions.length > 0 ? (
            <div
              id={listboxId}
              role="listbox"
              aria-label={
                ariaLabel || (typeof label === "string" ? label : placeholder)
              }
            >
              {suggestions.map((location, index) => (
                <button
                  id={`${listboxId}-option-${index}`}
                  key={location.key}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  tabIndex={-1}
                  onMouseMove={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSuggestion(location)}
                  className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 last:border-b-0 hover:bg-cyan-50 ${
                    activeIndex === index ? "bg-cyan-50" : ""
                  }`}
                >
                  <span
                    data-i18n-ignore
                    className="block font-semibold text-slate-900"
                  >
                    {location.label}
                  </span>
                  {location.detail ? (
                    <span
                      data-i18n-ignore
                      className="block text-xs text-slate-500"
                    >
                      {location.detail}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <span id={statusId} className="sr-only" role="status" aria-live="polite">
        {statusText}
      </span>
    </div>
  );
}

export function cleanLocationCountry(country?: string) {
  if (!country) return "";
  const replacements: Record<string, string> = {
    "Republic of Turkey": "Turkey",
    "Republic of Türkiye": "Turkey",
    Türkiye: "Turkey",
    "United States of America": "United States",
    "Russian Federation": "Russia",
    "United Kingdom of Great Britain and Northern Ireland": "United Kingdom",
    "United Arab Emirates": "UAE",
  };

  if (replacements[country]) return replacements[country];
  return country
    .replace(/^Republic of /, "")
    .replace(/^Kingdom of /, "")
    .replace(/^State of /, "")
    .replace(/^Commonwealth of /, "")
    .trim();
}

function countrySuggestions(query: string): LocationSuggestion[] {
  const normalizedQuery = normalizeLocationSearchText(query);
  if (!normalizedQuery) return [];

  return nationalityOptions
    .filter((country) =>
      countrySearchTerms(country.code, country.country).some((term) =>
        term.startsWith(normalizedQuery),
      ),
    )
    .slice(0, 4)
    .map((country) => ({
      key: `country-${country.code}`,
      label: cleanLocationCountry(country.country),
      detail: "",
    }));
}

function exactCountrySuggestion(query: string) {
  const normalizedQuery = normalizeLocationSearchText(query);
  const country = nationalityOptions.find((item) =>
    countrySearchTerms(item.code, item.country).includes(normalizedQuery),
  );
  if (!country) return undefined;

  return {
    key: `country-${country.code}`,
    label: cleanLocationCountry(country.country),
    detail: "",
  } satisfies LocationSuggestion;
}

function countrySearchTerms(code: string, country: string) {
  const terms = [code, country];
  if (code === "TR") terms.push("Turkey", "Türkiye");
  return terms.map(normalizeLocationSearchText);
}

function normalizeLocationSearchText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ı/g, "i");
}

function mergeLocationSuggestions(
  countryResults: LocationSuggestion[],
  remoteResults: LocationSuggestion[],
) {
  const seen = new Set<string>();
  return [...countryResults, ...remoteResults].filter((suggestion) => {
    const identity = `${suggestion.label}\n${suggestion.detail}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

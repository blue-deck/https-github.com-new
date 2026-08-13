"use client";

import { Check, ChevronDown, X } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  canonicalNationalityValue,
  countryNameForLanguage,
  countryOptionFromNationalityValue,
  nationalityStorageValue,
  searchNationalityOptions,
  type BlueDeckNationalityOption,
} from "../lib/countries";
import { useLanguage } from "./LanguageProvider";

const defaultLabelClassName =
  "mb-1.5 block text-xs font-bold text-slate-600";
const defaultControlClassName =
  "min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100";

export function NationalitySearchField({
  label,
  value,
  onChange,
  placeholder,
  className = "",
  labelClassName = defaultLabelClassName,
  controlClassName = defaultControlClassName,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  labelClassName?: string;
  controlClassName?: string;
}) {
  const { language } = useLanguage();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousLanguageRef = useRef(language);
  const generatedId = useId();
  const inputId = `${generatedId}-nationality-input`;
  const listboxId = `${generatedId}-nationality-listbox`;
  const statusId = `${generatedId}-nationality-status`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const selectedCountry = countryOptionFromNationalityValue(value);
  const selectedName = selectedCountry
    ? countryNameForLanguage(selectedCountry, language)
    : value;
  const visibleCountries = useMemo(
    () => searchNationalityOptions(query, language),
    [language, query],
  );
  const c = nationalitySearchCopy[language];

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (wrapperRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setQuery("");
      setActiveIndex(-1);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document
      .getElementById(`${listboxId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listboxId, open]);

  useEffect(() => {
    if (previousLanguageRef.current === language) return;
    previousLanguageRef.current = language;
    if (open) {
      setQuery(selectedName);
      setActiveIndex(0);
    }
  }, [language, open, selectedName]);

  function closePicker() {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }

  function openPicker(showAllCountries = false) {
    const canonicalValue = canonicalNationalityValue(value);
    if (selectedCountry && canonicalValue !== value) {
      onChange(canonicalValue);
    }
    const nextQuery = showAllCountries ? "" : selectedName;
    setOpen(true);
    setQuery(nextQuery);
    setActiveIndex(0);
  }

  function selectCountry(country: BlueDeckNationalityOption) {
    onChange(nationalityStorageValue(country));
    closePicker();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (open) event.preventDefault();
      closePicker();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!visibleCountries.length) return;
      event.preventDefault();
      if (!open) openPicker(true);
      setActiveIndex((current) => {
        if (event.key === "ArrowDown") {
          return current < visibleCountries.length - 1 ? current + 1 : 0;
        }
        return current > 0 ? current - 1 : visibleCountries.length - 1;
      });
      return;
    }

    if (event.key === "Home" && open && visibleCountries.length) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End" && open && visibleCountries.length) {
      event.preventDefault();
      setActiveIndex(visibleCountries.length - 1);
      return;
    }

    if (event.key === "Enter" && open && activeIndex >= 0) {
      const activeCountry = visibleCountries[activeIndex];
      if (!activeCountry) return;
      event.preventDefault();
      selectCountry(activeCountry);
    }
  }

  return (
    <div ref={wrapperRef} className={`relative block ${className}`.trim()}>
      <label htmlFor={inputId} className={labelClassName}>
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          data-i18n-ignore
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && activeIndex >= 0
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          aria-describedby={statusId}
          autoComplete="off"
          spellCheck={false}
          value={open ? query : selectedName}
          placeholder={placeholder ?? c.placeholder}
          onFocus={(event) => {
            const input = event.currentTarget;
            if (!open) openPicker();
            window.requestAnimationFrame(() => input.select());
          }}
          onChange={(event) => {
            setOpen(true);
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className={`${controlClassName} pr-20`}
        />

        {value ? (
          <button
            type="button"
            aria-label={c.clear}
            title={c.clear}
            data-i18n-ignore
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange("");
              closePicker();
              inputRef.current?.focus();
            }}
            className="bd-focus absolute right-10 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}

        <button
          type="button"
          aria-label={open ? c.close : c.open}
          title={open ? c.close : c.open}
          data-i18n-ignore
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (open) {
              closePicker();
              inputRef.current?.focus();
              return;
            }
            inputRef.current?.focus();
            window.requestAnimationFrame(() => openPicker(true));
          }}
          className="bd-focus absolute right-1 top-1/2 flex h-10 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-cyan-700 transition hover:bg-cyan-50"
        >
          <ChevronDown
            className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>

      <p id={statusId} className="sr-only" aria-live="polite">
        {open ? c.results(visibleCountries.length) : ""}
      </p>

      {open ? (
        <div
          data-i18n-ignore
          className="bd-auth-popover absolute left-0 top-[calc(100%+8px)] z-50 w-full min-w-[260px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20"
        >
          <ul
            id={listboxId}
            role="listbox"
            aria-label={c.listLabel}
            className="max-h-72 overflow-y-auto p-2"
          >
            {visibleCountries.map((country, index) => {
              const isSelected = selectedCountry?.code === country.code;
              return (
                <li key={country.code} role="presentation">
                  <button
                    id={`${listboxId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectCountry(country)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      activeIndex === index
                        ? "bg-cyan-50 text-cyan-950"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-lg" aria-hidden>
                      {country.flag}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {countryNameForLanguage(country, language)}
                    </span>
                    {isSelected ? (
                      <Check className="h-4 w-4 shrink-0 text-cyan-700" aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {!visibleCountries.length ? (
            <p className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
              {c.noResults}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const nationalitySearchCopy = {
  en: {
    placeholder: "Type a country name",
    clear: "Clear nationality",
    open: "Show all countries",
    close: "Close country list",
    listLabel: "Countries",
    noResults: "No matching country found.",
    results: (count: number) =>
      `${count} ${count === 1 ? "country" : "countries"} available.`,
  },
  tr: {
    placeholder: "Ülke adı yazın",
    clear: "Uyruğu temizle",
    open: "Tüm ülkeleri göster",
    close: "Ülke listesini kapat",
    listLabel: "Ülkeler",
    noResults: "Eşleşen ülke bulunamadı.",
    results: (count: number) => `${count} ülke seçeneği var.`,
  },
} as const;

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Phone } from "lucide-react";
import { blueDeckCountries, type BlueDeckCountry } from "../lib/countries";

function countryFromValue(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  return (
    [...blueDeckCountries]
      .sort((a, b) => b.dial.length - a.dial.length)
      .find((country) => normalized.startsWith(country.dial)) || null
  );
}

function localNumberFromValue(value: string, country: BlueDeckCountry | null) {
  let local = value.trim();
  if (country && local.startsWith(country.dial)) local = local.slice(country.dial.length).trim();
  return local.replace(/^\+/, "");
}

function composePhone(country: BlueDeckCountry | null, localNumber: string) {
  const cleanLocal = localNumber.replace(/[^\d\s()-]/g, "").trim();
  if (!country) return cleanLocal;
  return cleanLocal ? `${country.dial} ${cleanLocal}` : country.dial;
}

export function PhoneInput({
  label = "Phone",
  value,
  onChange,
  required = false,
  autoComplete = "tel",
  variant = "default",
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoComplete?: string;
  variant?: "default" | "profile";
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const countryButtonRef = useRef<HTMLButtonElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const inputId = `phone-${generatedId.replace(/:/g, "")}`;
  const countryPickerId = `${inputId}-country-picker`;
  const countryListboxId = `${inputId}-country-listbox`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [manualCountry, setManualCountry] = useState<BlueDeckCountry | null>(null);
  const country = countryFromValue(value) || manualCountry;
  const localNumber = localNumberFromValue(value, country);
  const profileVariant = variant === "profile";
  const filteredCountries = blueDeckCountries
    .filter((item) => `${item.country} ${item.nationality} ${item.code} ${item.dial}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 260);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        closeCountryPicker();
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document
      .getElementById(`${countryListboxId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, countryListboxId, open]);

  function closeCountryPicker(returnFocus = false) {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    if (returnFocus) {
      window.requestAnimationFrame(() => countryButtonRef.current?.focus());
    }
  }

  function openCountryPicker() {
    const selectedIndex = blueDeckCountries.findIndex(
      (item) => item.code === country?.code,
    );
    setQuery("");
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function chooseCountry(item: BlueDeckCountry) {
    setManualCountry(item);
    onChange(composePhone(item, localNumber));
    closeCountryPicker();
    window.requestAnimationFrame(() => phoneInputRef.current?.focus());
  }

  function handleCountrySearchKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeCountryPicker(true);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!filteredCountries.length) return;
      event.preventDefault();
      setActiveIndex((current) => {
        if (event.key === "ArrowDown") {
          return current < filteredCountries.length - 1 ? current + 1 : 0;
        }
        return current > 0 ? current - 1 : filteredCountries.length - 1;
      });
      return;
    }

    if (event.key === "Home" && filteredCountries.length) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End" && filteredCountries.length) {
      event.preventDefault();
      setActiveIndex(filteredCountries.length - 1);
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      const activeCountry = filteredCountries[activeIndex];
      if (!activeCountry) return;
      event.preventDefault();
      chooseCountry(activeCountry);
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="block"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          closeCountryPicker();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          closeCountryPicker(true);
        }
      }}
    >
      <label
        htmlFor={inputId}
        className={
          profileVariant
            ? "mb-1.5 block select-text text-xs font-semibold leading-4 text-slate-700"
            : "mb-2 block select-text text-sm font-semibold text-slate-600"
        }
      >
        {label} {required && <span aria-hidden="true" className="text-rose-500">*</span>}
      </label>
      <div className="relative">
        <div className={
          profileVariant
            ? "flex h-12 min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/15"
            : "flex min-h-[54px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/10"
        }>
          <button
            ref={countryButtonRef}
            type="button"
            onClick={() => {
              if (open) {
                closeCountryPicker();
              } else {
                openCountryPicker();
              }
            }}
            className={`flex shrink-0 items-center justify-center gap-2 border-r border-slate-200 bg-white text-sm font-black transition hover:bg-cyan-50 ${profileVariant ? "h-full w-[100px] px-2 sm:w-[108px]" : "w-[106px] px-3 sm:w-[116px]"} ${country ? "text-slate-950" : "text-slate-400"}`}
            aria-label="Select country code"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-controls={countryPickerId}
          >
            {country ? (
              <>
                <span aria-hidden="true">{country.flag}</span>
                <span>{country.dial}</span>
              </>
            ) : (
              <span>Code</span>
            )}
          </button>
          <div className="flex min-w-0 flex-1 items-center">
            <Phone className="ml-3 h-4 w-4 shrink-0 text-cyan-700" aria-hidden="true" />
            <input
              ref={phoneInputRef}
              id={inputId}
              type="tel"
              value={localNumber}
              onChange={(event) => onChange(composePhone(country, event.target.value))}
              required={required}
              inputMode="tel"
              autoComplete={autoComplete}
              placeholder="Mobile number"
              className={profileVariant
                ? "h-full min-w-0 flex-1 bg-transparent px-3 py-0 text-base font-medium text-slate-950 outline-none placeholder:text-slate-400 sm:text-sm"
                : "min-w-0 flex-1 bg-transparent px-3 py-4 text-base text-slate-950 outline-none placeholder:text-slate-400"}
            />
          </div>
        </div>

        {open && (
          <div
            id={countryPickerId}
            role="dialog"
            aria-label="Select country code"
            className="bd-auth-popover absolute left-0 top-[calc(100%+8px)] z-50 w-full max-w-[430px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/18"
          >
            <input
              autoFocus
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={countryListboxId}
              aria-activedescendant={
                activeIndex >= 0 && filteredCountries[activeIndex]
                  ? `${countryListboxId}-option-${activeIndex}`
                  : undefined
              }
              autoComplete="off"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleCountrySearchKeyDown}
              placeholder="Search country..."
              aria-label="Search country"
              className={profileVariant
                ? "h-12 w-full border-b border-slate-200 px-4 py-0 text-base text-slate-950 outline-none placeholder:text-slate-400 sm:text-sm"
                : "w-full border-b border-slate-200 px-4 py-3 text-sm text-slate-950 outline-none placeholder:text-slate-400"}
            />
            <div
              id={countryListboxId}
              role="listbox"
              aria-label="Country codes"
              className="max-h-72 overflow-auto p-2"
            >
              {filteredCountries.map((item, index) => (
                <button
                  key={`${item.country}-${item.dial}`}
                  id={`${countryListboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={item.code === country?.code}
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => chooseCountry(item)}
                  className={`flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-cyan-50 ${
                    activeIndex === index ? "bg-cyan-50" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span aria-hidden="true">{item.flag}</span> {item.country}
                  </span>
                  <span className="shrink-0 font-black text-cyan-700">{item.dial}</span>
                </button>
              ))}
              {!filteredCountries.length ? (
                <p role="status" className="px-3 py-5 text-center text-sm font-semibold text-slate-500">
                  No matching country found.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

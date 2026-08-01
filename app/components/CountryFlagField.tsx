"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  countryOptionFromCode,
  nationalityOptions,
} from "../lib/countries";

export function CountryFlagField({
  label,
  value,
  placeholder,
  clearLabel,
  noResults,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  clearLabel: string;
  noResults: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const inputId = `${generatedId}-country-input`;
  const listboxId = `${generatedId}-country-listbox`;
  const statusId = `${generatedId}-country-status`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const selectedCountry = countryOptionFromCode(value);
  const filteredCountries = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("en-US");
    if (!normalized) return nationalityOptions.slice(0, 80);
    return nationalityOptions
      .filter((country) =>
        `${country.country} ${country.nationality} ${country.code}`
          .toLocaleLowerCase("en-US")
          .includes(normalized),
      )
      .slice(0, 80);
  }, [query]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        closePicker();
      }
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

  function closePicker() {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }

  function selectCountry(code: string) {
    onChange(code);
    closePicker();
  }

  function openPicker() {
    const selectedIndex = nationalityOptions
      .slice(0, 80)
      .findIndex((country) => country.code === selectedCountry?.code);
    setOpen(true);
    setQuery("");
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (open) event.preventDefault();
      closePicker();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!filteredCountries.length) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => {
        if (event.key === "ArrowDown") {
          return current < filteredCountries.length - 1 ? current + 1 : 0;
        }
        return current > 0 ? current - 1 : filteredCountries.length - 1;
      });
      return;
    }

    if (event.key === "Home" && open && filteredCountries.length) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End" && open && filteredCountries.length) {
      event.preventDefault();
      setActiveIndex(filteredCountries.length - 1);
      return;
    }

    if (event.key === "Enter" && open && activeIndex >= 0) {
      const activeCountry = filteredCountries[activeIndex];
      if (!activeCountry) return;
      event.preventDefault();
      selectCountry(activeCountry.code);
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="relative block"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          closePicker();
        }
      }}
    >
      <label
        htmlFor={inputId}
        className="block text-[11px] font-black uppercase tracking-[0.12em] text-slate-600"
      >
        {label}
      </label>
      <div className="bd-focus mt-2 flex min-h-12 items-center overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/15">
        <span className="flex w-12 shrink-0 items-center justify-center text-xl" aria-hidden>
          {selectedCountry?.flag || "🏳️"}
        </span>
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={
            open && activeIndex >= 0 && filteredCountries[activeIndex]
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          aria-describedby={open && !filteredCountries.length ? statusId : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          value={open ? query : selectedCountry?.country || ""}
          onFocus={() => {
            if (!disabled) openPicker();
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={handleInputKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-3 pr-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-65"
        />
        {selectedCountry && !disabled ? (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange("");
              closePicker();
            }}
            className="bd-focus mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label={clearLabel}
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
      </div>

      {open && !disabled ? (
        <div className="bd-auth-popover absolute left-0 top-[calc(100%+8px)] z-50 w-full min-w-[260px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/18">
          <div id={listboxId} role="listbox" className="max-h-72 overflow-auto">
            {filteredCountries.length ? (
              filteredCountries.map((country, index) => (
                <button
                  key={country.code}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={country.code === selectedCountry?.code}
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => selectCountry(country.code)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-cyan-50 ${
                    activeIndex === index ? "bg-cyan-50" : ""
                  }`}
                >
                  <span className="text-lg" aria-hidden>{country.flag}</span>
                  <span className="min-w-0 flex-1 truncate">{country.country}</span>
                  <span className="shrink-0 text-[10px] font-black tracking-[0.12em] text-slate-400">
                    {country.code}
                  </span>
                </button>
              ))
            ) : (
              <p
                id={statusId}
                role="status"
                className="px-3 py-5 text-center text-sm font-semibold text-slate-500"
              >
                {noResults}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

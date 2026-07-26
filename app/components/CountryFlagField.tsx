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
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
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
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative block">
      <label className="block">
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-600">
          {label}
        </span>
        <div className="bd-focus mt-2 flex min-h-12 items-center overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/15">
          <span className="flex w-12 shrink-0 items-center justify-center text-xl" aria-hidden>
            {selectedCountry?.flag || "🏳️"}
          </span>
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            value={open ? query : selectedCountry?.country || ""}
            onFocus={() => {
              if (disabled) return;
              setOpen(true);
              setQuery("");
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                setQuery("");
              }
            }}
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
                setQuery("");
                setOpen(false);
              }}
              className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label={clearLabel}
            >
              ×
            </button>
          ) : null}
        </div>
      </label>

      {open && !disabled ? (
        <div className="bd-auth-popover absolute left-0 top-[calc(100%+8px)] z-50 w-full min-w-[260px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/18">
          <div id={listboxId} role="listbox" className="max-h-72 overflow-auto">
            {filteredCountries.length ? (
              filteredCountries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  role="option"
                  aria-selected={country.code === selectedCountry?.code}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(country.code);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-cyan-50"
                >
                  <span className="text-lg" aria-hidden>{country.flag}</span>
                  <span className="min-w-0 flex-1 truncate">{country.country}</span>
                  <span className="shrink-0 text-[10px] font-black tracking-[0.12em] text-slate-400">
                    {country.code}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-5 text-center text-sm font-semibold text-slate-500">
                {noResults}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

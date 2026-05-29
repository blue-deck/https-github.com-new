"use client";

import { useEffect, useRef, useState } from "react";
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
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoComplete?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [manualCountry, setManualCountry] = useState<BlueDeckCountry | null>(null);
  const country = countryFromValue(value) || manualCountry;
  const localNumber = localNumberFromValue(value, country);
  const filteredCountries = blueDeckCountries
    .filter((item) => `${item.country} ${item.nationality} ${item.code} ${item.dial}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 260);

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
    <div ref={wrapperRef} className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-600">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      <div className="relative">
        <div className="flex min-h-[54px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/10">
          <button
            type="button"
            onClick={() => {
              setOpen(!open);
              setQuery("");
            }}
            className={`flex w-[106px] shrink-0 items-center justify-center gap-2 border-r border-slate-200 bg-white px-3 text-sm font-black transition hover:bg-cyan-50 sm:w-[116px] ${country ? "text-slate-950" : "text-slate-400"}`}
            aria-label="Select country code"
          >
            {country ? (
              <>
                <span>{country.flag}</span>
                <span>{country.dial}</span>
              </>
            ) : (
              <span>Code</span>
            )}
          </button>
          <div className="flex min-w-0 flex-1 items-center">
            <Phone className="ml-3 h-4 w-4 shrink-0 text-cyan-700" />
            <input
              value={localNumber}
              onChange={(event) => onChange(composePhone(country, event.target.value))}
              required={required}
              inputMode="tel"
              autoComplete={autoComplete}
              placeholder="Mobile number"
              className="min-w-0 flex-1 bg-transparent px-3 py-4 text-base text-slate-950 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {open && (
          <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[min(430px,92vw)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/18">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search country..."
              className="w-full border-b border-slate-200 px-4 py-3 text-sm text-slate-950 outline-none placeholder:text-slate-400"
            />
            <div className="max-h-72 overflow-auto p-2">
              {filteredCountries.map((item) => (
                <button
                  key={`${item.country}-${item.dial}`}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setManualCountry(item);
                    onChange(composePhone(item, localNumber));
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-cyan-50"
                >
                  <span className="min-w-0 truncate">
                    {item.flag} {item.country}
                  </span>
                  <span className="shrink-0 font-black text-cyan-700">{item.dial}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

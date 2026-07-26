"use client";

import { useEffect, useId, useRef, useState } from "react";

export type DateTextFieldProps = {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder: string;
  invalidText?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  autoComplete?: string;
};

const defaultLabelClassName =
  "mb-1.5 block select-text text-xs font-semibold leading-4 text-slate-700";
const defaultInputClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-0 text-base font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-65 sm:text-sm";

export function DateTextField({
  label,
  value = "",
  onChange,
  placeholder,
  invalidText = "Enter a valid date in DD/MM/YYYY format.",
  disabled = false,
  required = false,
  className = "",
  labelClassName = defaultLabelClassName,
  inputClassName = defaultInputClassName,
  autoComplete,
}: DateTextFieldProps) {
  const generatedId = useId();
  const inputId = `${generatedId}-date`;
  const errorId = `${generatedId}-date-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const lastEmittedValue = useRef<string | null>(null);
  const [display, setDisplay] = useState(formatDateForDisplay(value));
  const [touched, setTouched] = useState(false);
  const parsedValue = parseDisplayDate(display);
  const invalid = Boolean(display.trim()) && !parsedValue;

  useEffect(() => {
    if (lastEmittedValue.current === value) {
      lastEmittedValue.current = null;
      return;
    }

    setDisplay(formatDateForDisplay(value));
    setTouched(false);
  }, [value]);

  useEffect(() => {
    inputRef.current?.setCustomValidity(invalid ? invalidText : "");
  }, [invalid, invalidText]);

  function emit(nextDisplay: string) {
    const formatted = formatDateTyping(nextDisplay);
    const nextValue = parseDisplayDate(formatted);
    setDisplay(formatted);
    lastEmittedValue.current = nextValue;
    onChange(nextValue);
  }

  return (
    <div className={`block ${className}`}>
      <label htmlFor={inputId} className={labelClassName}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={display}
        disabled={disabled}
        required={required}
        maxLength={10}
        aria-invalid={touched && invalid ? true : undefined}
        aria-errormessage={touched && invalid ? errorId : undefined}
        onChange={(event) => emit(event.target.value)}
        onBlur={() => {
          setTouched(true);
          if (parsedValue) setDisplay(formatDateForDisplay(parsedValue));
        }}
        className={inputClassName}
      />
      {touched && invalid ? (
        <span id={errorId} className="sr-only" role="alert">
          {invalidText}
        </span>
      ) : null}
    </div>
  );
}

export function formatDateTyping(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  return [day, month, year].filter(Boolean).join("/");
}

export function parseDisplayDate(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) return "";

  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  const isoDate = `${year}-${month}-${day}`;

  return isStrictIsoDate(isoDate) ? isoDate : "";
}

export function formatDateForDisplay(value: string) {
  if (!value) return "";
  if (!isStrictIsoDate(value)) return formatDateTyping(value);

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function isStrictIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900) return false;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

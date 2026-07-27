"use client";

import { useId, type ReactNode } from "react";

export type YachtSizeUnit = "ft" | "m";

export type YachtSizeFieldProps = {
  label: ReactNode;
  value: string;
  unit: YachtSizeUnit;
  onChange: (value: string, unit: YachtSizeUnit) => void;
  amountLabel: string;
  unitLabel: string;
  placeholder: string;
  feetOptionLabel?: string;
  metresOptionLabel?: string;
  disabled?: boolean;
  required?: boolean;
  allowDecimal?: boolean;
  maxLength?: number;
  maxIntegerDigits?: number;
  className?: string;
  labelClassName?: string;
};

const defaultLabelClassName =
  "mb-1.5 block text-xs font-semibold text-slate-700";

export function YachtSizeField({
  label,
  value,
  unit,
  onChange,
  amountLabel,
  unitLabel,
  placeholder,
  feetOptionLabel = "ft",
  metresOptionLabel = "m",
  disabled = false,
  required = false,
  allowDecimal = true,
  maxLength,
  maxIntegerDigits,
  className = "",
  labelClassName = defaultLabelClassName,
}: YachtSizeFieldProps) {
  const generatedId = useId();
  const amountId = `${generatedId}-yacht-size`;
  const unitId = `${generatedId}-yacht-size-unit`;

  return (
    <fieldset
      disabled={disabled}
      className={`m-0 min-w-0 border-0 p-0 ${className}`}
    >
      <legend className={labelClassName}>{label}</legend>
      <div className="grid grid-cols-[1fr_64px] overflow-hidden rounded-xl border border-[#d8e2e6] bg-white transition focus-within:border-[#2d7482] focus-within:ring-2 focus-within:ring-[#2d7482]/15">
        <input
          id={amountId}
          aria-label={amountLabel}
          type="text"
          inputMode={allowDecimal ? "decimal" : "numeric"}
          pattern={allowDecimal ? "[0-9]+([.,][0-9]{1,2})?" : "[0-9]*"}
          value={value}
          required={required}
          maxLength={maxLength}
          onChange={(event) =>
            onChange(
              normalizeYachtSizeValue(
                event.target.value,
                allowDecimal,
                maxIntegerDigits,
              ),
              unit,
            )
          }
          placeholder={placeholder}
          className="min-h-11 min-w-0 border-0 bg-white px-3 text-base font-medium text-slate-700 outline-none placeholder:text-[#9aa8ae] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-65 sm:text-sm"
        />
        <select
          id={unitId}
          aria-label={unitLabel}
          value={unit}
          onChange={(event) =>
            onChange(value, event.target.value as YachtSizeUnit)
          }
          className="min-h-11 cursor-pointer border-0 border-l border-[#d8e2e6] bg-slate-50 px-2 text-base font-semibold uppercase tracking-[0.06em] text-slate-600 outline-none disabled:cursor-not-allowed disabled:opacity-65 sm:text-xs"
        >
          <option value="ft">{feetOptionLabel}</option>
          <option value="m">{metresOptionLabel}</option>
        </select>
      </div>
    </fieldset>
  );
}

export function normalizeYachtSizeValue(
  value: string,
  allowDecimal = true,
  maxIntegerDigits?: number,
) {
  if (!allowDecimal) {
    const digits = value.replace(/\D/g, "");
    return maxIntegerDigits ? digits.slice(0, maxIntegerDigits) : digits;
  }

  const cleanValue = value.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const decimalIndex = cleanValue.indexOf(".");
  if (decimalIndex === -1) {
    return maxIntegerDigits
      ? cleanValue.slice(0, maxIntegerDigits)
      : cleanValue;
  }

  const integerPart = maxIntegerDigits
    ? cleanValue.slice(0, decimalIndex).slice(0, maxIntegerDigits)
    : cleanValue.slice(0, decimalIndex);

  return `${integerPart}.${cleanValue
    .slice(decimalIndex + 1)
    .replace(/\./g, "")
    .slice(0, 2)}`;
}

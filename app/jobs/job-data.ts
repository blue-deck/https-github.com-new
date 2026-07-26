import {
  formatJobMinimumYachtExperience,
  formatJobYachtLength,
  formatJobYachtType,
  isJobYachtLengthUnit,
  isJobYachtType,
  isSupportedJobListingNumber,
  type JobYachtLengthUnit,
  type JobYachtType,
} from "../lib/jobPosts";

export type PublicJobSalary = {
  min: number | null;
  max: number | null;
  currency: string;
  period: string;
};

export type PublicJobYacht = {
  name: string;
  model: string;
  flag: string;
};

export type PublicJob = {
  id: string;
  listingNumber: string;
  title: string;
  position: string;
  department: string;
  employmentType: string;
  location: string;
  startDate: string;
  yachtType: JobYachtType | null;
  yachtLength: number | null;
  yachtLengthUnit: JobYachtLengthUnit | null;
  minimumYachtExperienceYears: number | null;
  summary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  salary: PublicJobSalary | null;
  yacht: PublicJobYacht;
  publishedAt: string;
};

type UnknownRecord = Record<string, unknown>;

export function parsePublicJob(value: unknown): PublicJob | null {
  if (!isRecord(value)) return null;

  const id = readString(value, "id");
  const listingNumber = readString(value, "listingNumber", "listing_number");
  const title = readString(value, "title");
  if (!id || !isSupportedJobListingNumber(listingNumber) || !title) return null;

  const yachtValue = readRecord(value, "yacht");
  const yachtTypeValue = readValue(value, "yachtType", "yacht_type");
  const yachtLengthValue = readValue(value, "yachtLength", "yacht_length");
  const yachtLengthUnitValue = readValue(
    value,
    "yachtLengthUnit",
    "yacht_length_unit",
  );
  const yachtLength = readPositiveNullableNumber(yachtLengthValue);
  const minimumYachtExperienceYears = readWholeYearsNullable(
    readValue(
      value,
      "minimumYachtExperienceYears",
      "minimum_yacht_experience_years",
    ),
  );
  const yachtLengthUnit = isJobYachtLengthUnit(yachtLengthUnitValue)
    ? yachtLengthUnitValue
    : null;

  return {
    id,
    listingNumber,
    title,
    position: readString(value, "position"),
    department: readString(value, "department"),
    employmentType: readString(value, "employmentType", "employment_type"),
    location: readString(value, "location"),
    startDate: readString(value, "startDate", "start_date"),
    yachtType: isJobYachtType(yachtTypeValue) ? yachtTypeValue : null,
    yachtLength:
      yachtLength !== null && yachtLengthUnit !== null ? yachtLength : null,
    yachtLengthUnit: yachtLength !== null ? yachtLengthUnit : null,
    minimumYachtExperienceYears,
    summary: readString(value, "summary"),
    description: readString(value, "description"),
    responsibilities: readStringList(value, "responsibilities"),
    requirements: readStringList(value, "requirements"),
    benefits: readStringList(value, "benefits"),
    salary: parseSalary(value.salary),
    yacht: {
      name: readString(yachtValue, "name"),
      model: readString(yachtValue, "model"),
      flag: readString(yachtValue, "flag"),
    },
    publishedAt: readString(value, "publishedAt", "published_at"),
  };
}

export function parsePublicJobs(value: unknown) {
  if (!Array.isArray(value)) return null;
  return value
    .map(parsePublicJob)
    .filter((job): job is PublicJob => Boolean(job));
}

export function formatJobDate(
  value: string,
  language: "en" | "tr",
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
) {
  if (!value) return "";

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(
    language === "tr" ? "tr-TR" : "en-GB",
    options,
  ).format(date);
}

export function formatJobSalary(
  salary: PublicJobSalary | null,
  language: "en" | "tr",
) {
  if (!salary || (salary.min === null && salary.max === null)) return "";

  const locale = language === "tr" ? "tr-TR" : "en-GB";
  const currency = salary.currency.trim().toUpperCase();
  const formatAmount = (amount: number) => {
    if (/^[A-Z]{3}$/.test(currency)) {
      try {
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
        }).format(amount);
      } catch {
        // Fall through to the plain currency representation.
      }
    }

    const formatted = new Intl.NumberFormat(locale, {
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
    return currency ? `${formatted} ${currency}` : formatted;
  };

  let amount = "";
  if (salary.min !== null && salary.max !== null) {
    amount =
      salary.min === salary.max
        ? formatAmount(salary.min)
        : `${formatAmount(salary.min)} – ${formatAmount(salary.max)}`;
  } else if (salary.min !== null) {
    amount = `${language === "tr" ? "Başlangıç" : "From"} ${formatAmount(salary.min)}`;
  } else if (salary.max !== null) {
    amount = `${language === "tr" ? "En fazla" : "Up to"} ${formatAmount(salary.max)}`;
  }

  const period = formatSalaryPeriod(salary.period, language);
  return period ? `${amount} / ${period}` : amount;
}

export function yachtLabel(job: PublicJob) {
  return [job.yacht.name, job.yacht.model, job.yacht.flag]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" · ");
}

export function yachtSpecificationLabel(
  job: PublicJob,
  language: "en" | "tr",
) {
  const type = job.yachtType
    ? formatJobYachtType(job.yachtType, language)
    : "";
  const length =
    job.yachtLength !== null && job.yachtLengthUnit
      ? formatJobYachtLength(
          job.yachtLength,
          job.yachtLengthUnit,
          language,
        )
      : "";

  return [type, length].filter(Boolean).join(" · ");
}

export function minimumYachtExperienceLabel(
  job: PublicJob,
  language: "en" | "tr",
) {
  return job.minimumYachtExperienceYears === null
    ? ""
    : formatJobMinimumYachtExperience(
        job.minimumYachtExperienceYears,
        language,
      );
}

function parseSalary(value: unknown): PublicJobSalary | null {
  if (!isRecord(value)) return null;

  const min = readNullableNumber(value.min);
  const max = readNullableNumber(value.max);

  return {
    min,
    max,
    currency: readString(value, "currency"),
    period: readString(value, "period"),
  };
}

function formatSalaryPeriod(value: string, language: "en" | "tr") {
  const normalized = value.trim().toLocaleLowerCase("en-US");
  const periods: Record<string, { en: string; tr: string }> = {
    hour: { en: "hour", tr: "saat" },
    hourly: { en: "hour", tr: "saat" },
    day: { en: "day", tr: "gün" },
    daily: { en: "day", tr: "gün" },
    week: { en: "week", tr: "hafta" },
    weekly: { en: "week", tr: "hafta" },
    month: { en: "month", tr: "ay" },
    monthly: { en: "month", tr: "ay" },
    year: { en: "year", tr: "yıl" },
    yearly: { en: "year", tr: "yıl" },
    annual: { en: "year", tr: "yıl" },
  };

  return periods[normalized]?.[language] || value.trim();
}

function readString(record: UnknownRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value.trim();
  }
  return "";
}

function readValue(record: UnknownRecord, ...keys: string[]) {
  for (const key of keys) {
    if (key in record) return record[key];
  }
  return undefined;
}

function readStringList(record: UnknownRecord, key: string) {
  const value = record[key];
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function readRecord(record: UnknownRecord, key: string): UnknownRecord {
  const value = record[key];
  return isRecord(value) ? value : {};
}

function readNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readPositiveNullableNumber(value: unknown) {
  const number = readNullableNumber(value);
  return number !== null && number > 0 ? number : null;
}

function readWholeYearsNullable(value: unknown) {
  const number = readNullableNumber(value);
  return number !== null &&
    Number.isSafeInteger(number) &&
    number >= 0 &&
    number <= 60
    ? number
    : null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

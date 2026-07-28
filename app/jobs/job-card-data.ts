import type {
  JobCandidateType,
  JobEmploymentType,
  JobYachtLengthUnit,
  JobYachtType,
} from "../lib/jobPosts";

const employmentTypes = new Set<JobEmploymentType>([
  "permanent",
  "temporary",
  "seasonal",
  "rotation",
  "daywork",
]);
const candidateTypes = new Set<JobCandidateType>([
  "individual",
  "team",
  "couple",
]);
const yachtTypes = new Set<JobYachtType>([
  "motor_yacht",
  "sailing_yacht",
  "catamaran",
  "motor_catamaran",
  "gulet",
  "expedition_yacht",
  "classic_yacht",
  "support_vessel",
  "chase_boat",
  "commercial_vessel",
  "new_build",
]);
const yachtLengthUnits = new Set<JobYachtLengthUnit>(["m", "ft"]);

const employmentTypeLabels: Record<
  JobEmploymentType,
  { en: string; tr: string }
> = {
  permanent: { en: "Permanent", tr: "Sürekli" },
  temporary: { en: "Temporary", tr: "Geçici" },
  seasonal: { en: "Seasonal", tr: "Sezonluk" },
  rotation: { en: "Rotation", tr: "Rotasyon" },
  daywork: { en: "Daywork", tr: "Günlük" },
};

const candidateTypeLabels: Record<
  Exclude<JobCandidateType, "individual">,
  { en: string; tr: string }
> = {
  team: { en: "Team / Couple", tr: "Ekip / Çift" },
  couple: { en: "Couple", tr: "Çift" },
};

const yachtTypeLabels: Record<JobYachtType, { en: string; tr: string }> = {
  motor_yacht: { en: "Motor yacht", tr: "Motor yat" },
  sailing_yacht: { en: "Sailing yacht", tr: "Yelkenli yat" },
  catamaran: { en: "Catamaran", tr: "Katamaran" },
  motor_catamaran: { en: "Motor catamaran", tr: "Motor katamaran" },
  gulet: { en: "Gulet", tr: "Gulet" },
  expedition_yacht: { en: "Expedition yacht", tr: "Expedition yat" },
  classic_yacht: { en: "Classic yacht", tr: "Klasik yat" },
  support_vessel: { en: "Support vessel", tr: "Destek teknesi" },
  chase_boat: { en: "Chase boat", tr: "Takip botu" },
  commercial_vessel: { en: "Commercial vessel", tr: "Ticari tekne" },
  new_build: { en: "New build", tr: "Yeni inşa" },
};

export type PublicJobSalary = {
  min: number | null;
  max: number | null;
  currency: string;
  period: string;
};

export type PublicJobCard = {
  id: string;
  position: string;
  employmentType: JobEmploymentType;
  candidateType: JobCandidateType;
  location: string;
  startDate: string;
  yachtType: JobYachtType | null;
  yachtLength: number | null;
  yachtLengthUnit: JobYachtLengthUnit | null;
  salary: PublicJobSalary | null;
};

type UnknownRecord = Record<string, unknown>;

export function parsePublicJobCard(value: unknown): PublicJobCard | null {
  if (!isRecord(value)) return null;

  const id = readString(value, "id");
  const position = readString(value, "position");
  const employmentTypeValue = readValue(
    value,
    "employmentType",
    "employment_type",
  );
  const candidateTypeValue = readValue(
    value,
    "candidateType",
    "candidate_type",
  );
  const yachtTypeValue = readValue(value, "yachtType", "yacht_type");
  const yachtLengthValue = readPositiveNullableNumber(
    readValue(value, "yachtLength", "yacht_length"),
  );
  const yachtLengthUnitValue = readValue(
    value,
    "yachtLengthUnit",
    "yacht_length_unit",
  );
  const yachtLengthUnit = isJobYachtLengthUnit(yachtLengthUnitValue)
    ? yachtLengthUnitValue
    : null;

  if (
    !id ||
    !position ||
    !isJobEmploymentType(employmentTypeValue) ||
    !isJobCandidateType(candidateTypeValue)
  ) {
    return null;
  }

  return {
    id,
    position,
    employmentType: employmentTypeValue,
    candidateType: candidateTypeValue,
    location: readString(value, "location"),
    startDate: readString(value, "startDate", "start_date"),
    yachtType: isJobYachtType(yachtTypeValue) ? yachtTypeValue : null,
    yachtLength:
      yachtLengthValue !== null && yachtLengthUnit !== null
        ? yachtLengthValue
        : null,
    yachtLengthUnit:
      yachtLengthValue !== null && yachtLengthUnit !== null
        ? yachtLengthUnit
        : null,
    salary: parseSalary(value.salary),
  };
}

export function parsePublicJobCards(value: unknown) {
  if (!Array.isArray(value)) return null;
  return value
    .map(parsePublicJobCard)
    .filter((job): job is PublicJobCard => Boolean(job));
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
        // Fall back to a plain currency representation.
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

export function formatJobEmploymentType(
  value: JobEmploymentType,
  language: "en" | "tr",
) {
  return employmentTypeLabels[value][language];
}

export function formatJobCandidateType(
  value: Exclude<JobCandidateType, "individual">,
  language: "en" | "tr",
) {
  return candidateTypeLabels[value][language];
}

export function formatJobYachtType(
  value: JobYachtType,
  language: "en" | "tr",
) {
  return yachtTypeLabels[value][language];
}

export function formatJobYachtLength(
  value: number,
  unit: JobYachtLengthUnit,
  language: "en" | "tr",
) {
  const formatted = new Intl.NumberFormat(
    language === "tr" ? "tr-TR" : "en-GB",
    { maximumFractionDigits: 2 },
  ).format(value);
  return `${formatted} ${unit}`;
}

function parseSalary(value: unknown): PublicJobSalary | null {
  if (!isRecord(value)) return null;

  return {
    min: readNullableNumber(value.min),
    max: readNullableNumber(value.max),
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

function readNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readPositiveNullableNumber(value: unknown) {
  const number = readNullableNumber(value);
  return number !== null && number > 0 ? number : null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isJobEmploymentType(value: unknown): value is JobEmploymentType {
  return employmentTypes.has(value as JobEmploymentType);
}

function isJobCandidateType(value: unknown): value is JobCandidateType {
  return candidateTypes.has(value as JobCandidateType);
}

function isJobYachtType(value: unknown): value is JobYachtType {
  return yachtTypes.has(value as JobYachtType);
}

function isJobYachtLengthUnit(value: unknown): value is JobYachtLengthUnit {
  return yachtLengthUnits.has(value as JobYachtLengthUnit);
}

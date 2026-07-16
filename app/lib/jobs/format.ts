import {
  JOB_EMPLOYMENT_OPTIONS,
  isJobSalaryPeriod,
} from "./constants";
import type {
  JobEmploymentType,
  JobSalary,
  PublicJobDetail,
} from "./types";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatJobDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dateFormatter.format(date);
}

export function formatEmploymentType(
  value: JobEmploymentType | null,
): string | null {
  if (!value) return null;
  return (
    JOB_EMPLOYMENT_OPTIONS.find((option) => option.value === value)?.label ||
    humanize(value)
  );
}

export function formatSalary(salary: JobSalary | null): string | null {
  if (!salary) return null;

  const values = [salary.minimum, salary.maximum].filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  if (values.length === 0) return null;

  const formattedValues = values.map((value) =>
    formatMoney(value, salary.currency),
  );
  const amount =
    formattedValues.length === 2 &&
    formattedValues[0] !== formattedValues[1]
      ? `${formattedValues[0]}–${formattedValues[1]}`
      : formattedValues[0];
  const period = isJobSalaryPeriod(salary.period)
    ? salary.period
    : "contract";

  return period === "contract" ? amount : `${amount} / ${period}`;
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString("en-GB")}`;
  }
}

export function formatYachtSpecification(
  yachtType: string | null,
  yachtLengthMetres: number | null,
): string | null {
  const parts = [
    yachtType,
    yachtLengthMetres && yachtLengthMetres > 0
      ? `${yachtLengthMetres}m`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function plainTextExcerpt(
  value: string,
  maximumLength = 165,
): string {
  const clean = value
    .replace(/<[^>]*>/g, " ")
    .replace(/[#*_>`~[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length <= maximumLength) return clean;
  return `${clean.slice(0, maximumLength).replace(/\s+\S*$/, "")}…`;
}

export function buildJobPostingJsonLd(
  job: PublicJobDetail,
  canonicalUrl: string,
): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    identifier: {
      "@type": "PropertyValue",
      name: "BlueDeck",
      value: job.id,
    },
    title: job.title,
    description: job.description,
    url: canonicalUrl,
  };

  if (job.employer.name) {
    jsonLd.hiringOrganization = {
      "@type": "Organization",
      name: job.employer.name,
    };
  }

  if (job.publishedAt) jsonLd.datePosted = job.publishedAt;
  const validThrough = earliestValidDate(
    job.expiresAt,
    job.applicationDeadline,
  );
  if (validThrough) jsonLd.validThrough = validThrough;

  const schemaEmploymentType = schemaEmploymentTypes[job.employmentType || ""];
  if (schemaEmploymentType) {
    jsonLd.employmentType = schemaEmploymentType;
  }

  if (job.location) {
    jsonLd.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.location,
        ...(job.countryCode
          ? { addressCountry: job.countryCode.toUpperCase() }
          : {}),
      },
    };
  }

  if (job.salary) {
    const value: Record<string, unknown> = {
      "@type": "QuantitativeValue",
      unitText: job.salary.period.toUpperCase(),
    };

    if (
      typeof job.salary.minimum === "number" &&
      typeof job.salary.maximum === "number"
    ) {
      value.minValue = job.salary.minimum;
      value.maxValue = job.salary.maximum;
    } else {
      value.value = job.salary.minimum ?? job.salary.maximum;
    }

    jsonLd.baseSalary = {
      "@type": "MonetaryAmount",
      currency: job.salary.currency,
      value,
    };
  }

  return jsonLd;
}

function earliestValidDate(
  ...values: Array<string | null>
): string | null {
  const dates = values.flatMap((value) => {
    if (!value) return [];
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? [] : [{ timestamp, value }];
  });

  dates.sort((left, right) => left.timestamp - right.timestamp);
  return dates[0]?.value || null;
}

export function humanize(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

const schemaEmploymentTypes: Partial<Record<JobEmploymentType | "", string>> =
  {
    permanent: "FULL_TIME",
    seasonal: "TEMPORARY",
    rotational: "FULL_TIME",
    temporary: "TEMPORARY",
    delivery: "CONTRACTOR",
    daywork: "CONTRACTOR",
    freelance: "CONTRACTOR",
  };

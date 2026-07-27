import {
  formatJobMinimumYachtExperience,
  formatJobYachtLength,
  formatJobYachtBuildYear,
  formatJobYachtType,
  isJobEmploymentType,
  isJobYachtLengthUnit,
  isJobYachtType,
  isJobCandidateType,
  isJobCertificate,
  isJobCharacteristic,
  isJobMinimumYachtExperience,
  isJobRequiredLanguage,
  isJobSkill,
  isJobSmokerPolicy,
  isJobVisa,
  isJobVisibleTattooPolicy,
  isSupportedJobListingNumber,
  maximumJobCertificateSelections,
  maximumJobCharacteristicSelections,
  maximumJobSkillSelections,
  maximumJobVisaSelections,
  type JobYachtLengthUnit,
  type JobYachtType,
  type JobEmploymentType,
  type JobCandidateType,
  type JobCertificate,
  type JobCharacteristic,
  type JobMinimumYachtExperience,
  type JobRequiredLanguage,
  type JobSkill,
  type JobSmokerPolicy,
  type JobVisa,
  type JobVisibleTattooPolicy,
} from "../lib/jobPosts";
import {
  countryOptionFromCode,
  formatCountryWithFlag,
} from "../lib/countries";

export type PublicJobSalary = {
  min: number | null;
  max: number | null;
  currency: string;
  period: string;
};

export type PublicJob = {
  id: string;
  listingNumber: string;
  title: string;
  position: string;
  department: string;
  employmentType: JobEmploymentType;
  candidateType: JobCandidateType;
  smokerPolicy: JobSmokerPolicy;
  visibleTattooPolicy: JobVisibleTattooPolicy;
  requiredLanguages: JobRequiredLanguage[];
  requiredSkills: JobSkill[];
  requiredCharacteristics: JobCharacteristic[];
  requiredCertificates: JobCertificate[];
  requiredVisas: JobVisa[];
  location: string;
  startDate: string;
  yachtBrand: string | null;
  yachtFlagCountryCode: string | null;
  yachtBuildYear: number | null;
  yachtType: JobYachtType | null;
  yachtLength: number | null;
  yachtLengthUnit: JobYachtLengthUnit | null;
  crewMemberCount: number | null;
  minimumYachtExperience: JobMinimumYachtExperience | null;
  summary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  salary: PublicJobSalary | null;
  publishedAt: string;
};

export type PublicJobCard = Pick<
  PublicJob,
  | "id"
  | "position"
  | "employmentType"
  | "candidateType"
  | "location"
  | "startDate"
  | "yachtType"
  | "yachtLength"
  | "yachtLengthUnit"
  | "salary"
>;

type UnknownRecord = Record<string, unknown>;

export function parsePublicJob(value: unknown): PublicJob | null {
  if (!isRecord(value)) return null;

  const id = readString(value, "id");
  const listingNumber = readString(value, "listingNumber", "listing_number");
  const title = readString(value, "title");
  if (!id || !isSupportedJobListingNumber(listingNumber) || !title) return null;

  const yachtTypeValue = readValue(value, "yachtType", "yacht_type");
  const yachtLengthValue = readValue(value, "yachtLength", "yacht_length");
  const yachtLengthUnitValue = readValue(
    value,
    "yachtLengthUnit",
    "yacht_length_unit",
  );
  const yachtLength = readPositiveNullableNumber(yachtLengthValue);
  const crewMemberCount = readPositiveWholeNumberNullable(
    readValue(value, "crewMemberCount", "crew_member_count"),
    200,
  );
  const candidateTypeValue = readValue(
    value,
    "candidateType",
    "candidate_type",
  );
  const smokerPolicyValue = readValue(
    value,
    "smokerPolicy",
    "smoker_policy",
  );
  const visibleTattooPolicyValue = readValue(
    value,
    "visibleTattooPolicy",
    "visible_tattoo_policy",
  );
  const minimumYachtExperienceValue = readValue(
    value,
    "minimumYachtExperience",
    "minimum_yacht_experience",
  );
  const minimumYachtExperience = isJobMinimumYachtExperience(
    minimumYachtExperienceValue,
  )
    ? minimumYachtExperienceValue
    : legacyMinimumYachtExperience(
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
    employmentType: isJobEmploymentType(
      readValue(value, "employmentType", "employment_type"),
    )
      ? readValue(value, "employmentType", "employment_type") as JobEmploymentType
      : "permanent",
    candidateType: isJobCandidateType(candidateTypeValue)
      ? candidateTypeValue
      : "individual",
    smokerPolicy: isJobSmokerPolicy(smokerPolicyValue)
      ? smokerPolicyValue
      : "no_preference",
    visibleTattooPolicy: isJobVisibleTattooPolicy(visibleTattooPolicyValue)
      ? visibleTattooPolicyValue
      : "no_preference",
    requiredLanguages: readJobRequiredLanguages(
      value,
      "requiredLanguages",
      "required_languages",
    ),
    requiredSkills: readJobOptions(
      readValue(value, "requiredSkills", "required_skills"),
      maximumJobSkillSelections,
      isJobSkill,
    ),
    requiredCharacteristics: readJobOptions(
      readValue(
        value,
        "requiredCharacteristics",
        "required_characteristics",
      ),
      maximumJobCharacteristicSelections,
      isJobCharacteristic,
    ),
    requiredCertificates: readJobOptions(
      readValue(value, "requiredCertificates", "required_certificates"),
      maximumJobCertificateSelections,
      isJobCertificate,
    ),
    requiredVisas: readJobOptions(
      readValue(value, "requiredVisas", "required_visas"),
      maximumJobVisaSelections,
      isJobVisa,
    ),
    location: readString(value, "location"),
    startDate: readString(value, "startDate", "start_date"),
    yachtBrand: readOptionalString(value, "yachtBrand", "yacht_brand"),
    yachtFlagCountryCode:
      countryOptionFromCode(
        readValue(value, "yachtFlagCountryCode", "yacht_flag_country_code"),
      )?.code || null,
    yachtBuildYear: readYachtBuildYear(
      readValue(value, "yachtBuildYear", "yacht_build_year"),
    ),
    yachtType: isJobYachtType(yachtTypeValue) ? yachtTypeValue : null,
    yachtLength:
      yachtLength !== null && yachtLengthUnit !== null ? yachtLength : null,
    yachtLengthUnit: yachtLength !== null ? yachtLengthUnit : null,
    crewMemberCount,
    minimumYachtExperience,
    summary: readString(value, "summary"),
    description: readString(value, "description"),
    responsibilities: readStringList(value, "responsibilities"),
    requirements: readStringList(value, "requirements"),
    benefits: readStringList(value, "benefits"),
    salary: parseSalary(value.salary),
    publishedAt: readString(value, "publishedAt", "published_at"),
  };
}

export function parsePublicJobs(value: unknown) {
  if (!Array.isArray(value)) return null;
  return value
    .map(parsePublicJob)
    .filter((job): job is PublicJob => Boolean(job));
}

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

  const flag = job.yachtFlagCountryCode
    ? formatCountryWithFlag(job.yachtFlagCountryCode)
    : "";
  const buildYear =
    job.yachtBuildYear === null
      ? ""
      : formatJobYachtBuildYear(job.yachtBuildYear, language);

  return [job.yachtBrand, flag, buildYear, type, length]
    .filter(Boolean)
    .join(" · ");
}

export function minimumYachtExperienceLabel(
  job: PublicJob,
  language: "en" | "tr",
) {
  return job.minimumYachtExperience === null
    ? ""
    : formatJobMinimumYachtExperience(
        job.minimumYachtExperience,
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

function readOptionalString(record: UnknownRecord, ...keys: string[]) {
  const text = readString(record, ...keys);
  return text ? text.slice(0, 80) : null;
}

function readValue(record: UnknownRecord, ...keys: string[]) {
  for (const key of keys) {
    if (key in record) return record[key];
  }
  return undefined;
}

function readStringList(
  record: UnknownRecord,
  key: string,
  fallbackKey?: string,
) {
  const value = record[key] ?? (fallbackKey ? record[fallbackKey] : undefined);
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function readJobRequiredLanguages(
  record: UnknownRecord,
  key: string,
  fallbackKey?: string,
) {
  return readStringList(record, key, fallbackKey).filter(
    isJobRequiredLanguage,
  );
}

function readJobOptions<Option extends string>(
  value: unknown,
  maximumCount: number,
  isOption: (item: unknown) => item is Option,
) {
  if (!Array.isArray(value)) return [];
  const result: Option[] = [];
  for (const item of value) {
    if (isOption(item) && !result.includes(item)) result.push(item);
  }
  return result.slice(0, maximumCount);
}

function readNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readPositiveNullableNumber(value: unknown) {
  const number = readNullableNumber(value);
  return number !== null && number > 0 ? number : null;
}

function readPositiveWholeNumberNullable(value: unknown, maximum: number) {
  const number = readNullableNumber(value);
  return number !== null &&
    Number.isSafeInteger(number) &&
    number >= 1 &&
    number <= maximum
    ? number
    : null;
}

function readYachtBuildYear(value: unknown) {
  const number = readNullableNumber(value);
  return number !== null &&
    Number.isSafeInteger(number) &&
    number >= 1800 &&
    number <= 2100
    ? number
    : null;
}

function legacyMinimumYachtExperience(
  value: unknown,
): JobMinimumYachtExperience | null {
  const number = readNullableNumber(value);
  if (number === null || !Number.isSafeInteger(number) || number < 0) {
    return null;
  }
  if (number === 0) return "0_6_months";
  if (number === 1) return "1_year";
  if (number === 2) return "2_years";
  if (number === 3) return "3_years";
  if (number <= 5) return "3_5_years";
  if (number <= 10) return "5_10_years";
  if (number < 15) return "10_plus_years";
  if (number < 20) return "15_plus_years";
  return "20_plus_years";
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

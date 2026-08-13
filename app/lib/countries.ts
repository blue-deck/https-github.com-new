import countries from "world-countries";

export type CountryLanguage = "en" | "tr";

export type BlueDeckCountry = {
  flag: string;
  code: string;
  country: string;
  nationality: string;
  dial: string;
  region: string;
  subregion?: string;
};

export type BlueDeckNationalityOption = {
  flag: string;
  code: string;
  country: string;
  countryEn: string;
  countryTr: string;
  nationality: string;
  region: string;
  subregion?: string;
};

function buildDialCode(country: (typeof countries)[number]) {
  const root = country.idd?.root;
  const suffix = country.idd?.suffixes?.[0];
  if (!root || !suffix) return "";
  return `${root}${suffix}`;
}

function asciiCountryName(value: string) {
  return value
    .replaceAll("’", "'")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function englishCountryName(country: (typeof countries)[number]) {
  if (country.cca2 === "TR") return "Turkey";
  return asciiCountryName(country.name.common);
}

export const blueDeckCountries: BlueDeckCountry[] = countries
  .map((country) => ({
    flag: country.flag,
    code: country.cca2,
    country: country.name.common,
    nationality: country.demonyms?.eng?.m || country.name.common,
    dial: buildDialCode(country),
    region: country.region,
    subregion: country.subregion,
  }))
  .filter((country) => country.dial)
  .sort((a, b) => sortBlueDeckCountries(a, b, "en"));

export const nationalityOptions: BlueDeckNationalityOption[] = countries
  .map((country) => ({
    flag: country.flag,
    code: country.cca2,
    country: country.name.common,
    countryEn: englishCountryName(country),
    countryTr: country.translations.tur.common,
    nationality: country.demonyms?.eng?.m || englishCountryName(country),
    region: country.region,
    subregion: country.subregion,
  }))
  .sort((a, b) => sortBlueDeckCountries(a, b, "en"));

export const nationalityFilterValues = Array.from(
  new Set(
    nationalityOptions.flatMap((country) => [
      country.countryEn,
      country.nationality,
    ]),
  ),
);

export function countryNameForLanguage(
  country: BlueDeckNationalityOption,
  language: CountryLanguage,
) {
  return language === "tr" ? country.countryTr : country.countryEn;
}

export function nationalityOptionsForLanguage(language: CountryLanguage) {
  return [...nationalityOptions].sort((a, b) =>
    sortBlueDeckCountries(a, b, language),
  );
}

export function countryOptionFromNationalityValue(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = normalizeCountrySearchText(value);
  if (!normalized) return undefined;

  return nationalityOptions.find((country) =>
    [
      country.code,
      country.country,
      country.countryEn,
      country.countryTr,
      country.nationality,
    ].some((candidate) => normalizeCountrySearchText(candidate) === normalized),
  );
}

export function nationalityStorageValue(country: BlueDeckNationalityOption) {
  return country.countryEn;
}

export function nationalityValueMatchesCountry(
  nationalityValue: string,
  countryValue: string,
) {
  const selectedCountry = countryOptionFromNationalityValue(countryValue);
  if (!selectedCountry) return false;

  const normalizedValue = normalizeCountrySearchText(nationalityValue);
  return [
    selectedCountry.code,
    selectedCountry.country,
    selectedCountry.countryEn,
    selectedCountry.countryTr,
    selectedCountry.nationality,
  ].some(
    (candidate) => normalizeCountrySearchText(candidate) === normalizedValue,
  );
}

export function searchNationalityOptions(
  query: string,
  language: CountryLanguage,
) {
  const ordered = nationalityOptionsForLanguage(language);
  const normalizedQuery = normalizeCountrySearchText(query);
  if (!normalizedQuery) return ordered;

  return ordered
    .map((country, stableIndex) => ({
      country,
      stableIndex,
      score: countrySearchScore(
        countryNameForLanguage(country, language),
        normalizedQuery,
      ),
    }))
    .filter((result) => Number.isFinite(result.score))
    .sort((a, b) => a.score - b.score || a.stableIndex - b.stableIndex)
    .map((result) => result.country);
}

export function countryOptionFromCode(value: unknown) {
  if (typeof value !== "string") return undefined;
  const code = value.trim().toUpperCase();
  return nationalityOptions.find((country) => country.code === code);
}

export function isBlueDeckCountryCode(value: unknown): value is string {
  return Boolean(countryOptionFromCode(value));
}

export function formatCountryWithFlag(value: string) {
  const country = countryOptionFromCode(value);
  return country ? `${country.flag} ${country.country}` : "";
}

function normalizeCountrySearchText(value: string) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function countrySearchScore(value: string, normalizedQuery: string) {
  const normalizedValue = normalizeCountrySearchText(value);
  if (normalizedValue === normalizedQuery) return 0;
  if (normalizedValue.startsWith(normalizedQuery)) return 10;
  if (
    normalizedValue
      .split(" ")
      .some((word) => word.startsWith(normalizedQuery))
  ) {
    return 20;
  }

  const containsAt = normalizedValue.indexOf(normalizedQuery);
  if (containsAt >= 0) return 30 + containsAt;

  let queryIndex = 0;
  let firstMatch = -1;
  let lastMatch = -1;
  for (let index = 0; index < normalizedValue.length; index += 1) {
    if (normalizedValue[index] !== normalizedQuery[queryIndex]) continue;
    if (firstMatch < 0) firstMatch = index;
    lastMatch = index;
    queryIndex += 1;
    if (queryIndex === normalizedQuery.length) {
      return 100 + firstMatch + (lastMatch - firstMatch - queryIndex);
    }
  }

  return Number.POSITIVE_INFINITY;
}

function countryPriority(country: { code: string; region: string }) {
  if (country.code === "TR") return 0;
  if (country.region === "Europe") return 1;
  if (country.code === "US") return 2;
  if (country.code === "RU") return 3;
  if (country.code === "AE") return 4;
  if (country.code === "IL") return 5;
  return 6;
}

function sortBlueDeckCountries<
  T extends {
    code: string;
    country: string;
    countryEn?: string;
    countryTr?: string;
    region: string;
  },
>(a: T, b: T, language: CountryLanguage) {
  const priority = countryPriority(a) - countryPriority(b);
  if (priority !== 0) return priority;

  const aName =
    language === "tr" && a.countryTr ? a.countryTr : a.countryEn || a.country;
  const bName =
    language === "tr" && b.countryTr ? b.countryTr : b.countryEn || b.country;
  return aName.localeCompare(bName, language === "tr" ? "tr-TR" : "en-US");
}

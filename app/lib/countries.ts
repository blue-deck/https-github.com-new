import countries from "world-countries";

export type BlueDeckCountry = {
  flag: string;
  code: string;
  country: string;
  nationality: string;
  dial: string;
  region: string;
  subregion?: string;
};

function buildDialCode(country: (typeof countries)[number]) {
  const root = country.idd?.root;
  const suffix = country.idd?.suffixes?.[0];
  if (!root || !suffix) return "";
  return `${root}${suffix}`;
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
  .sort(sortBlueDeckCountries);

export const nationalityOptions = countries
  .map((country) => ({
    flag: country.flag,
    code: country.cca2,
    country: country.name.common,
    nationality: country.demonyms?.eng?.m || country.name.common,
    region: country.region,
    subregion: country.subregion,
  }))
  .sort(sortBlueDeckCountries);

function countryPriority(country: { country: string; region: string }) {
  if (country.country === "Turkey" || country.country === "Türkiye") return 0;
  if (country.region === "Europe") return 1;
  if (country.country === "United States") return 2;
  if (country.country === "Russia") return 3;
  if (country.country === "United Arab Emirates") return 4;
  if (country.country === "Israel") return 5;
  return 6;
}

function sortBlueDeckCountries<T extends { country: string; region: string }>(a: T, b: T) {
  const priority = countryPriority(a) - countryPriority(b);
  if (priority !== 0) return priority;
  return a.country.localeCompare(b.country);
}

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canonicalNationalityValue,
  countryNameForLanguage,
  countryOptionFromNationalityValue,
  nationalityOptions,
  nationalityOptionsForLanguage,
  nationalityStorageValue,
  nationalityValueMatchesCountry,
  searchNationalityOptions,
} from "../app/lib/countries.ts";

test("nationality picker contains every country with Turkey and Europe first", () => {
  assert.equal(nationalityOptions.length, 250);
  assert.equal(new Set(nationalityOptions.map((country) => country.code)).size, 250);

  for (const language of ["en", "tr"]) {
    const ordered = nationalityOptionsForLanguage(language);
    assert.equal(ordered[0]?.code, "TR");

    const lastEuropeanIndex = ordered.reduce(
      (lastIndex, country, index) =>
        country.region === "Europe" ? index : lastIndex,
      -1,
    );
    const firstOtherIndex = ordered.findIndex(
      (country) => country.code !== "TR" && country.region !== "Europe",
    );
    assert.ok(lastEuropeanIndex > 0);
    assert.ok(firstOtherIndex > lastEuropeanIndex);
  }
});

test("country names follow the selected site language", () => {
  const turkey = nationalityOptions.find((country) => country.code === "TR");
  const germany = nationalityOptions.find((country) => country.code === "DE");
  assert.ok(turkey && germany);
  assert.equal(countryNameForLanguage(turkey, "en"), "Turkey");
  assert.equal(countryNameForLanguage(turkey, "tr"), "Türkiye");
  assert.equal(countryNameForLanguage(germany, "en"), "Germany");
  assert.equal(countryNameForLanguage(germany, "tr"), "Almanya");

  for (const country of nationalityOptions) {
    assert.match(countryNameForLanguage(country, "en"), /^[\x20-\x7E]+$/);
    assert.ok(countryNameForLanguage(country, "tr").length > 0);
  }
});

test("country search ranks localized names and keeps languages separate", () => {
  assert.equal(searchNationalityOptions("alm", "tr")[0]?.code, "DE");
  assert.equal(searchNationalityOptions("ger", "en")[0]?.code, "DE");
  assert.equal(searchNationalityOptions("tur", "en")[0]?.code, "TR");
  assert.equal(searchNationalityOptions("tür", "tr")[0]?.code, "TR");
  assert.equal(
    searchNationalityOptions("Germany", "tr").some(
      (country) => country.code === "DE",
    ),
    false,
  );
});

test("country values are unique for new profiles and recognize legacy demonyms", () => {
  assert.equal(
    new Set(nationalityOptions.map(nationalityStorageValue)).size,
    nationalityOptions.length,
  );
  const germany = countryOptionFromNationalityValue("German");
  assert.equal(germany?.code, "DE");
  assert.equal(germany && nationalityStorageValue(germany), "Germany");
  assert.equal(nationalityValueMatchesCountry("German", "Germany"), true);
  assert.equal(nationalityValueMatchesCountry("Germany", "Germany"), true);
  assert.equal(nationalityValueMatchesCountry("German", "France"), false);

  const turkey = countryOptionFromNationalityValue("Turkish");
  assert.equal(turkey?.code, "TR");
  assert.equal(turkey && nationalityStorageValue(turkey), "Turkey");
  assert.equal(canonicalNationalityValue("Turkish"), "Turkey");
  assert.equal(canonicalNationalityValue(" turkish "), "Turkey");
  assert.equal(nationalityValueMatchesCountry("Turkish", "Turkey"), true);
});

test("My Profile and Find Crew use the shared nationality search field", async () => {
  const [profilePage, findCrewClient] = await Promise.all([
    readFile(new URL("../app/profile/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(profilePage, /<NationalitySearchField/);
  assert.match(findCrewClient, /<NationalitySearchField/);
  assert.match(profilePage, /nationality: canonicalNationalityValue\(profile\.nationality\)/);
  assert.match(
    findCrewClient,
    /<NationalitySearchField[\s\S]*?value=\{draftFilters\.nationality\}/,
  );
  assert.doesNotMatch(profilePage, /function NationalitySelect/);
  assert.doesNotMatch(findCrewClient, /optionKind="nationality"/);
});

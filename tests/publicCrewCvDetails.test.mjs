import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Run the real projection and redaction modules without a Next.js runtime.
// Only the build-time server-only marker is replaced; data behavior is not mocked.
const moduleCache = new Map();
function loadLocalModule(file) {
  const key = file.href;
  if (moduleCache.has(key)) return moduleCache.get(key).exports;
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  moduleCache.set(key, loadedModule);
  const requireLocal = (specifier) => {
    if (specifier === "server-only") return {};
    assert.ok(specifier.startsWith("."), `Unexpected dependency: ${specifier}`);
    const extension = specifier.endsWith(".ts") ? "" : ".ts";
    return loadLocalModule(new URL(`${specifier}${extension}`, file));
  };
  new Function("require", "module", "exports", compiled)(
    requireLocal,
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}

const { projectPublicCrewCvProfile, cleanCvContactText, cvContactHref } =
  loadLocalModule(new URL("../app/lib/publicCrewCv.ts", import.meta.url));

const discovery = {
  discoverable: true,
  availabilityStatus: "Available",
  employmentTypes: ["Permanent", "Rotational"],
  preferredLocations: ["Mediterranean", "Caribbean"],
  contactVisibility: "request_only",
};

function profile(overrides = {}) {
  return {
    full_name: "  Ada Deniz  ",
    current_position: "Chief Stewardess",
    current_positions: ["Chief Stewardess"],
    date_of_birth: "1996-02-29",
    nationality: "Turkish",
    gender: "Female",
    marital_status: "Married",
    height_cm: 172,
    weight_kg: 63,
    smoker: "No",
    visible_tattoos: "Yes",
    phone: "  +90 555 123 45 67  ",
    email: "  ada@example.com  ",
    location: "Antalya, Türkiye",
    bio: "Chief stewardess with private and charter yacht experience.",
    languages: [
      { name: "English", level: "Fluent" },
      { name: "Turkish", level: "Native" },
    ],
    personal_skills: ["Silver service", "Wine knowledge"],
    personal_characteristics: ["Team player", "Organised"],
    work_preferences: ["Motor yacht", "Private"],
    ...overrides,
  };
}

test("public CV retains every personal detail entered in My Profile", () => {
  const projected = projectPublicCrewCvProfile(profile(), discovery);
  const expected = {
    full_name: "Ada Deniz",
    current_position: "Chief Stewardess",
    current_positions: ["Chief Stewardess"],
    date_of_birth: "1996-02-29",
    nationality: "Turkish",
    gender: "Female",
    marital_status: "Married",
    height_cm: 172,
    weight_kg: 63,
    smoker: "No",
    visible_tattoos: "Yes",
    phone: "+90 555 123 45 67",
    email: "ada@example.com",
    location: "Antalya, Türkiye",
  };
  for (const [field, value] of Object.entries(expected)) {
    assert.deepEqual(projected[field], value, field);
  }
});

test("public CV preserves the complete language, skill and career preference groups", () => {
  const input = profile();
  const projected = projectPublicCrewCvProfile(input, discovery);
  for (const field of [
    "bio",
    "languages",
    "personal_skills",
    "personal_characteristics",
    "work_preferences",
  ]) {
    assert.deepEqual(projected[field], input[field], field);
  }
  assert.deepEqual(projected.employment_types, discovery.employmentTypes);
  assert.deepEqual(projected.preferred_locations, discovery.preferredLocations);
});

test("selected CV contacts are public while private account and storage fields stay out", () => {
  const projected = projectPublicCrewCvProfile(profile({
    id: "private-profile-id",
    user_id: "private-user-id",
    public_crew_id: "BD-CREW_01",
    notes: "Internal crew notes must stay private",
    profile_photo_url: "private-owner/profile-photo.jpg",
    file_url: "private-owner/passport.pdf",
    status: "active",
  }), discovery);

  assert.equal(projected.phone, "+90 555 123 45 67");
  assert.equal(projected.email, "ada@example.com");
  for (const field of [
    "id", "user_id", "public_crew_id", "notes", "profile_photo_url", "file_url", "status",
  ]) {
    assert.equal(Object.hasOwn(projected, field), false, field);
  }
  assert.doesNotMatch(JSON.stringify(projected), /private-owner|private-user-id|Internal crew notes/);
});

test("measurements accept saved numbers and numeric strings, rejecting malformed values", () => {
  for (const value of [1, 172, 999, 63.5, "172", " 63.5 "]) {
    const projected = projectPublicCrewCvProfile(profile({
      height_cm: value, weight_kg: value,
    }), discovery);
    assert.equal(projected.height_cm, Number(value));
    assert.equal(projected.weight_kg, Number(value));
  }

  for (const value of [0, -1, 1000, NaN, Infinity, "", " ", "unknown", null, undefined, true, {}, []]) {
    const projected = projectPublicCrewCvProfile(profile({
      height_cm: value, weight_kg: value,
    }), discovery);
    assert.equal(projected.height_cm, null, String(value));
    assert.equal(projected.weight_kg, null, String(value));
  }
});

test("birth dates preserve real ISO calendar dates without accepting misleading text", () => {
  for (const value of ["1996-02-29", "2000-02-29", "1994-12-31"]) {
    assert.equal(projectPublicCrewCvProfile(profile({ date_of_birth: value }), discovery).date_of_birth, value);
  }
  for (const value of ["1995-02-29", "1900-02-29", "1996-02-30", "1996-13-01", "1996-00-01", "29/02/1996", "1996-2-9", "1996-02-29T00:00:00Z", "contact@example.com", "", null, 1996]) {
    assert.equal(projectPublicCrewCvProfile(profile({ date_of_birth: value }), discovery).date_of_birth, "", String(value));
  }
});

test("contact cleanup preserves useful text while removing controls and bounding length", () => {
  assert.equal(cleanCvContactText("  ada@example.com  ", 254), "ada@example.com");
  assert.doesNotMatch(cleanCvContactText("ada@example.com\r\n\t\u0000", 254), /[\u0000-\u001f\u007f]/);
  assert.equal(cleanCvContactText("x".repeat(400), 254).length, 254);
  assert.equal(cleanCvContactText(null, 80), "");
});

test("contact links use only telephone and mail actions without accepting header injection", () => {
  assert.equal(cvContactHref("phone", "+90 555 123 45 67"), "tel:+905551234567");
  assert.equal(cvContactHref("email", "ada@example.com"), "mailto:ada@example.com");
  for (const value of ["javascript:alert(1)", "https://example.com", "", "not an email", "ada@example.com?bcc=other@example.com", "ada@example.com&body=hello", "ada@example.com\r\nBcc:other@example.com"]) {
    assert.equal(cvContactHref("email", value), undefined, value);
  }
  for (const value of ["javascript:alert(1)", "https://example.com", "", "call me", "123?body=hello"]) {
    assert.equal(cvContactHref("phone", value), undefined, value);
  }
});

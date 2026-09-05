import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const requireDependency = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);
const crewId = "BD-CV-FIXTURE";
const profileId = "10000000-0000-4000-8000-000000000001";
const ownerId = "20000000-0000-4000-8000-000000000002";
const otherProfileId = "30000000-0000-4000-8000-000000000003";

function fixture() {
  const experiences = Array.from({ length: 63 }, (_, index) => ({
    id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    crew_profile_id: profileId,
    yacht_name: `Fixture workplace ${String(index + 1).padStart(2, "0")}`,
    yacht_type: index < 31 ? "Motor yacht" : "__BLUDECK_OTHER_WORK__",
    yacht_program: index < 31 ? "Private" : "Other work",
    yacht_size: "40 m",
    position: index < 31 ? "Stewardess" : "Hospitality supervisor",
    start_date: "2020-01-01",
    end_date: "2020-02-01",
    location: "Antalya",
    description: `Fixture duties ${String(index + 1).padStart(2, "0")}`,
    photo_url: "",
  }));
  const documents = Array.from({ length: 15 }, (_, index) => ({
    id: `document-${index + 1}`,
    crew_profile_id: profileId,
    document_type: `Fixture certificate ${String(index + 1).padStart(2, "0")}`,
    category: "Certificate",
    issuer: "Fixture maritime academy",
    expiry_date: "2028-01-01",
    no_expiry: false,
    show_on_cv: true,
  }));
  const references = Array.from({ length: 8 }, (_, index) => ({
    id: `reference-${index + 1}`,
    crew_profile_id: profileId,
    // Labels intentionally differ from the workplace: the saved association
    // must survive the real SELECT/projection rather than matching by name.
    crew_experience_id: index < 3 ? experiences[0].id : null,
    name: `${index < 3 ? "Attached" : "Unlinked"} referee ${index + 1}`,
    role: "Captain",
    vessel: "A differently named vessel",
    company: "Fixture reference company",
    phone: `+90 555 000 00 ${String(index + 1).padStart(2, "0")}`,
    email: `referee${index + 1}@example.test`,
    show_on_cv: true,
  }));
  return {
    profile: {
      id: profileId,
      user_id: ownerId,
      public_crew_id: crewId,
      full_name: "Ada Deniz",
      current_position: "Chief Stewardess",
      nationality: "Turkish",
      date_of_birth: "1996-02-29",
      gender: "Female",
      marital_status: "Married",
      height_cm: 172,
      weight_kg: 63,
      smoker: "No",
      visible_tattoos: "Yes",
      phone: "+90 555 123 45 67",
      email: "ada@example.test",
      location: "Antalya, Türkiye",
      bio: "A complete fixture CV for maritime service.",
      notes: "PRIVATE_INTERNAL_NOTES",
      languages: [{ name: "English", level: "Fluent" }],
      personal_skills: ["Silver service"],
      personal_characteristics: ["Team player"],
      work_preferences: ["Motor yacht"],
    },
    discovery: {
      discoverable: true,
      availabilityStatus: "Available",
      employmentTypes: ["Permanent", "Rotational"],
      preferredLocations: ["Mediterranean", "Caribbean"],
      contactVisibility: "request_only",
    },
    experiences,
    documents,
    references,
    tables: {
      crew_experiences: [
        ...experiences,
        { ...experiences[0], id: "outside-experience", crew_profile_id: otherProfileId, yacht_name: "OUTSIDE_WORKPLACE" },
      ],
      crew_documents: [
        ...documents,
        { ...documents[0], id: "hidden-document", show_on_cv: false, document_type: "DESELECTED_CERTIFICATE" },
        { ...documents[0], id: "outside-document", crew_profile_id: otherProfileId, document_type: "OUTSIDE_CERTIFICATE" },
      ],
      crew_references: [
        ...references,
        { ...references[0], id: "hidden-reference", show_on_cv: false, name: "DESELECTED_REFERENCE" },
        { ...references[0], id: "outside-reference", crew_profile_id: otherProfileId, name: "OUTSIDE_REFERENCE" },
      ],
    },
  };
}

function serviceClient(tables, requests, failingTable) {
  return {
    from(table) {
      assert.ok(Object.hasOwn(tables, table), `Unexpected table ${table}`);
      const request = { table, filters: [], columns: [], limit: Infinity, range: null };
      requests.push(request);
      const query = {
        select(columns) { request.columns = columns.split(","); return query; },
        eq(field, value) { request.filters.push([field, value]); return query; },
        order() { return query; },
        limit(value) { request.limit = value; return query; },
        range(start, end) { request.range = [start, end]; return query; },
        then(resolve, reject) {
          let rows = tables[table].filter((row) => request.filters.every(([key, value]) => row[key] === value));
          rows = request.range ? rows.slice(request.range[0], request.range[1] + 1) : rows.slice(0, request.limit);
          const data = rows.map((row) => Object.fromEntries(request.columns.map((column) => [column, row[column]])));
          return Promise.resolve(table === failingTable
            ? { data: null, error: { message: "Fixture database unavailable" } }
            : { data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

function loadPage(context) {
  const moduleCache = new Map();
  const notFoundError = Object.assign(new Error("Crew CV not found"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  const overrides = new Map([
    [new URL("app/lib/findCrewData.ts", root).href, {
      loadEligiblePublicCrewContext: async (requestedId) => {
        assert.equal(requestedId, crewId);
        return context;
      },
    }],
    [new URL("app/components/CvScaleFrame.tsx", root).href, { CvScaleFrame: ({ children }) => children }],
    [new URL("app/components/BlueDeckLogo.tsx", root).href, { BlueDeckMark: () => null }],
  ]);

  function loadLocalModule(file) {
    if (overrides.has(file.href)) return overrides.get(file.href);
    if (moduleCache.has(file.href)) return moduleCache.get(file.href).exports;
    const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
      fileName: file.pathname,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
    const loadedModule = { exports: {} };
    moduleCache.set(file.href, loadedModule);
    const requireLocal = (specifier) => {
      if (specifier === "server-only") return {};
      if (specifier === "next/navigation") return { notFound: () => { throw notFoundError; } };
      if (specifier === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
      if (!specifier.startsWith(".")) return requireDependency(specifier);
      const target = new URL(specifier, file);
      const resolved = [target, new URL(`${specifier}.ts`, file), new URL(`${specifier}.tsx`, file)].find((candidate) => existsSync(candidate));
      assert.ok(resolved, `Cannot resolve ${specifier}`);
      return loadLocalModule(resolved);
    };
    new Function("require", "module", "exports", compiled)(requireLocal, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }

  return { ...loadLocalModule(new URL("app/crew/[crewId]/page.tsx", root)), notFoundError };
}

test("Open CV renders all selected CV records, personal details and usable crew/reference contacts", async () => {
  const data = fixture();
  const requests = [];
  const page = loadPage({
    crewId,
    profile: data.profile,
    discovery: data.discovery,
    serviceClient: serviceClient(data.tables, requests),
  });
  const markup = renderToStaticMarkup(await page.default({ params: Promise.resolve({ crewId }) }));

  for (const value of ["Personal details", "Date of birth", "29 Feb 1996", "Female", "Married", "172 cm", "63 kg", "Smoker", "Visible tattoos", "Employment types", "Preferred hiring regions", "Rotational", "Caribbean"]) {
    assert.ok(markup.includes(value), `Missing CV detail: ${value}`);
  }
  assert.ok(markup.includes('href="tel:+905551234567"'));
  assert.ok(markup.includes('href="mailto:ada@example.test"'));
  for (const document of data.documents) assert.ok(markup.includes(document.document_type), document.document_type);

  const articles = markup.match(/<article\b[^>]*>[\s\S]*?<\/article>/g) || [];
  assert.equal(articles.length, data.experiences.length);
  for (const experience of data.experiences) {
    assert.ok(markup.includes(experience.yacht_name), experience.yacht_name);
    assert.ok(markup.includes(experience.description), experience.description);
  }
  const linkedArticle = articles.find((article) => article.includes(data.experiences[0].yacht_name));
  assert.ok(linkedArticle);
  for (const reference of data.references) {
    assert.ok(markup.includes(reference.name), reference.name);
    assert.ok(markup.includes(reference.phone), reference.phone);
    assert.ok(markup.includes(`href="mailto:${reference.email}"`), reference.email);
    assert.ok(markup.includes(`href="tel:${reference.phone.replace(/\s/g, "")}"`), reference.phone);
    if (reference.crew_experience_id) assert.ok(linkedArticle.includes(reference.name), `${reference.name} lost its saved experience association`);
    else assert.equal(articles.some((article) => article.includes(reference.name)), false, `${reference.name} was attached to an unrelated experience`);
  }
  assert.doesNotMatch(markup, /DESELECTED_|OUTSIDE_|PRIVATE_INTERNAL_NOTES|__BLUDECK_OTHER_WORK__/);
  assert.equal(requests.length, 3);
});

test("Open CV fails closed when the public crew eligibility boundary rejects the profile", async () => {
  const page = loadPage(null);
  await assert.rejects(page.default({ params: Promise.resolve({ crewId }) }), (error) => error === page.notFoundError);
  const metadata = await page.generateMetadata({ params: Promise.resolve({ crewId }) });
  assert.equal(metadata.title, "Crew CV not found | BlueDeck");
  assert.deepEqual(metadata.robots, { index: false, follow: false });
});

test("Open CV does not publish an incomplete CV when selected records fail to load", async () => {
  const data = fixture();
  const page = loadPage({
    crewId,
    profile: data.profile,
    discovery: data.discovery,
    serviceClient: serviceClient(data.tables, [], "crew_references"),
  });
  await assert.rejects(page.default({ params: Promise.resolve({ crewId }) }), (error) => error === page.notFoundError);
});

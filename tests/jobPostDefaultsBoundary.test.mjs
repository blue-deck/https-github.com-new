import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("new job posts start with explicit placeholders and Any preferences", async () => {
  const manager = await source("app/hiring/jobs/JobPostsManager.tsx");

  assert.match(manager, /employmentTypePlaceholder: "Select employment type"/);
  assert.match(manager, /locationPlaceholder: "Search location"/);
  assert.match(
    manager,
    /<option value="any">\{c\.any\}<\/option>[\s\S]*?<option value="no">\{c\.no\}<\/option>[\s\S]*?<option value="yes">\{c\.yes\}<\/option>/,
  );
  assert.match(
    manager,
    /employmentType: "",[\s\S]*?candidateType: "any",[\s\S]*?smokerPolicy: "no_preference",[\s\S]*?visibleTattooPolicy: "no_preference"/,
  );
  assert.match(
    manager,
    /policy === "no_preference"[\s\S]*?\? c\.any[\s\S]*?formatJobSmokerPolicy/,
  );
  assert.match(
    manager,
    /policy === "no_preference"[\s\S]*?\? c\.any[\s\S]*?formatJobVisibleTattooPolicy/,
  );
  assert.match(manager, /if \(value === "yes"\) return "team"/);
  assert.match(manager, /if \(value === "no"\) return "individual"/);
  assert.match(manager, /return "any"/);
});

test("Any is a persisted candidate type and the database default", async () => {
  const [jobPosts, migration] = await Promise.all([
    source("app/lib/jobPosts.ts"),
    source(
      "supabase/migrations/20260821105637_allow_any_job_candidate_type.sql",
    ),
  ]);

  assert.match(
    jobPosts,
    /jobCandidateTypes = \["any", "individual", "team", "couple"\]/,
  );
  assert.match(
    migration,
    /alter column candidate_type set default 'any'/,
  );
});

test("salary input hides native number spinner controls", async () => {
  const manager = await source("app/hiring/jobs/JobPostsManager.tsx");
  const salaryInput = manager.slice(
    manager.indexOf('aria-label={c.salaryAmount}') - 300,
    manager.indexOf('aria-label={c.currency}'),
  );

  assert.match(salaryInput, /\[appearance:textfield\]/);
  assert.match(
    salaryInput,
    /\[&::-webkit-inner-spin-button\]:appearance-none/,
  );
  assert.match(
    salaryInput,
    /\[&::-webkit-outer-spin-button\]:appearance-none/,
  );
});

test("salary amount, currency, and period share one control", async () => {
  const manager = await source("app/hiring/jobs/JobPostsManager.tsx");
  const salarySectionStart = manager.indexOf("{c.salary}");
  const salaryFieldsetStart = manager.indexOf("<fieldset>", salarySectionStart);
  const salaryFieldsetEnd = manager.indexOf(
    "</fieldset>",
    salaryFieldsetStart,
  );
  const salaryControl = manager.slice(
    salaryFieldsetStart,
    salaryFieldsetEnd,
  );

  const amountIndex = salaryControl.indexOf("aria-label={c.salaryAmount}");
  const currencyIndex = salaryControl.indexOf("aria-label={c.currency}");
  const periodIndex = salaryControl.indexOf("aria-label={c.period}");

  assert.ok(amountIndex >= 0);
  assert.ok(currencyIndex > amountIndex);
  assert.ok(periodIndex > currencyIndex);
  assert.match(salaryControl, /updateForm\(\s*"salaryCurrency"/);
  assert.match(salaryControl, /updateForm\(\s*"salaryPeriod"/);
  assert.equal(salaryControl.match(/px-1\.5 text-xs/g)?.length, 2);
  assert.equal(salaryControl.match(/sm:px-3 sm:text-sm/g)?.length, 2);
  assert.equal(
    salaryControl.match(/focus-visible:shadow-\[inset_0_0_0_2px_#06b6d4\]/g)
      ?.length,
    3,
  );
  assert.doesNotMatch(manager, /<Field label=\{c\.period\}>/);
  assert.match(manager, /salaryCurrency: form\.salaryCurrency/);
  assert.match(manager, /salaryPeriod: form\.salaryPeriod/);
});

test("salary control is rendered inside Job basics", async () => {
  const manager = await source("app/hiring/jobs/JobPostsManager.tsx");
  const basicsStart = manager.indexOf("title={c.identity}");
  const candidatePreferencesStart = manager.indexOf(
    "title={c.candidatePreferences}",
    basicsStart,
  );
  const salaryStart = manager.indexOf("{c.salary}", basicsStart);
  const narrativeStart = manager.indexOf("title={c.narrative}");

  assert.ok(basicsStart >= 0);
  assert.ok(salaryStart > basicsStart);
  assert.ok(salaryStart < candidatePreferencesStart);
  assert.ok(narrativeStart > candidatePreferencesStart);
  assert.equal(manager.match(/aria-label=\{c\.salaryAmount\}/g)?.length, 1);
  assert.equal(manager.indexOf("{c.salary}", narrativeStart), -1);
  assert.match(manager, /narrative: "Description"/);
  assert.match(manager, /narrative: "Açıklama"/);
});

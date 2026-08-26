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

test("Create Job keeps Yacht program optional, shared, and directly below Yacht type", async () => {
  const [manager, jobPosts] = await Promise.all([
    source("app/hiring/jobs/JobPostsManager.tsx"),
    source("app/lib/jobPosts.ts"),
  ]);

  assert.match(
    jobPosts,
    /export const jobYachtPrograms = \[\s*"private",\s*"charter",\s*"private_charter",?\s*\] as const/,
  );
  assert.match(
    jobPosts,
    /private: \{ en: "Private", tr: "Özel" \}/,
  );
  assert.match(
    jobPosts,
    /charter: \{ en: "Charter", tr: "Charter" \}/,
  );
  assert.match(
    jobPosts,
    /private_charter: \{ en: "Private & Charter", tr: "Özel & Charter" \}/,
  );
  assert.match(jobPosts, /export function formatJobYachtProgram\(/);

  assert.match(manager, /yachtProgramPlaceholder: "Select yacht program"/);
  assert.match(manager, /yachtProgramPlaceholder: "Yat programını seç"/);
  assert.match(manager, /yachtProgram: JobYachtProgram \| ""/);
  assert.match(
    manager,
    /<option value="">\{c\.yachtProgramPlaceholder\}<\/option>[\s\S]*?\{jobYachtPrograms\.map\(\(program\) => \([\s\S]*?formatJobYachtProgram\(program, language\)/,
  );

  const payload = manager.slice(
    manager.indexOf("const payload ="),
    manager.indexOf("try {", manager.indexOf("const payload =")),
  );
  const emptyForm = manager.slice(
    manager.indexOf("function emptyForm()"),
    manager.indexOf("function teamCoupleSelection"),
  );
  const editHydration = manager.slice(
    manager.indexOf("function formFromJob("),
    manager.indexOf("function RequiredFieldLabel"),
  );
  assert.match(payload, /yachtProgram: form\.yachtProgram \|\| null/);
  assert.match(emptyForm, /yachtType: "",\s*yachtProgram: "",/);
  assert.match(editHydration, /yachtProgram: job\.yachtProgram \|\| ""/);

  const yachtSectionStart = manager.indexOf("title={c.yachtDetails}");
  const yachtSectionEnd = manager.indexOf(
    "title={c.candidatePreferences}",
    yachtSectionStart,
  );
  const yachtSection = manager.slice(yachtSectionStart, yachtSectionEnd);
  const leftColumnStart = yachtSection.indexOf(
    '<div className="grid content-start gap-5">',
  );
  const leftColumnEnd = yachtSection.indexOf("</div>", leftColumnStart);
  const leftColumn = yachtSection.slice(leftColumnStart, leftColumnEnd);
  const yachtTypeStart = leftColumn.indexOf("label={c.yachtType}");
  const yachtProgramStart = leftColumn.indexOf("label={c.yachtProgram}");
  const yachtTypeField = leftColumn.slice(yachtTypeStart, yachtProgramStart);
  const yachtProgramField = leftColumn.slice(yachtProgramStart);

  assert.ok(yachtSectionStart >= 0);
  assert.ok(yachtSectionEnd > yachtSectionStart);
  assert.ok(leftColumnStart >= 0);
  assert.ok(leftColumnEnd > leftColumnStart);
  assert.ok(yachtTypeStart >= 0);
  assert.ok(yachtProgramStart > yachtTypeStart);
  assert.match(
    leftColumn,
    /<\/Field>\s*<Field label=\{c\.yachtProgram\}>/,
  );
  assert.doesNotMatch(leftColumn, /label=\{c\.yachtBrand\}/);
  assert.ok(yachtSection.indexOf("label={c.yachtBrand}") > leftColumnEnd);
  assert.equal(
    yachtTypeField.match(/className=\{inputClass\}/g)?.length,
    1,
  );
  assert.equal(
    yachtProgramField.match(/className=\{inputClass\}/g)?.length,
    1,
  );
  assert.doesNotMatch(yachtProgramField, /\brequired\b/);
});

test("stale Create Job clients preserve Yacht program on updates", async () => {
  const server = await source("app/lib/jobPostsServer.ts");

  assert.match(
    server,
    /const yachtProgramProvided = Object\.hasOwn\(value, "yachtProgram"\)/,
  );
  assert.match(
    server,
    /const yachtProgram = yachtProgramProvided[\s\S]*?: mode === "create"[\s\S]*?\? null[\s\S]*?: undefined/,
  );
  assert.match(
    server,
    /if \(mutation\.yachtProgram !== undefined\) \{\s*columns\.yacht_program = mutation\.yachtProgram/,
  );
});

test("salary input uses the shared grouped whole-number behavior", async () => {
  const manager = await source("app/hiring/jobs/JobPostsManager.tsx");
  const salaryInput = manager.slice(
    manager.indexOf('aria-label={c.salaryAmount}') - 300,
    manager.indexOf('aria-label={c.currency}'),
  );

  assert.match(salaryInput, /type="text"/);
  assert.match(salaryInput, /inputMode="numeric"/);
  assert.match(salaryInput, /pattern="\[0-9\.\]\*"/);
  assert.match(salaryInput, /maxLength=\{9\}/);
  assert.match(manager, /normalizeJobSalaryAmountInput\(/);
  assert.match(manager, /parseJobSalaryAmountInput\(value\)/);
  assert.match(manager, /formatJobSalaryAmountInput\(/);
  assert.doesNotMatch(salaryInput, /type="number"/);
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

test("create job post sections follow the intended workflow order", async () => {
  const manager = await source("app/hiring/jobs/JobPostsManager.tsx");
  const sectionTitles = [
    "title={c.identity}",
    "title={c.yachtDetails}",
    "title={c.candidatePreferences}",
    "title={c.narrative}",
  ];
  const sectionIndexes = sectionTitles.map((title) => manager.indexOf(title));

  assert.ok(sectionIndexes.every((index) => index >= 0));
  assert.deepEqual(sectionIndexes, [...sectionIndexes].sort((a, b) => a - b));
  for (const title of sectionTitles) {
    assert.equal(manager.split(title).length - 1, 1);
  }
});

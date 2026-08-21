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

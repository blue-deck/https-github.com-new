import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("public crew profiles reuse the responsive application overview", async () => {
  const profile = await source("app/find-crew/[crewId]/InviteCrewPanel.tsx");

  assert.match(profile, /<CrewCandidateEmployerProfileOverview/);
  assert.match(profile, /headingLevel="h1"/);
  assert.match(profile, /reserveTrailingActionSpace=\{false\}/);
  assert.match(
    profile,
    /<CrewCandidateProfileBody[\s\S]*?variant="public"[\s\S]*?sectionHeadingLevel="h2"/,
  );
  assert.doesNotMatch(profile, /My Blue gallery|My Blue galerisi/);
  assert.match(profile, /gallery: "Blue Gallery"/);
  assert.match(profile, /experiences: "Experience"/);
});

test("shared overview preserves public heading semantics and compact section order", async () => {
  const presentation = await source(
    "app/components/CrewCandidatePresentation.tsx",
  );

  assert.match(presentation, /headingLevel\?: "h1" \| "h2"/);
  assert.match(
    presentation,
    /const summaryHeadingLevel = headingLevel === "h1" \? "h2" : "h3"/,
  );
  assert.match(presentation, /variant\?: "default" \| "employer" \| "public"/);
  assert.match(
    presentation,
    /if \(compactVariant\)[\s\S]*?\{gallerySection\}[\s\S]*?\{personalDetailsSection\}[\s\S]*?\{languagesSection\}[\s\S]*?\{skillsSection\}/,
  );
});

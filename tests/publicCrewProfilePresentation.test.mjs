import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("public crew profiles reuse the responsive application overview", async () => {
  const profile = await source("app/find-crew/[crewId]/InviteCrewPanel.tsx");
  const publicProfile = profile.slice(
    profile.indexOf("export function PublicCrewProfileContent"),
    profile.indexOf("export function InviteCrewPanel"),
  );

  assert.match(profile, /<CrewCandidateEmployerProfileOverview/);
  assert.match(profile, /headingLevel="h1"/);
  assert.match(profile, /reserveTrailingActionSpace=\{false\}/);
  assert.match(
    profile,
    /<CrewCandidateProfileBody[\s\S]*?variant="public"[\s\S]*?sectionHeadingLevel="h2"/,
  );
  assert.match(publicProfile, /<CrewCandidateProfileBody/);
  assert.doesNotMatch(profile, /My Blue gallery|My Blue galerisi/);
  assert.match(profile, /gallery: "Blue Gallery"/);
  assert.match(profile, /experiences: "Experience"/);
  assert.doesNotMatch(publicProfile, /<InviteCrewPanel/);
  assert.doesNotMatch(publicProfile, /hiring-actions-heading/);
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

test("public personal details identify Team/Couple status without exposing peers", async () => {
  const [profile, presentation, dataSource] = await Promise.all([
    source("app/find-crew/[crewId]/InviteCrewPanel.tsx"),
    source("app/components/CrewCandidatePresentation.tsx"),
    source("app/lib/findCrewData.ts"),
  ]);

  assert.match(dataSource, /hasTeamCouple: boolean;/);
  assert.match(
    dataSource,
    /hasTeamCouple: teamCoupleUserIds\.has\(userId\)/,
  );
  assert.match(presentation, /candidate\.hasTeamCouple/);
  assert.match(presentation, /<UsersRound className="h-5 w-5"/);
  assert.match(profile, /teamCoupleConnected: "Confirmed Team\/Couple connection"/);
  assert.match(
    profile,
    /Each crew member remains a separate profile in search results\./,
  );
  assert.doesNotMatch(presentation, /teamCoupleMembers|relationshipId|publicCrewId/);
});

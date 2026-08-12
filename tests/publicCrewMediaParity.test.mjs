import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("public crew media URLs are centralized and bounded", async () => {
  const [safety, publicData] = await Promise.all([
    source("app/lib/publicCrewSafety.ts"),
    source("app/lib/findCrewData.ts"),
  ]);

  assert.match(safety, /export function publicCrewMediaUrl/);
  assert.match(safety, /const normalizedCrewId = normalizePublicCrewId\(crewId\)/);
  assert.match(safety, /kind !== "avatar" && kind !== "gallery"/);
  assert.match(safety, /Number\.isSafeInteger\(slot\)/);
  assert.match(safety, /slot < 0 \|\|\s*slot > 3/);
  assert.match(
    safety,
    /`\/api\/find-crew\/\$\{encodeURIComponent\(normalizedCrewId\)\}\/media\?\$\{search\.toString\(\)\}`/,
  );
  assert.match(publicData, /publicCrewMediaUrl,/);
  assert.doesNotMatch(publicData, /function publicCrewMediaUrl\(/);
});

test("public gallery media accepts profile-owned and legacy user-owned paths", async () => {
  const publicData = await source("app/lib/findCrewData.ts");

  assert.match(
    publicData,
    /loadActiveDirectoryGallerySources\(\s*mediaProfile\.profileId,\s*mediaProfile\.userId,?\s*\)/,
  );
  assert.match(
    publicData,
    /async function loadActiveDirectoryGallerySources\(\s*profileId: string,\s*userId: string,?\s*\)/,
  );
  assert.match(publicData, /if \(!isUuid\(profileId\) \|\| !isUuid\(userId\)\) return \[\]/);
  assert.match(
    publicData,
    /selectOwnedPublicCrewGallerySources\(data \|\| \[\], profileId, \[\s*profileId,\s*userId,?\s*\]\)/,
  );
});

test("public media route supports a full application page without immediate throttling", async () => {
  const route = await source("app/api/find-crew/[crewId]/media/route.ts");

  assert.match(route, /find-crew-media:[\s\S]*?150,[\s\S]*?60_000/);
});

test("compact Personal Details fills every cell without a grey placeholder", async () => {
  const presentation = await source(
    "app/components/CrewCandidatePresentation.tsx",
  );
  const details = presentation.match(
    /const personalDetailsSection = \([\s\S]*?const professionalSummarySection/,
  )?.[0];

  assert.ok(details);
  assert.match(details, /label=\{copy\.maritalStatus\}/);
  assert.match(details, /label=\{copy\.location\}/);
  assert.doesNotMatch(details, /wide=|col-span-2/);
  assert.equal((details.match(/<DetailFact/g) || []).length, 8);
});

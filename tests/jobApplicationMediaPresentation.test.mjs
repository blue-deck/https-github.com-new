import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildEmployerApplicationMediaUrlWithSecret,
  employerApplicationMediaExpiresAt,
  employerApplicationMediaRevision,
  verifyEmployerApplicationMediaCapabilityWithSecret,
} from "../app/lib/jobApplicationMediaPrimitives.ts";

const root = new URL("../", import.meta.url);
const jobPostId = "11111111-1111-4111-8111-111111111111";
const applicationId = "22222222-2222-4222-8222-222222222222";
const signingSecret = "a-secure-test-secret-that-is-longer-than-32-characters";

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("application media revisions canonicalize equivalent database timestamps", () => {
  const sourcePath = "11111111-1111-4111-8111-111111111111/avatar.jpg";
  const variants = [
    "2026-08-12T12:34:56Z",
    "2026-08-12T12:34:56.000Z",
    "2026-08-12T15:34:56+03:00",
    " 2026-08-12T12:34:56Z ",
  ].map((timestamp) =>
    employerApplicationMediaRevision(timestamp, ` ${sourcePath} `),
  );

  assert.equal(new Set(variants).size, 1);
  assert.match(variants[0], /^[A-Za-z0-9_-]{43}$/);
  assert.equal(employerApplicationMediaRevision("not-a-date", sourcePath), "");
  assert.equal(employerApplicationMediaRevision(variants[0], ""), "");
  assert.notEqual(
    employerApplicationMediaRevision("2026-08-12T12:34:56.001Z", sourcePath),
    variants[0],
  );
});

test("application media capability URLs stay stable inside a five-minute bucket", () => {
  const revision = employerApplicationMediaRevision(
    "2026-08-12T12:34:56Z",
    "11111111-1111-4111-8111-111111111111/avatar.jpg",
  );
  const bucketStart = Date.parse("2026-08-12T12:35:00Z");
  const input = { jobPostId, applicationId, kind: "avatar", revision };
  const first = buildEmployerApplicationMediaUrlWithSecret(
    input,
    signingSecret,
    bucketStart,
  );
  const sameBucket = buildEmployerApplicationMediaUrlWithSecret(
    input,
    signingSecret,
    bucketStart + 299_999,
  );
  const nextBucket = buildEmployerApplicationMediaUrlWithSecret(
    input,
    signingSecret,
    bucketStart + 300_000,
  );

  assert.equal(first, sameBucket);
  assert.notEqual(first, nextBucket);
  assert.equal(
    employerApplicationMediaExpiresAt(bucketStart) - bucketStart / 1_000,
    1_200,
  );

  const url = new URL(first, "https://www.bluedeck.app");
  const capability = {
    jobPostId,
    applicationId,
    kind: "avatar",
    revision: url.searchParams.get("revision"),
    expires: url.searchParams.get("expires"),
    token: url.searchParams.get("token"),
    version: url.searchParams.get("v"),
  };
  const expiryMilliseconds = Number(capability.expires) * 1_000;
  assert.ok(
    verifyEmployerApplicationMediaCapabilityWithSecret(
      capability,
      signingSecret,
      expiryMilliseconds,
    ),
  );
  assert.equal(
    verifyEmployerApplicationMediaCapabilityWithSecret(
      capability,
      signingSecret,
      expiryMilliseconds + 1_000,
    ),
    null,
  );
  assert.equal(
    verifyEmployerApplicationMediaCapabilityWithSecret(
      {
        ...capability,
        token: `${capability.token.slice(0, -1)}${
          capability.token.endsWith("A") ? "B" : "A"
        }`,
      },
      signingSecret,
      bucketStart,
    ),
    null,
  );
});

test("employer profiles use bounded current public media and preserve snapshot fallback", async () => {
  const [server, presentation, migration, publicMediaRoute] = await Promise.all([
    source("app/lib/jobApplicationsServer.ts"),
    source("app/components/CrewCandidatePresentation.tsx"),
    source(
      "supabase/migrations/20260812132112_employer_public_crew_media_manifest.sql",
    ),
    source("app/api/find-crew/[crewId]/media/route.ts"),
  ]);

  assert.match(
    server,
    /loadAvailableApplicationSnapshots[\s\S]*?loadPublicCrewMediaOverlays[\s\S]*?Promise\.all/,
  );
  assert.match(server, /bluedeck_public_crew_media_manifest/);
  assert.match(
    server,
    /profilePhotoUrl: publicOverlay[\s\S]*?buildEmployerApplicationMediaUrl/,
  );
  assert.match(
    server,
    /galleryPhotos: publicOverlay[\s\S]*?gallerySources/,
  );
  assert.match(server, /publicCrewMediaUrl\(crewId, "avatar"\)/);
  assert.match(server, /publicCrewMediaUrl\(crewId, "gallery", slot\)/);
  assert.match(
    server,
    /overlayCandidate\?\.userId === target\.applicantUserId/,
  );
  assert.match(server, /overlayCandidate\?\.userId === applicantUserId/);
  assert.match(server, /publicCrewId: publicOverlay\?\.crewId \|\| ""/);
  assert.doesNotMatch(
    server,
    /profilePhotoUrl:\s*publicOverlay[\s\S]{0,200}?publicOverlay\.profilePhotoUrl\s*\|\|/,
  );

  assert.match(migration, /cardinality\(p_profile_ids\) > 50/);
  assert.match(migration, /entitlement\.account_role in \('crew', 'captain'\)/);
  assert.match(migration, /account\.email_confirmed_at is not null/);
  assert.match(migration, /account\.deleted_at is null/);
  assert.match(migration, /account\.banned_until <= statement_timestamp\(\)/);
  assert.match(
    migration,
    /revoke all on function[\s\S]*?from public, anon, authenticated/,
  );
  assert.match(migration, /grant execute on function[\s\S]*?to service_role/);

  assert.match(
    presentation,
    /label=\{copy\.location\}[\s\S]*?compact=\{compactVariant\}[\s\S]*?wide=\{compactVariant\}/,
  );
  assert.match(
    presentation,
    /wide \? \(compact \? "col-span-2" : "sm:col-span-2"\)/,
  );
  assert.match(publicMediaRoute, /find-crew-media:[\s\S]*?150,[\s\S]*?60_000/);
});

test("public media resolves legacy user-owned gallery paths consistently", async () => {
  const publicData = await source("app/lib/findCrewData.ts");

  assert.match(
    publicData,
    /loadActiveDirectoryGallerySources\([\s\S]*?mediaProfile\.profileId,[\s\S]*?mediaProfile\.userId/,
  );
  assert.match(
    publicData,
    /selectOwnedPublicCrewGallerySources\(data \|\| \[\], profileId, \[[\s\S]*?profileId,[\s\S]*?userId/,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEmployerApplicationMediaUrlWithSecret,
  employerApplicationMediaExpiresAt,
  employerApplicationMediaRevision,
  verifyEmployerApplicationMediaCapabilityWithSecret,
} from "../app/lib/jobApplicationMediaPrimitives.ts";

const jobPostId = "11111111-1111-4111-8111-111111111111";
const applicationId = "22222222-2222-4222-8222-222222222222";
const memberId = "33333333-3333-4333-8333-333333333333";
const anotherMemberId = "44444444-4444-4444-8444-444444444444";
const signingSecret = "a-secure-test-secret-that-is-longer-than-32-characters";
const sourcePath = `${memberId}/avatar.jpg`;

test("application media revisions canonicalize equivalent database timestamps", () => {
  const equivalentRevisions = [
    "2026-08-12T12:34:56Z",
    "2026-08-12T12:34:56.000Z",
    "2026-08-12T15:34:56+03:00",
    " 2026-08-12T12:34:56Z ",
  ].map((capturedAt) =>
    employerApplicationMediaRevision(capturedAt, ` ${sourcePath} `),
  );

  assert.equal(new Set(equivalentRevisions).size, 1);
  assert.match(equivalentRevisions[0], /^[A-Za-z0-9_-]{43}$/);
  assert.equal(employerApplicationMediaRevision("not-a-date", sourcePath), "");
  assert.equal(
    employerApplicationMediaRevision("2026-08-12T12:34:56Z", ""),
    "",
  );
  assert.notEqual(
    employerApplicationMediaRevision("2026-08-12T12:34:56.001Z", sourcePath),
    equivalentRevisions[0],
  );
  assert.notEqual(
    employerApplicationMediaRevision(
      "2026-08-12T12:34:56Z",
      `${memberId}/different-avatar.jpg`,
    ),
    equivalentRevisions[0],
  );
});

test("v3 application media capabilities remain stable per bucket and bind the member", () => {
  const revision = employerApplicationMediaRevision(
    "2026-08-12T12:34:56Z",
    sourcePath,
  );
  const bucketStart = Date.parse("2026-08-12T12:35:00Z");
  const input = {
    jobPostId,
    applicationId,
    memberId,
    kind: "avatar",
    revision,
  };
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
  assert.equal(url.searchParams.get("v"), "3");
  assert.equal(url.searchParams.get("member"), memberId);
  const capability = {
    jobPostId,
    applicationId,
    memberId: url.searchParams.get("member"),
    kind: "avatar",
    revision: url.searchParams.get("revision"),
    expires: url.searchParams.get("expires"),
    token: url.searchParams.get("token"),
    version: url.searchParams.get("v"),
  };
  const expiresAtMilliseconds = Number(capability.expires) * 1_000;

  assert.ok(
    verifyEmployerApplicationMediaCapabilityWithSecret(
      capability,
      signingSecret,
      bucketStart,
    ),
  );
  assert.ok(
    verifyEmployerApplicationMediaCapabilityWithSecret(
      capability,
      signingSecret,
      expiresAtMilliseconds,
    ),
  );
  assert.equal(
    verifyEmployerApplicationMediaCapabilityWithSecret(
      capability,
      signingSecret,
      expiresAtMilliseconds + 1_000,
    ),
    null,
  );
  assert.equal(
    verifyEmployerApplicationMediaCapabilityWithSecret(
      { ...capability, memberId: anotherMemberId },
      signingSecret,
      bucketStart,
    ),
    null,
  );
  assert.equal(
    verifyEmployerApplicationMediaCapabilityWithSecret(
      { ...capability, version: "2" },
      signingSecret,
      bucketStart,
    ),
    null,
  );
});

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const employerApplicationMediaKinds = ["avatar", "gallery"] as const;

export type EmployerApplicationMediaKind =
  (typeof employerApplicationMediaKinds)[number];

export type EmployerApplicationMediaUrlInput = {
  jobPostId: string;
  applicationId: string;
  memberId: string;
  kind: EmployerApplicationMediaKind;
  slot?: number;
  revision: string;
};

export type EmployerApplicationMediaCapabilityInput =
  EmployerApplicationMediaUrlInput & {
    expires: string;
    token: string;
    version: string;
  };

export type VerifiedEmployerApplicationMediaCapability = {
  jobPostId: string;
  applicationId: string;
  memberId: string;
  kind: EmployerApplicationMediaKind;
  slot: number | null;
  expiresAt: number;
  revision: string;
};

const mediaCapabilityVersion = "3";
const mediaCapabilityBucketSeconds = 300;
const mediaCapabilityMaximumLifetimeSeconds = 1_200;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function buildEmployerApplicationMediaUrlWithSecret(
  input: EmployerApplicationMediaUrlInput,
  signingSecret: string,
  now = Date.now(),
) {
  const normalized = normalizeMediaIdentity(input);
  if (!normalized || !signingSecret) return "";

  const expiresAt = employerApplicationMediaExpiresAt(now);
  const token = signMediaCapability(
    signingSecret,
    normalized.jobPostId,
    normalized.applicationId,
    normalized.memberId,
    normalized.kind,
    normalized.slot,
    normalized.revision,
    expiresAt,
  );
  const search = new URLSearchParams({
    v: mediaCapabilityVersion,
    kind: normalized.kind,
    expires: String(expiresAt),
    token,
    revision: normalized.revision,
    member: normalized.memberId,
  });
  if (normalized.slot !== null) search.set("slot", String(normalized.slot));

  return `/api/employer/job-posts/${normalized.jobPostId}/applications/${normalized.applicationId}/media?${search.toString()}`;
}

export function verifyEmployerApplicationMediaCapabilityWithSecret(
  input: EmployerApplicationMediaCapabilityInput,
  signingSecret: string,
  now = Date.now(),
): VerifiedEmployerApplicationMediaCapability | null {
  const normalized = normalizeMediaIdentity(input);
  if (
    !normalized ||
    !signingSecret ||
    input.version !== mediaCapabilityVersion ||
    !tokenPattern.test(input.token) ||
    !/^\d{10,11}$/.test(input.expires)
  ) {
    return null;
  }

  const expiresAt = Number(input.expires);
  const nowSeconds = Math.floor(now / 1_000);
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt < nowSeconds ||
    expiresAt - nowSeconds > mediaCapabilityMaximumLifetimeSeconds
  ) {
    return null;
  }

  const expected = signMediaCapability(
    signingSecret,
    normalized.jobPostId,
    normalized.applicationId,
    normalized.memberId,
    normalized.kind,
    normalized.slot,
    normalized.revision,
    expiresAt,
  );
  const providedBuffer = Buffer.from(input.token, "base64url");
  const expectedBuffer = Buffer.from(expected, "base64url");
  if (
    providedBuffer.byteLength !== expectedBuffer.byteLength ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  return { ...normalized, expiresAt };
}

export function employerApplicationMediaRevision(
  capturedAt: string,
  source: string,
) {
  const normalizedCapturedAt = canonicalDatabaseTimestamp(capturedAt);
  const normalizedSource = source.trim();
  if (!normalizedCapturedAt || !normalizedSource) return "";

  return createHash("sha256")
    .update("bluedeck-job-application-media-revision\n")
    .update(normalizedCapturedAt)
    .update("\n")
    .update(normalizedSource)
    .digest("base64url");
}

export function employerApplicationMediaExpiresAt(now = Date.now()) {
  const nowSeconds = Math.floor(now / 1_000);
  const bucketStart =
    Math.floor(nowSeconds / mediaCapabilityBucketSeconds) *
    mediaCapabilityBucketSeconds;
  return bucketStart + mediaCapabilityMaximumLifetimeSeconds;
}

function canonicalDatabaseTimestamp(value: string) {
  const parsed = Date.parse(value.trim());
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

function normalizeMediaIdentity(input: EmployerApplicationMediaUrlInput) {
  const jobPostId = input.jobPostId.trim().toLowerCase();
  const applicationId = input.applicationId.trim().toLowerCase();
  const memberId = input.memberId.trim().toLowerCase();
  if (
    !uuidPattern.test(jobPostId) ||
    !uuidPattern.test(applicationId) ||
    !uuidPattern.test(memberId) ||
    !employerApplicationMediaKinds.includes(input.kind) ||
    !tokenPattern.test(input.revision)
  ) {
    return null;
  }

  if (input.kind === "avatar") {
    if (input.slot !== undefined) return null;
    return {
      jobPostId,
      applicationId,
      memberId,
      kind: input.kind,
      slot: null,
      revision: input.revision,
    };
  }

  if (
    typeof input.slot !== "number" ||
    !Number.isSafeInteger(input.slot) ||
    input.slot < 0 ||
    input.slot > 3
  ) {
    return null;
  }

  return {
    jobPostId,
    applicationId,
    memberId,
    kind: input.kind,
    slot: input.slot,
    revision: input.revision,
  };
}

function signMediaCapability(
  secret: string,
  jobPostId: string,
  applicationId: string,
  memberId: string,
  kind: EmployerApplicationMediaKind,
  slot: number | null,
  revision: string,
  expiresAt: number,
) {
  const payload = [
    "bluedeck-job-application-media",
    mediaCapabilityVersion,
    jobPostId,
    applicationId,
    memberId,
    kind,
    slot === null ? "-" : String(slot),
    revision,
    String(expiresAt),
  ].join("\n");

  return createHmac("sha256", secret).update(payload).digest("base64url");
}

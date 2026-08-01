import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { selectOwnedPublicCrewGallerySources } from "./publicCrewSafety";

export const employerApplicationMediaKinds = ["avatar", "gallery"] as const;

export type EmployerApplicationMediaKind =
  (typeof employerApplicationMediaKinds)[number];

type MediaUrlInput = {
  jobPostId: string;
  applicationId: string;
  kind: EmployerApplicationMediaKind;
  slot?: number;
  revision: string;
};

type MediaCapabilityInput = MediaUrlInput & {
  expires: string;
  token: string;
  version: string;
};

export type VerifiedEmployerApplicationMediaCapability = {
  jobPostId: string;
  applicationId: string;
  kind: EmployerApplicationMediaKind;
  slot: number | null;
  expiresAt: number;
  revision: string;
};

const mediaCapabilityVersion = "2";
const mediaCapabilityLifetimeSeconds = 900;
const maximumAcceptedLifetimeSeconds = 1_200;
const minimumSigningSecretLength = 32;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function buildEmployerApplicationMediaUrl(input: MediaUrlInput) {
  const normalized = normalizeMediaIdentity(input);
  const signingSecret = mediaSigningSecret();
  if (!normalized || !signingSecret) return "";

  const expiresAt =
    Math.floor(Date.now() / 1_000) + mediaCapabilityLifetimeSeconds;
  const token = signMediaCapability(
    signingSecret,
    normalized.jobPostId,
    normalized.applicationId,
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
  });
  if (normalized.slot !== null) search.set("slot", String(normalized.slot));

  return `/api/employer/job-posts/${normalized.jobPostId}/applications/${normalized.applicationId}/media?${search.toString()}`;
}

export function verifyEmployerApplicationMediaCapability(
  input: MediaCapabilityInput,
  now = Date.now(),
): VerifiedEmployerApplicationMediaCapability | null {
  const normalized = normalizeMediaIdentity(input);
  const signingSecret = mediaSigningSecret();
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
    expiresAt - nowSeconds > maximumAcceptedLifetimeSeconds
  ) {
    return null;
  }

  const expected = signMediaCapability(
    signingSecret,
    normalized.jobPostId,
    normalized.applicationId,
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

  return {
    ...normalized,
    expiresAt,
  };
}

export function employerApplicationMediaRevision(
  capturedAt: string,
  source: string,
) {
  const normalizedCapturedAt = capturedAt.trim();
  const normalizedSource = source.trim();
  if (!normalizedCapturedAt || !normalizedSource) return "";
  return createHash("sha256")
    .update("bluedeck-job-application-media-revision\n")
    .update(normalizedCapturedAt)
    .update("\n")
    .update(normalizedSource)
    .digest("base64url");
}

export function hasEmployerApplicationMediaSigningSecret() {
  return Boolean(mediaSigningSecret());
}

export function selectEmployerApplicationGallerySources(
  rows: unknown[],
  applicationId: string,
  ownerIds: unknown[],
) {
  if (!uuidPattern.test(applicationId)) return [];
  return selectOwnedPublicCrewGallerySources(
    rows,
    applicationId,
    ownerIds,
  );
}

function normalizeMediaIdentity(input: MediaUrlInput) {
  const jobPostId = input.jobPostId.trim().toLowerCase();
  const applicationId = input.applicationId.trim().toLowerCase();
  if (
    !uuidPattern.test(jobPostId) ||
    !uuidPattern.test(applicationId) ||
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
    kind: input.kind,
    slot: input.slot,
    revision: input.revision,
  };
}

function signMediaCapability(
  secret: string,
  jobPostId: string,
  applicationId: string,
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
    kind,
    slot === null ? "-" : String(slot),
    revision,
    String(expiresAt),
  ].join("\n");

  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function mediaSigningSecret() {
  const dedicatedSecret =
    process.env.JOB_APPLICATION_MEDIA_SIGNING_SECRET?.trim() || "";
  if (dedicatedSecret) {
    return dedicatedSecret.length >= minimumSigningSecretLength
      ? dedicatedSecret
      : "";
  }

  if (process.env.NODE_ENV !== "production") {
    const serviceRoleSecret =
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
    return serviceRoleSecret.length >= minimumSigningSecretLength
      ? serviceRoleSecret
      : "";
  }

  return "";
}

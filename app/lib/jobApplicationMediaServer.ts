import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { isRecord } from "./employerAccessServer";
import { safePublicMediaUrl } from "./publicCrewSafety";

export const employerApplicationMediaKinds = ["avatar", "gallery"] as const;

export type EmployerApplicationMediaKind =
  (typeof employerApplicationMediaKinds)[number];

type MediaUrlInput = {
  jobPostId: string;
  applicationId: string;
  kind: EmployerApplicationMediaKind;
  slot?: number;
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
};

const mediaCapabilityVersion = "1";
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
    expiresAt,
  );
  const search = new URLSearchParams({
    v: mediaCapabilityVersion,
    kind: normalized.kind,
    expires: String(expiresAt),
    token,
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

export function hasEmployerApplicationMediaSigningSecret() {
  return Boolean(mediaSigningSecret());
}

export function selectEmployerApplicationGallerySources(
  rows: unknown[],
  applicationId: string,
) {
  if (!uuidPattern.test(applicationId)) return [];

  const originalOrder = Array.from(
    new Set(
      rows
        .map((row) =>
          isRecord(row) ? safePublicMediaUrl(row.image_url) : "",
        )
        .filter(Boolean),
    ),
  );
  const selected = [...originalOrder]
    .sort(
      (left, right) =>
        stableTextHash(`${applicationId}:${left}`) -
        stableTextHash(`${applicationId}:${right}`),
    )
    .slice(0, 4);

  if (
    originalOrder.length > 4 &&
    selected.every((photo) => originalOrder.slice(0, 4).includes(photo))
  ) {
    return [originalOrder[4], ...selected.slice(0, 3)].filter(Boolean);
  }

  return selected;
}

function normalizeMediaIdentity(input: MediaUrlInput) {
  const jobPostId = input.jobPostId.trim().toLowerCase();
  const applicationId = input.applicationId.trim().toLowerCase();
  if (
    !uuidPattern.test(jobPostId) ||
    !uuidPattern.test(applicationId) ||
    !employerApplicationMediaKinds.includes(input.kind)
  ) {
    return null;
  }

  if (input.kind === "avatar") {
    if (input.slot !== undefined) return null;
    return { jobPostId, applicationId, kind: input.kind, slot: null };
  }

  if (
    typeof input.slot !== "number" ||
    !Number.isSafeInteger(input.slot) ||
    input.slot < 0 ||
    input.slot > 3
  ) {
    return null;
  }

  return { jobPostId, applicationId, kind: input.kind, slot: input.slot };
}

function signMediaCapability(
  secret: string,
  jobPostId: string,
  applicationId: string,
  kind: EmployerApplicationMediaKind,
  slot: number | null,
  expiresAt: number,
) {
  const payload = [
    "bluedeck-job-application-media",
    mediaCapabilityVersion,
    jobPostId,
    applicationId,
    kind,
    slot === null ? "-" : String(slot),
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

  const serviceRoleSecret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  return serviceRoleSecret.length >= minimumSigningSecretLength
    ? serviceRoleSecret
    : "";
}

function stableTextHash(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

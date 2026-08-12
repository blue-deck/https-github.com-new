import "server-only";

import {
  buildEmployerApplicationMediaUrlWithSecret,
  employerApplicationMediaKinds,
  employerApplicationMediaRevision,
  verifyEmployerApplicationMediaCapabilityWithSecret,
  type EmployerApplicationMediaKind,
  type EmployerApplicationMediaUrlInput,
  type VerifiedEmployerApplicationMediaCapability,
} from "./jobApplicationMediaPrimitives";
import { selectOwnedPublicCrewGallerySources } from "./publicCrewSafety";

type MediaCapabilityInput = EmployerApplicationMediaUrlInput & {
  expires: string;
  token: string;
  version: string;
};

const minimumSigningSecretLength = 32;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildEmployerApplicationMediaUrl(
  input: EmployerApplicationMediaUrlInput,
) {
  const signingSecret = mediaSigningSecret();
  return signingSecret
    ? buildEmployerApplicationMediaUrlWithSecret(input, signingSecret)
    : "";
}

export function verifyEmployerApplicationMediaCapability(
  input: MediaCapabilityInput,
  now = Date.now(),
): VerifiedEmployerApplicationMediaCapability | null {
  const signingSecret = mediaSigningSecret();
  return signingSecret
    ? verifyEmployerApplicationMediaCapabilityWithSecret(
        input,
        signingSecret,
        now,
      )
    : null;
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

export {
  employerApplicationMediaKinds,
  employerApplicationMediaRevision,
};
export type {
  EmployerApplicationMediaKind,
  VerifiedEmployerApplicationMediaCapability,
};

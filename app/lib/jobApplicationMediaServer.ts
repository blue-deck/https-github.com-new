import "server-only";

import {
  buildEmployerApplicationMediaUrlWithSecret,
  employerApplicationMediaKinds,
  employerApplicationMediaRevision,
  verifyEmployerApplicationMediaCapabilityWithSecret,
  type EmployerApplicationMediaCapabilityInput,
  type EmployerApplicationMediaKind,
  type EmployerApplicationMediaUrlInput,
  type VerifiedEmployerApplicationMediaCapability,
} from "./jobApplicationMediaPrimitives";
import { selectOwnedPublicCrewGallerySources } from "./publicCrewSafety";

export {
  employerApplicationMediaKinds,
  employerApplicationMediaRevision,
  type EmployerApplicationMediaKind,
  type VerifiedEmployerApplicationMediaCapability,
};

const minimumSigningSecretLength = 32;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildEmployerApplicationMediaUrl(
  input: EmployerApplicationMediaUrlInput,
) {
  const signingSecret = mediaSigningSecret();
  if (!signingSecret) return "";
  return buildEmployerApplicationMediaUrlWithSecret(
    input,
    signingSecret,
  );
}

export function verifyEmployerApplicationMediaCapability(
  input: EmployerApplicationMediaCapabilityInput,
  now = Date.now(),
): VerifiedEmployerApplicationMediaCapability | null {
  const signingSecret = mediaSigningSecret();
  if (!signingSecret) return null;
  return verifyEmployerApplicationMediaCapabilityWithSecret(
    input,
    signingSecret,
    now,
  );
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

import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

const recoveryStateLifetimeSeconds = 60 * 60;
const sealedPayloadVersion = "v1";
const initializationVectorBytes = 12;
const authenticationTagBytes = 16;

export const passwordRecoveryStartCookie = "bluedeck_recovery_start";
export const passwordRecoverySessionCookie = "bluedeck_recovery_session";
export const passwordRecoveryStateMaxAge = recoveryStateLifetimeSeconds;
export const passwordRecoverySessionMaxAge = 15 * 60;
export const passwordRecoverySealedTokenMaxLength = 6_000;

export type PasswordRecoveryStartPayload = {
  state: string;
  tokenHash: string;
  issuedAt: number;
};

export type PasswordRecoverySessionPayload = {
  ticket: string;
  userId: string;
  sessionId: string;
  recoveryAuthenticatedAt: number;
  issuedAt: number;
};

export type PasswordRecoveryTokenPayload = {
  accessToken: string;
  userId: string;
  sessionId: string;
  recoveryAuthenticatedAt: number;
  issuedAt: number;
};

export function createPasswordRecoveryState(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!recoverySecret() || !normalizedEmail) return null;

  const state = randomBytes(32).toString("base64url");
  const issuedAt = Math.floor(Date.now() / 1_000);
  return {
    state,
    stateDigest: passwordRecoveryCapabilityDigest(state),
    emailDigest: passwordRecoveryEmailDigest(normalizedEmail),
    issuedAt,
    expiresAt: new Date(
      (issuedAt + recoveryStateLifetimeSeconds) * 1_000,
    ).toISOString(),
  };
}

export function createPasswordRecoveryTicket(
  state: string,
  userId: string,
  sessionId: string,
) {
  const secret = recoverySecret();
  if (
    !secret ||
    !/^[A-Za-z0-9_-]{43}$/.test(state) ||
    !/^[0-9a-f-]{36}$/i.test(userId) ||
    !/^[0-9a-f-]{36}$/i.test(sessionId)
  ) {
    return null;
  }

  // A deterministic, server-secret ticket makes confirmation idempotent.
  // Concurrent retries for the same verified recovery session therefore
  // converge on the same database capability without exposing the email state.
  const ticket = createHmac("sha256", secret)
    .update("bluedeck:password-recovery:ticket:v1\0", "utf8")
    .update(state, "utf8")
    .update("\0", "utf8")
    .update(userId.toLowerCase(), "utf8")
    .update("\0", "utf8")
    .update(sessionId.toLowerCase(), "utf8")
    .digest("base64url");
  return {
    ticket,
    ticketDigest: passwordRecoveryCapabilityDigest(ticket),
  };
}

export function passwordRecoveryCapabilityDigest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function passwordRecoveryEmailDigest(email: string) {
  const secret = recoverySecret();
  const normalizedEmail = normalizeEmail(email);
  if (!secret || !normalizedEmail) return "";
  return createHmac("sha256", secret)
    .update("bluedeck:password-recovery:email:v1\0", "utf8")
    .update(normalizedEmail, "utf8")
    .digest("hex");
}

export function sealPasswordRecoveryPayload(
  payload:
    | PasswordRecoveryStartPayload
    | PasswordRecoverySessionPayload
    | PasswordRecoveryTokenPayload,
) {
  const key = recoveryEncryptionKey();
  if (!key) return "";

  const iv = randomBytes(initializationVectorBytes);
  const cipher = createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: authenticationTagBytes,
  });
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    sealedPayloadVersion,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function openPasswordRecoveryPayload<T>(
  sealed: string,
  maximumLength = 3_900,
) {
  const key = recoveryEncryptionKey();
  if (
    !key ||
    !Number.isSafeInteger(maximumLength) ||
    maximumLength < 40 ||
    maximumLength > passwordRecoverySealedTokenMaxLength ||
    sealed.length < 40 ||
    sealed.length > maximumLength
  ) {
    return null;
  }

  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== sealedPayloadVersion) return null;

  try {
    const iv = Buffer.from(parts[1], "base64url");
    const ciphertext = Buffer.from(parts[2], "base64url");
    const tag = Buffer.from(parts[3], "base64url");
    if (
      iv.length !== initializationVectorBytes ||
      tag.length !== authenticationTagBytes ||
      ciphertext.length === 0
    ) {
      return null;
    }

    const decipher = createDecipheriv("aes-256-gcm", key, iv, {
      authTagLength: authenticationTagBytes,
    });
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as T;
  } catch {
    return null;
  }
}

export function isFreshRecoveryTimestamp(
  issuedAt: number,
  maximumAgeSeconds: number,
) {
  if (!Number.isSafeInteger(issuedAt)) return false;
  const now = Math.floor(Date.now() / 1_000);
  return issuedAt <= now + 300 && now - issuedAt <= maximumAgeSeconds;
}

function recoveryEncryptionKey() {
  const secret = recoverySecret();
  if (!secret) return null;
  return createHash("sha256")
    .update("bluedeck:password-recovery:encryption:v1\0", "utf8")
    .update(secret, "utf8")
    .digest();
}

function recoverySecret() {
  const dedicatedSecret = process.env.AUTH_RECOVERY_STATE_SECRET?.trim() || "";
  if (dedicatedSecret.length >= 43) return dedicatedSecret;
  if (process.env.NODE_ENV === "production") return "";
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
}

function normalizeEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.length >= 3 && normalized.length <= 254 ? normalized : "";
}

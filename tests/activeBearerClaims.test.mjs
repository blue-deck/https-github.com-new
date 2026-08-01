import assert from "node:assert/strict";
import test from "node:test";
import {
  activeBearerClaimsAreValid,
  hasValidActiveSessionAmr,
} from "../app/lib/activeBearerClaims.ts";

const userId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";

test("accepts password sessions with object, RFC-8176, refresh, and MFA entries", () => {
  assert.equal(
    hasValidActiveSessionAmr([{ method: "password", timestamp: 1 }]),
    true,
  );
  assert.equal(
    hasValidActiveSessionAmr(["password", "token_refresh", "totp"]),
    true,
  );
});

test("rejects proof-only, missing, empty, unsupported, and malformed AMR claims", () => {
  for (const amr of [
    undefined,
    null,
    [],
    "password",
    ["recovery"],
    ["otp"],
    ["email/signup"],
    ["invite"],
    ["token_refresh"],
    ["oauth"],
    ["password", "recovery"],
    ["password", "unexpected_method"],
    [{ method: "RECOVERY", timestamp: 1 }],
    [1],
    [{}],
    [{ method: 1 }],
    [""],
  ]) {
    assert.equal(hasValidActiveSessionAmr(amr), false);
  }
});

test("binds verified claims to the user and a canonical session UUID", () => {
  const validClaims = {
    sub: userId,
    session_id: sessionId,
    amr: [{ method: "password", timestamp: 1 }],
  };

  assert.equal(activeBearerClaimsAreValid(validClaims, userId), true);
  assert.equal(
    activeBearerClaimsAreValid(
      { ...validClaims, sub: "33333333-3333-4333-8333-333333333333" },
      userId,
    ),
    false,
  );
  assert.equal(
    activeBearerClaimsAreValid(
      { ...validClaims, session_id: "not-a-session-id" },
      userId,
    ),
    false,
  );
  assert.equal(
    activeBearerClaimsAreValid({ ...validClaims, amr: [] }, userId),
    false,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  hasValidSignupProofAmr,
  recoveryProofAuthenticatedAt,
} from "../app/lib/activeBearerClaims.ts";

test("matches signup AMR provenance to Supabase verification flow", () => {
  const otp = [{ method: "otp", timestamp: 100 }];
  const signup = [{ method: "email/signup", timestamp: 100 }];

  assert.equal(
    hasValidSignupProofAmr(otp, "implicit_or_token_hash"),
    true,
  );
  assert.equal(
    hasValidSignupProofAmr(signup, "implicit_or_token_hash"),
    true,
  );
  assert.equal(hasValidSignupProofAmr(signup, "pkce"), true);
  assert.equal(hasValidSignupProofAmr(otp, "pkce"), false);
  assert.equal(
    hasValidSignupProofAmr(
      [{ method: "password", timestamp: 100 }],
      "implicit_or_token_hash",
    ),
    false,
  );
});

test("accepts only timestamped generic-OTP or typed recovery proof sessions", () => {
  assert.equal(
    recoveryProofAuthenticatedAt([{ method: "otp", timestamp: 100 }]),
    100,
  );
  assert.equal(
    recoveryProofAuthenticatedAt([
      { method: "recovery", timestamp: 120 },
      { method: "token_refresh", timestamp: 130 },
    ]),
    120,
  );

  for (const amr of [
    ["otp"],
    [{ method: "password", timestamp: 100 }],
    [{ method: "email/signup", timestamp: 100 }],
    [{ method: "otp" }],
    [{ method: "otp", timestamp: -1 }],
    [{ method: "otp", timestamp: 1.5 }],
    [{ method: "otp", timestamp: 100 }, { method: "password", timestamp: 1 }],
    [{ method: "token_refresh", timestamp: 100 }],
  ]) {
    assert.equal(recoveryProofAuthenticatedAt(amr), null);
  }
});

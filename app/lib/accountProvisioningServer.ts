import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isCanonicalUuid } from "./activeBearerClaims";

export async function accountProvisioningIsReady(
  serviceClient: SupabaseClient,
  userId: string,
) {
  if (!isCanonicalUuid(userId)) {
    return { ready: false, error: new Error("Invalid account identifier") };
  }

  const { data, error } = await serviceClient.rpc(
    "bluedeck_account_is_ready",
    { p_user_id: userId },
  );
  if (error) return { ready: false, error };
  if (typeof data !== "boolean") {
    return {
      ready: false,
      error: new Error("Account readiness response is invalid"),
    };
  }
  return { ready: data, error: null };
}

export async function recoverSignupAccount(
  serviceClient: SupabaseClient,
  userId: string,
  sessionId: string,
) {
  if (!isCanonicalUuid(userId) || !isCanonicalUuid(sessionId)) {
    return { ready: false, error: new Error("Invalid account session identifier") };
  }

  const { data, error } = await serviceClient.rpc(
    "bluedeck_recover_signup_account",
    { p_user_id: userId, p_session_id: sessionId },
  );
  if (error) return { ready: false, error };
  if (typeof data !== "boolean") {
    return {
      ready: false,
      error: new Error("Account recovery response is invalid"),
    };
  }
  return { ready: data, error: null };
}

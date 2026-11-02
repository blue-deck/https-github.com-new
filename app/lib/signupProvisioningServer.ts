import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isCanonicalUuid } from "./activeBearerClaims";

type SignupIdentity = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  position: string;
};

export async function prepareSignupProvisioning(
  serviceClient: SupabaseClient,
  identity: Omit<SignupIdentity, "userId">,
) {
  try {
    const { data, error } = await serviceClient.rpc(
      "bluedeck_prepare_signup_account",
      {
        p_email: identity.email,
        p_full_name: identity.fullName,
        p_account_role: identity.role,
        p_position: identity.position,
      },
    );
    if (error || !isCanonicalUuid(data)) {
      return { nonce: null, failureCode: error?.code || "signup_intent_unavailable" };
    }
    return { nonce: data, failureCode: null };
  } catch {
    return { nonce: null, failureCode: "signup_intent_unavailable" };
  }
}

export async function completeSignupProvisioning(
  serviceClient: SupabaseClient,
  identity: SignupIdentity,
) {
  const parameters = {
    p_user_id: identity.userId,
    p_email: identity.email,
    p_full_name: identity.fullName,
    p_account_role: identity.role,
    p_position: identity.position,
  };

  let failureCode = "signup_not_provisioned";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data, error } = await serviceClient.rpc(
        "bluedeck_provision_signup_account",
        parameters,
      );
      if (!error) {
        return { ready: data === true, failureCode: data === true ? null : failureCode };
      }
      failureCode = error.code || "signup_provisioning_unavailable";
    } catch {
      failureCode = "signup_provisioning_unavailable";
    }
  }

  // A network error does not establish that the transaction rolled back.
  // Never delete or quarantine Auth here: it may already be a ready account.
  // Pending signups can finish through the verified-password recovery path.
  return { ready: false, failureCode };
}

import "server-only";

import type { JwtPayload, SupabaseClient, User } from "@supabase/supabase-js";
import {
  activeBearerClaimsAreValid,
  isCanonicalUuid,
} from "./activeBearerClaims";
import { accountProvisioningIsReady } from "./accountProvisioningServer";

export type ActiveBearerFailureReason =
  "invalid_session" | "account_not_ready" | "session_check_unavailable";

export type ActiveBearerFailure = {
  ok: false;
  reason: ActiveBearerFailureReason;
  error: string;
  status: 401 | 403 | 503;
  cause?: unknown;
};

export type ActiveBearerSuccess = {
  ok: true;
  user: User;
  claims: JwtPayload;
};

export async function authenticateActiveBearer({
  token,
  authClient,
  serviceClient,
}: {
  token: string;
  authClient: SupabaseClient;
  serviceClient: SupabaseClient;
}): Promise<ActiveBearerSuccess | ActiveBearerFailure> {
  try {
    const userResponse = await authClient.auth.getUser(token);
    const user = userResponse.data.user;
    if (userResponse.error || !user || !isCanonicalUuid(user.id)) {
      return invalidSession(userResponse.error);
    }

    const claimsResponse = await authClient.auth.getClaims(token);
    const claims = claimsResponse.data?.claims;
    if (
      claimsResponse.error ||
      !claims ||
      !activeBearerClaimsAreValid(claims, user.id)
    ) {
      return invalidSession(claimsResponse.error);
    }

    const provisioning = await accountProvisioningIsReady(
      serviceClient,
      user.id,
    );
    if (!provisioning.ready) {
      return {
        ok: false,
        reason: "account_not_ready",
        error: "Account setup is incomplete.",
        status: 403,
        cause: provisioning.error,
      };
    }

    const sessionResponse = await serviceClient.rpc(
      "bluedeck_bearer_session_is_live",
      {
        p_user_id: user.id,
        p_session_id: claims.session_id,
      },
    );
    if (sessionResponse.error) {
      return {
        ok: false,
        reason: "session_check_unavailable",
        error: "Login session could not be verified.",
        status: 503,
        cause: sessionResponse.error,
      };
    }
    if (sessionResponse.data !== true) {
      return invalidSession();
    }

    return { ok: true, user, claims };
  } catch (cause) {
    return {
      ok: false,
      reason: "session_check_unavailable",
      error: "Login session could not be verified.",
      status: 503,
      cause,
    };
  }
}

function invalidSession(cause?: unknown): ActiveBearerFailure {
  return {
    ok: false,
    reason: "invalid_session",
    error: "Login session is invalid.",
    status: 401,
    cause,
  };
}

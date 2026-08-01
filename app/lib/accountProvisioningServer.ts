import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function accountProvisioningIsReady(
  serviceClient: SupabaseClient,
  userId: string,
) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return { ready: false, error: new Error("Invalid account identifier") };
  }

  const { data, error } = await serviceClient.rpc(
    "bluedeck_account_is_ready",
    { p_user_id: userId },
  );
  return { ready: data === true && !error, error };
}

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveSupabaseUrl } from "../supabaseConfig";

type BlueDeckServerGlobal = typeof globalThis & {
  __blueDeckSupabaseAdmin?: SupabaseClient;
};

const globalForSupabase = globalThis as BlueDeckServerGlobal;

export function getSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server credentials are not configured.");
  }

  if (!globalForSupabase.__blueDeckSupabaseAdmin) {
    globalForSupabase.__blueDeckSupabaseAdmin = createClient(
      resolveSupabaseUrl(supabaseUrl),
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  }

  return globalForSupabase.__blueDeckSupabaseAdmin;
}

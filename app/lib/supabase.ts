import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveSupabaseUrl } from "./supabaseConfig";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

type BlueDeckGlobal = typeof globalThis & {
  __bluedeckSupabase?: SupabaseClient;
};

const globalForSupabase = globalThis as BlueDeckGlobal;

export const supabase =
  globalForSupabase.__bluedeckSupabase ||
  createClient(resolveSupabaseUrl(supabaseUrl), supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

if (typeof window !== "undefined") {
  globalForSupabase.__bluedeckSupabase = supabase;
}

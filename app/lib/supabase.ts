import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const fallbackSupabaseUrl = "https://onftggrmmpvvwgxxzywo.supabase.co";

function normalizeSupabaseUrl(url?: string) {
  if (!url || url.includes("onftgqrmmpvvwgxxzywo")) return fallbackSupabaseUrl;
  return url;
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(normalizeSupabaseUrl(supabaseUrl), supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

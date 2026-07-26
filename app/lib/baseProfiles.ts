import type { SupabaseClient } from "@supabase/supabase-js";

type BaseProfilePayload = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
  role?: string | null;
};

function cleanPayload(payload: BaseProfilePayload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
}

export async function saveBaseProfileById(
  supabase: SupabaseClient,
  payload: BaseProfilePayload
) {
  const clean = cleanPayload(payload);
  return supabase
    .from("profiles")
    .upsert(clean, { onConflict: "id" })
    .select()
    .limit(1);
}

import type { SupabaseClient } from "@supabase/supabase-js";

type CrewProfilePayload = Record<string, unknown>;

export async function saveCrewProfileByUserId<T = Record<string, unknown>>(
  client: SupabaseClient,
  userId: string,
  payload: CrewProfilePayload,
  selectColumns = "*"
): Promise<{ data: T | null; error: { message: string } | null }> {
  const profilePayload = { ...payload, user_id: userId };
  const { data: existingProfile, error: lookupError } = await client
    .from("crew_profiles")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    return { data: null, error: lookupError };
  }

  if (existingProfile?.id) {
    const { data, error } = await client
      .from("crew_profiles")
      .update(profilePayload)
      .eq("id", existingProfile.id)
      .select(selectColumns)
      .single();

    return { data: (data as T) || null, error };
  }

  const { data, error } = await client
    .from("crew_profiles")
    .insert(profilePayload)
    .select(selectColumns)
    .single();

  return { data: (data as T) || null, error };
}

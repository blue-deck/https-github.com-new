type SupabaseClientLike = {
  from: (table: string) => any;
};

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
  supabase: SupabaseClientLike,
  payload: BaseProfilePayload
) {
  const clean = cleanPayload(payload);
  const existing = await supabase
    .from("profiles")
    .select("id")
    .eq("id", payload.id)
    .limit(1);

  if (existing.error) return { data: null, error: existing.error };

  if (existing.data?.[0]?.id) {
    return supabase
      .from("profiles")
      .update(clean)
      .eq("id", payload.id)
      .select()
      .limit(1);
  }

  return supabase.from("profiles").insert(clean).select().limit(1);
}

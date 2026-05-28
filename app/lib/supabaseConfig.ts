export const BLUEDECK_SUPABASE_URL = "https://onftggrmmpvvwgxxzywo.supabase.co";

const knownWrongProjectRefs = ["onftgqrmmpvvwgxxzywo"];

export function resolveSupabaseUrl(url?: string) {
  const cleanUrl = url?.trim().replace(/\/$/, "");

  if (!cleanUrl) return BLUEDECK_SUPABASE_URL;

  if (knownWrongProjectRefs.some((projectRef) => cleanUrl.includes(projectRef))) {
    return BLUEDECK_SUPABASE_URL;
  }

  return cleanUrl;
}

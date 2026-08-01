export const BLUEDECK_SUPABASE_URL = "https://onftggrmmpvvwgxxzywo.supabase.co";

const knownWrongProjectRefs = ["onftgqrmmpvvwgxxzywo"];
const bluedeckSupabaseOrigin = new URL(BLUEDECK_SUPABASE_URL).origin;

export function resolveSupabaseUrl(url?: string) {
  const cleanUrl = url?.trim().replace(/\/$/, "");

  if (!cleanUrl) return BLUEDECK_SUPABASE_URL;

  if (knownWrongProjectRefs.some((projectRef) => cleanUrl.includes(projectRef))) {
    return BLUEDECK_SUPABASE_URL;
  }

  try {
    const parsedUrl = new URL(cleanUrl);
    if (
      parsedUrl.protocol === "https:" &&
      !parsedUrl.username &&
      !parsedUrl.password &&
      !parsedUrl.search &&
      !parsedUrl.hash &&
      (parsedUrl.pathname === "" || parsedUrl.pathname === "/") &&
      parsedUrl.origin === bluedeckSupabaseOrigin
    ) {
      return BLUEDECK_SUPABASE_URL;
    }
  } catch {
    // Fail closed to the reviewed BlueDeck project instead of forwarding a
    // service-role credential to an arbitrary deployment-configured origin.
  }

  return BLUEDECK_SUPABASE_URL;
}

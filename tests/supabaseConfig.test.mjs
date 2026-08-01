import assert from "node:assert/strict";
import test from "node:test";
import {
  BLUEDECK_SUPABASE_URL,
  resolveSupabaseUrl,
} from "../app/lib/supabaseConfig.ts";

test("normalizes the reviewed BlueDeck Supabase origin", () => {
  assert.equal(resolveSupabaseUrl(BLUEDECK_SUPABASE_URL), BLUEDECK_SUPABASE_URL);
  assert.equal(
    resolveSupabaseUrl(`${BLUEDECK_SUPABASE_URL}/`),
    BLUEDECK_SUPABASE_URL,
  );
});

test("never forwards credentials to an unexpected Supabase origin", () => {
  for (const configuredUrl of [
    undefined,
    "",
    "https://onftgqrmmpvvwgxxzywo.supabase.co",
    "https://attacker.example",
    "https://onftggrmmpvvwgxxzywo.supabase.co.attacker.example",
    "https://user:password@onftggrmmpvvwgxxzywo.supabase.co",
    "http://onftggrmmpvvwgxxzywo.supabase.co",
    "https://onftggrmmpvvwgxxzywo.supabase.co/rest/v1",
    "https://onftggrmmpvvwgxxzywo.supabase.co?redirect=attacker.example",
  ]) {
    assert.equal(resolveSupabaseUrl(configuredUrl), BLUEDECK_SUPABASE_URL);
  }
});

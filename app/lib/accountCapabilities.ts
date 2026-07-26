"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMarketplaceAccountRole,
  type MarketplaceAccountRole,
} from "./marketplaceCapabilities";
import { supabase } from "./supabase";

export type AccountCapabilities = {
  role: MarketplaceAccountRole;
  position: string;
  canManageYachts: boolean;
  canApplyToJobs: boolean;
};

export async function loadAccountCapabilities(
  client: SupabaseClient = supabase,
): Promise<AccountCapabilities | null> {
  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session?.access_token) return null;

  const response = await fetch("/api/account/capabilities", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  const value: unknown = await response.json().catch(() => null);

  if (!response.ok || !isAccountCapabilitiesResponse(value)) return null;

  return {
    role: value.role,
    position: value.position,
    canManageYachts: value.canManageYachts,
    canApplyToJobs: value.canApplyToJobs,
  };
}

function isAccountCapabilitiesResponse(
  value: unknown,
): value is AccountCapabilities & { ok: true } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const candidate = value as Record<string, unknown>;
  return (
    candidate.ok === true &&
    isMarketplaceAccountRole(candidate.role) &&
    typeof candidate.position === "string" &&
    typeof candidate.canManageYachts === "boolean" &&
    typeof candidate.canApplyToJobs === "boolean"
  );
}

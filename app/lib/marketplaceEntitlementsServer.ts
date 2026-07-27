import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMarketplaceAccountRole,
  marketplaceCapabilitiesForRole,
  type MarketplaceAccountRole,
  type MarketplaceCapabilities,
} from "./marketplaceCapabilities";
import { cleanText, isRecord, isUuid } from "./employerAccessServer";

export const marketplaceEntitlementSelect =
  "user_id,account_role,plan_code,entitlement_source,posting_status,suspension_reason,suspended_at,created_at,updated_at";

export type MarketplaceEntitlement = MarketplaceCapabilities & {
  userId: string;
  planCode: string;
  source: "self_service" | "legacy_verified" | "admin" | "billing";
  postingStatus: "enabled" | "suspended";
  suspensionReason: string;
};

type EntitlementResult =
  | { ok: true; entitlement: MarketplaceEntitlement | null }
  | { ok: false; error: unknown; schemaUnavailable: boolean };

type EnsureEntitlementResult =
  | { ok: true }
  | { ok: false; error: unknown; schemaUnavailable: boolean };

const entitlementSources = new Set([
  "self_service",
  "legacy_verified",
  "admin",
  "billing",
]);

export async function loadMarketplaceEntitlement(
  client: SupabaseClient,
  userId: string,
): Promise<EntitlementResult> {
  if (!isUuid(userId)) {
    return { ok: true, entitlement: null };
  }

  const response = await client
    .from("marketplace_entitlements")
    .select(marketplaceEntitlementSelect)
    .eq("user_id", userId)
    .maybeSingle();

  if (response.error) {
    return {
      ok: false,
      error: response.error,
      schemaUnavailable: isMarketplaceSchemaUnavailable(response.error),
    };
  }

  if (!response.data) return { ok: true, entitlement: null };
  const entitlement = marketplaceEntitlementFromRow(response.data);
  if (!entitlement) {
    return {
      ok: false,
      error: new Error("Invalid marketplace entitlement record."),
      schemaUnavailable: false,
    };
  }

  return { ok: true, entitlement };
}

export async function ensureMarketplaceEntitlement(
  client: SupabaseClient,
  userId: string,
  requestedRole: MarketplaceAccountRole | null = null,
  source: "self_service" | "legacy_verified" | "admin" | "billing" =
    "self_service",
): Promise<EnsureEntitlementResult> {
  if (!isUuid(userId)) {
    return {
      ok: false,
      error: new Error("Invalid marketplace account identifier."),
      schemaUnavailable: false,
    };
  }

  const response = await client.rpc("bluedeck_ensure_marketplace_entitlement", {
    p_user_id: userId,
    p_requested_role: requestedRole,
    p_entitlement_source: source,
  });

  if (response.error) {
    return {
      ok: false,
      error: response.error,
      schemaUnavailable: isMarketplaceSchemaUnavailable(response.error),
    };
  }

  return { ok: true };
}

export async function loadOrEnsureMarketplaceEntitlement(
  client: SupabaseClient,
  userId: string,
): Promise<EntitlementResult> {
  const loaded = await loadMarketplaceEntitlement(client, userId);
  if (!loaded.ok || loaded.entitlement) return loaded;

  const ensured = await ensureMarketplaceEntitlement(client, userId);
  if (!ensured.ok) return ensured;

  return loadMarketplaceEntitlement(client, userId);
}

export function marketplaceEntitlementFromRow(
  value: unknown,
): MarketplaceEntitlement | null {
  if (!isRecord(value)) return null;

  const userId = cleanText(value.user_id);
  const accountRole = cleanText(value.account_role).toLowerCase();
  const planCode = cleanText(value.plan_code);
  const source = cleanText(value.entitlement_source);
  const postingStatus = cleanText(value.posting_status);

  if (
    !isUuid(userId) ||
    !isMarketplaceAccountRole(accountRole) ||
    !planCode ||
    !entitlementSources.has(source) ||
    (postingStatus !== "enabled" && postingStatus !== "suspended")
  ) {
    return null;
  }

  const roleCapabilities = marketplaceCapabilitiesForRole(accountRole);
  return {
    userId,
    role: accountRole,
    canPostJobs:
      postingStatus === "enabled" && roleCapabilities.canPostJobs,
    canApplyJobs: roleCapabilities.canApplyJobs,
    canUseCrewWorkspace: roleCapabilities.canUseCrewWorkspace,
    requiresAdminApproval: false,
    planCode,
    source: source as MarketplaceEntitlement["source"],
    postingStatus,
    suspensionReason: cleanText(value.suspension_reason),
  };
}

export function isMarketplaceSchemaUnavailable(error: unknown) {
  if (!isRecord(error)) return false;
  const code = cleanText(error.code).toUpperCase();
  const message = `${cleanText(error.message)} ${cleanText(error.details)}`.toLowerCase();

  return (
    code === "42P01" ||
    code === "42883" ||
    code === "PGRST202" ||
    code === "PGRST205" ||
    (message.includes("marketplace_entitlements") &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find")))
  );
}

export function entitlementRole(
  entitlement: MarketplaceEntitlement | null,
): MarketplaceAccountRole {
  return entitlement?.role || "crew";
}

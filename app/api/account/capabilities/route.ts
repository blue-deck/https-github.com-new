import { NextRequest, NextResponse } from "next/server";
import {
  authenticatedEmployerClients,
  cleanText,
} from "../../../lib/employerAccessServer";
import { saveBaseProfileById } from "../../../lib/baseProfiles";
import { saveCrewProfileByUserId } from "../../../lib/crewProfiles";
import {
  isMarketplaceAccountRole,
  marketplaceCapabilitiesForRole,
} from "../../../lib/marketplaceCapabilities";
import { loadOrEnsureMarketplaceEntitlement } from "../../../lib/marketplaceEntitlementsServer";
import {
  getDefaultPositionForAccountType,
  yachtPositionTitles,
} from "../../../lib/yachtOperations";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const clients = await authenticatedEmployerClients(request);
  if ("error" in clients) {
    return accountResponse(
      { ok: false, error: clients.error },
      clients.status,
    );
  }

  const entitlementResult = await loadOrEnsureMarketplaceEntitlement(
    clients.serviceClient,
    clients.user.id,
  );

  if (!entitlementResult.ok || !entitlementResult.entitlement) {
    console.error("[account-capabilities]", {
      event: "entitlement_load_failed",
      userId: clients.user.id,
      schemaUnavailable:
        !entitlementResult.ok && entitlementResult.schemaUnavailable,
    });
    return accountResponse(
      { ok: false, error: "Your account role could not be verified." },
      503,
    );
  }

  let entitlement = entitlementResult.entitlement;
  const appMetadata = clients.user.app_metadata as
    | Record<string, unknown>
    | undefined;
  const trustedRoleCandidate =
    cleanText(appMetadata?.bluedeck_account_role).toLowerCase() ||
    cleanText(appMetadata?.role).toLowerCase();
  const trustedRole = isMarketplaceAccountRole(trustedRoleCandidate)
    ? trustedRoleCandidate
    : null;

  if (trustedRole && entitlement.role !== trustedRole) {
    const { error: roleSyncError } = await clients.serviceClient
      .from("marketplace_entitlements")
      .update({ account_role: trustedRole })
      .eq("user_id", clients.user.id);

    if (roleSyncError) {
      console.error("[account-capabilities]", {
        event: "entitlement_role_sync_failed",
        userId: clients.user.id,
        code: cleanText(roleSyncError.code) || undefined,
        message: cleanText(roleSyncError.message) || "Unknown database error",
      });
      return accountResponse(
        { ok: false, error: "Your account role could not be synchronized." },
        503,
      );
    }

    const trustedCapabilities = marketplaceCapabilitiesForRole(trustedRole);
    entitlement = {
      ...entitlement,
      ...trustedCapabilities,
      role: trustedRole,
      canPostJobs:
        entitlement.postingStatus === "enabled" &&
        trustedCapabilities.canPostJobs,
    };
  }

  const profileResult = await saveBaseProfileById(clients.serviceClient, {
    id: clients.user.id,
    email: clients.user.email,
    full_name: cleanText(clients.user.user_metadata?.full_name) || undefined,
    role: entitlement.role,
  });

  if (profileResult.error) {
    console.error("[account-capabilities]", {
      event: "base_profile_role_sync_failed",
      userId: clients.user.id,
      code: cleanText(profileResult.error.code) || undefined,
      message: cleanText(profileResult.error.message) || "Unknown database error",
    });
  }

  const trustedPositionCandidate =
    cleanText(appMetadata?.bluedeck_signup_position) ||
    cleanText(appMetadata?.position);
  const trustedPosition = yachtPositionTitles.includes(trustedPositionCandidate)
    ? trustedPositionCandidate
    : getDefaultPositionForAccountType(entitlement.role);
  const { data: crewProfile, error: crewProfileError } = await clients.serviceClient
    .from("crew_profiles")
    .select("id,current_position,current_positions")
    .eq("user_id", clients.user.id)
    .maybeSingle();

  if (crewProfileError) {
    console.error("[account-capabilities]", {
      event: "crew_position_load_failed",
      userId: clients.user.id,
      code: cleanText(crewProfileError.code) || undefined,
      message: cleanText(crewProfileError.message) || "Unknown database error",
    });
  }

  const savedPosition =
    cleanText(crewProfile?.current_position) ||
    (Array.isArray(crewProfile?.current_positions)
      ? cleanText(crewProfile.current_positions[0])
      : "");
  const position = savedPosition || trustedPosition;

  if (!crewProfileError && position && !savedPosition) {
    const crewProfileResult = await saveCrewProfileByUserId(
      clients.serviceClient,
      clients.user.id,
      {
        email: clients.user.email,
        full_name:
          cleanText(clients.user.user_metadata?.full_name) ||
          clients.user.email,
        current_position: position,
        current_positions: [position],
        public_crew_id: clients.user.id.slice(0, 8).toUpperCase(),
      },
      "id,current_position,current_positions",
    );

    if (crewProfileResult.error) {
      console.error("[account-capabilities]", {
        event: "crew_position_sync_failed",
        userId: clients.user.id,
        message: cleanText(crewProfileResult.error.message),
      });
    }
  }

  return accountResponse({
    ok: true,
    role: entitlement.role,
    position,
    canManageYachts: ["captain", "owner", "management"].includes(
      entitlement.role,
    ),
    canApplyToJobs: entitlement.canApplyJobs,
  });
}

function accountResponse(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      Vary: "Authorization",
    },
  });
}

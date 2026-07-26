import { NextRequest, NextResponse } from "next/server";
import {
  authenticatedEmployerClients,
  cleanText,
} from "../../../lib/employerAccessServer";
import { saveBaseProfileById } from "../../../lib/baseProfiles";
import { loadOrEnsureMarketplaceEntitlement } from "../../../lib/marketplaceEntitlementsServer";

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

  const entitlement = entitlementResult.entitlement;
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

  return accountResponse({
    ok: true,
    role: entitlement.role,
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

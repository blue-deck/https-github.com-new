import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { authenticateActiveBearer } from "../../../lib/activeBearerServer";
import { loadMarketplaceEntitlement } from "../../../lib/marketplaceEntitlementsServer";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const maximumTokenBytes = 8_192;

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return response(
      { ok: false, error: "Crew profile service is unavailable." },
      503,
    );
  }

  const token = bearerToken(request);
  if (!token) {
    return response(
      { ok: false, error: "Login session is required." },
      401,
    );
  }

  const resolvedUrl = resolveSupabaseUrl(supabaseUrl);
  const authClient = createClient(resolvedUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(resolvedUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authenticated = await authenticateActiveBearer({
    token,
    authClient,
    serviceClient,
  });
  if (!authenticated.ok) {
    return response(
      { ok: false, error: authenticated.error },
      authenticated.status,
    );
  }
  const user = authenticated.user;

  if (!user.email_confirmed_at) {
    return response(
      { ok: false, error: "A verified account email is required." },
      403,
    );
  }

  const entitlementResult = await loadMarketplaceEntitlement(
    serviceClient,
    user.id,
  );
  if (!entitlementResult.ok) {
    return response(
      { ok: false, error: "Crew workspace access could not be verified." },
      503,
    );
  }
  if (!entitlementResult.entitlement?.canUseCrewWorkspace) {
    return response(
      { ok: false, error: "Crew workspace access denied." },
      403,
    );
  }

  const { data, error } = await serviceClient.rpc(
    "bluedeck_claim_legacy_crew_profile",
    {
      p_user_id: user.id,
      p_full_name:
        cleanText(user.user_metadata?.full_name) ||
        cleanText(user.email).split("@")[0] ||
        "BlueDeck crew",
    },
  );

  if (error) {
    console.error("[crew-profile-reconcile]", {
      event: "legacy_profile_claim_failed",
      userId: user.id,
      code: cleanText(error.code) || undefined,
      message: cleanText(error.message) || "Unknown database error",
    });
    return response(
      { ok: false, error: "Crew profile could not be reconciled." },
      cleanText(error.code) === "40001" ? 409 : 500,
    );
  }

  const result = isRecord(data) ? data : {};
  if (result.ok === true) {
    return response({
      ok: true,
      claimed: result.claimed === true,
      alreadyLinked: result.already_linked === true,
    });
  }

  const reason = cleanText(result.reason);
  if (reason === "verified_email_required") {
    return response(
      { ok: false, error: "A verified account email is required." },
      403,
    );
  }

  return response(
    {
      ok: false,
      error:
        reason === "ambiguous"
          ? "Multiple legacy crew profiles require platform review."
          : "Crew profile could not be reconciled.",
    },
    409,
  );
}

function bearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const match = /^Bearer[ \t]+([^\s,]+)[ \t]*$/i.exec(authorization);
  const token = match?.[1] || "";
  return token.length <= maximumTokenBytes ? token : "";
}

function response(body: Record<string, unknown>, status = 200) {
  const result = NextResponse.json(body, { status });
  result.headers.set(
    "Cache-Control",
    "private, no-store, max-age=0, must-revalidate",
  );
  return result;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

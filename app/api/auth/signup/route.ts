import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { saveBaseProfileById } from "../../../lib/baseProfiles";
import { saveCrewProfileByUserId } from "../../../lib/crewProfiles";
import { authConfirmUrl, safeInternalPath } from "../../../lib/site";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";
import {
  canUseCrewWorkspace,
  isMarketplaceAccountRole,
} from "../../../lib/marketplaceCapabilities";
import { ensureMarketplaceEntitlement } from "../../../lib/marketplaceEntitlementsServer";
import { getDefaultPositionForAccountType, yachtPositionTitles } from "../../../lib/yachtOperations";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  let body: SignupRequestBody;

  try {
    body = (await request.json()) as SignupRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid account request." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password || "";
  const fullName = body.fullName?.trim() || "";
  const role = isMarketplaceAccountRole(body.role) ? body.role : "";
  const requestedPosition = body.position?.trim() || getDefaultPositionForAccountType(role);
  const position = yachtPositionTitles.includes(requestedPosition) ? requestedPosition : "";
  const nextPath = safeInternalPath(body.next);

  if (!email || !password || !fullName || !role || !position) {
    return NextResponse.json({ error: "Name, email, password, account type and yacht position are required." }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  if (!hasSignupPasswordRequirements(password)) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters and include uppercase, lowercase, a number and at least 1 special character." },
      { status: 400 }
    );
  }

  const resolvedSupabaseUrl = resolveSupabaseUrl(supabaseUrl);

  const supabase = createClient(resolvedSupabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: authConfirmUrl(nextPath),
      data: {
        full_name: fullName,
        role,
        position,
      },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data.user?.id) {
    const adminSupabase = createClient(resolvedSupabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    try {
      const trustedMetadataResult =
        await adminSupabase.auth.admin.updateUserById(data.user.id, {
          app_metadata: {
            ...(data.user.app_metadata || {}),
            role,
            position,
            bluedeck_account_role: role,
            bluedeck_signup_position: position,
          },
        });

      if (trustedMetadataResult.error) {
        console.error("BlueDeck trusted account metadata sync failed after signup", {
          userId: data.user.id,
          message: trustedMetadataResult.error.message,
        });
      }

      const profileResults = await Promise.all([
        saveBaseProfileById(adminSupabase, {
          id: data.user.id,
          email,
          full_name: fullName,
          role,
        }),
        saveCrewProfileByUserId(
          adminSupabase,
          data.user.id,
          {
            email,
            full_name: fullName,
            current_position: position,
            current_positions: [position],
            public_crew_id: canUseCrewWorkspace(role)
              ? data.user.id.slice(0, 8).toUpperCase()
              : null,
          }
        ),
      ]);

      const failedProfileWrites = profileResults
        .map((result) => result.error?.message)
        .filter(Boolean);

      if (failedProfileWrites.length > 0) {
        console.error("BlueDeck profile sync returned errors after signup", failedProfileWrites);
      }

      const entitlementResult = await ensureMarketplaceEntitlement(
        adminSupabase,
        data.user.id,
        role,
        "self_service",
      );
      if (!entitlementResult.ok) {
        console.error("BlueDeck marketplace entitlement sync failed after signup", {
          schemaUnavailable: entitlementResult.schemaUnavailable,
          message:
            entitlementResult.error instanceof Error
              ? entitlementResult.error.message
              : "Marketplace entitlement sync failed",
        });
      }
    } catch (profileError) {
      console.error("BlueDeck profile sync failed after signup", profileError);
    }
  }

  return NextResponse.json({
    userId: data.user?.id || null,
    emailConfirmed: Boolean(data.user?.email_confirmed_at),
    needsEmailConfirmation: !data.session,
  });
}

type SignupRequestBody = {
  email?: string;
  password?: string;
  fullName?: string;
  role?: string;
  position?: string;
  next?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hasSignupPasswordRequirements(value: string) {
  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

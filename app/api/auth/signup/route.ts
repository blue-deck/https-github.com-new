import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { saveBaseProfileById } from "../../../lib/baseProfiles";
import { saveCrewProfileByUserId } from "../../../lib/crewProfiles";
import { authConfirmUrl } from "../../../lib/site";
import { getDefaultPositionForAccountType, yachtPositionTitles } from "../../../lib/yachtOperations";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const accountTypes = ["crew", "captain", "owner", "management"];

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
  const phone = body.phone?.trim() || "";
  const role = accountTypes.includes(body.role || "") ? body.role || "crew" : "";
  const requestedPosition = body.position?.trim() || getDefaultPositionForAccountType(role);
  const position = yachtPositionTitles.includes(requestedPosition) ? requestedPosition : "";

  if (!email || !password || !fullName || !phone || !role || !position) {
    return NextResponse.json({ error: "Name, email, password, phone, account type and yacht position are required." }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  if (!isCompletePhoneNumber(phone)) {
    return NextResponse.json({ error: "Please select a country code and enter a valid mobile number." }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: authConfirmUrl("/dashboard"),
      data: {
        full_name: fullName,
        phone,
        role,
        position,
      },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data.user?.id) {
    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    try {
      const profileResults = await Promise.all([
        saveBaseProfileById(adminSupabase, {
          id: data.user.id,
          email,
          full_name: fullName,
          phone,
          role,
        }),
        saveCrewProfileByUserId(
          adminSupabase,
          data.user.id,
          {
            email,
            full_name: fullName,
            phone,
            current_position: position,
            public_crew_id: data.user.id.slice(0, 8).toUpperCase(),
          }
        ),
      ]);

      const failedProfileWrites = profileResults
        .map((result) => result.error?.message)
        .filter(Boolean);

      if (failedProfileWrites.length > 0) {
        console.error("BlueDeck profile sync returned errors after signup", failedProfileWrites);
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
  phone?: string;
  role?: string;
  position?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isCompletePhoneNumber(value: string) {
  return /^\+\d{1,5}\s+[\d\s()-]{5,}$/.test(value.trim());
}

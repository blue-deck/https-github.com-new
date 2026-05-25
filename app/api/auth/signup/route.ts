import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { saveCrewProfileByUserId } from "../../../lib/crewProfiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const fallbackSupabaseUrl = "https://onftggrmmpvvwgxxzywo.supabase.co";
const productionSiteUrl = "https://www.bluedeck.app";
const confirmationRedirectUrl = `${productionSiteUrl}/auth/confirm?next=/dashboard`;
const accountTypes = ["crew", "captain", "owner", "management"];

function normalizeSupabaseUrl(url?: string) {
  if (!url || url.includes("onftgqrmmpvvwgxxzywo")) return fallbackSupabaseUrl;
  return url;
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const body = (await request.json()) as {
    email?: string;
    password?: string;
    fullName?: string;
    phone?: string;
    role?: string;
  };

  const email = body.email?.trim().toLowerCase();
  const password = body.password || "";
  const fullName = body.fullName?.trim() || "";
  const phone = body.phone?.trim() || "";
  const role = accountTypes.includes(body.role || "") ? body.role || "crew" : "";

  if (!email || !password || !fullName || !phone || !role) {
    return NextResponse.json({ error: "Name, email, password, phone and account type are required." }, { status: 400 });
  }

  if (!isCompletePhoneNumber(phone)) {
    return NextResponse.json({ error: "Please select a country code and enter a valid mobile number." }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const supabase = createClient(normalizeSupabaseUrl(supabaseUrl), supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: confirmationRedirectUrl,
      data: {
        full_name: fullName,
        phone,
        role,
      },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data.user?.id) {
    const adminSupabase = createClient(normalizeSupabaseUrl(supabaseUrl), supabaseServiceRoleKey || supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    try {
      await Promise.all([
        adminSupabase.from("profiles").upsert({
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
            current_position: role === "captain" ? "Captain" : role === "owner" ? "Owner" : "Crew",
            public_crew_id: data.user.id.slice(0, 8).toUpperCase(),
          }
        ),
      ]);
    } catch {
      // Profile sync is retried from the client after sign-up; account creation should not fail here.
    }
  }

  return NextResponse.json({
    userId: data.user?.id || null,
    emailConfirmed: Boolean(data.user?.email_confirmed_at),
    needsEmailConfirmation: !data.session,
  });
}

function isCompletePhoneNumber(value: string) {
  return /^\+\d{1,5}\s+[\d\s()-]{5,}$/.test(value.trim());
}

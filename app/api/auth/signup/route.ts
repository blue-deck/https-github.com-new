import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function normalizeSupabaseUrl(url?: string) {
  return url?.replace("onftgqrmmpvvwgxxzywo", "onftggrmmpvvwgxxzywo");
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
  const origin = request.headers.get("origin") || "https://bluedeck.app";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const supabase = createClient(normalizeSupabaseUrl(supabaseUrl) || supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/dashboard`,
      data: {
        full_name: body.fullName || email,
        phone: body.phone || "",
        role: body.role || "crew",
      },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    userId: data.user?.id || null,
    emailConfirmed: Boolean(data.user?.email_confirmed_at),
    needsEmailConfirmation: !data.session,
  });
}

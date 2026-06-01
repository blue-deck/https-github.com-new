import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseUrl } from "../../../../lib/supabaseConfig";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: yachtId } = await context.params;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  if (!token) {
    return NextResponse.json({ ok: false, error: "Login session is required." }, { status: 401 });
  }

  const authClient = createClient(resolveSupabaseUrl(supabaseUrl), supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(resolveSupabaseUrl(supabaseUrl), supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: "Login session is invalid." }, { status: 401 });
  }

  const { data: yacht } = await serviceClient
    .from("yachts")
    .select("id,owner_id")
    .eq("id", yachtId)
    .maybeSingle();

  if (!yacht) {
    return NextResponse.json({ ok: false, error: "Yacht not found." }, { status: 404 });
  }

  let crewResponse = await serviceClient
    .from("yacht_crew_memberships")
    .select(`
      *,
      crew_profiles (
        id,
        user_id,
        email,
        full_name,
        current_position,
        phone,
        nationality,
        passport_number,
        passport_expiry,
        stcw_expiry,
        medical_expiry
      )
    `)
    .eq("yacht_id", yachtId)
    .order("created_at", { ascending: false });

  if (isSchemaCacheError(crewResponse.error)) {
    crewResponse = await serviceClient
      .from("yacht_crew_memberships")
      .select(`
        *,
        crew_profiles (
          id,
          user_id,
          email,
          full_name,
          current_position,
          phone,
          nationality
        )
      `)
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });
  }

  if (crewResponse.error) {
    return NextResponse.json({ ok: false, error: crewResponse.error.message }, { status: 500 });
  }

  const { data: checklists, error: checklistError } = await serviceClient
    .from("yacht_checklists")
    .select(`
      *,
      yacht_checklist_items (*)
    `)
    .eq("yacht_id", yachtId)
    .order("created_at", { ascending: false });

  if (checklistError) {
    return NextResponse.json({ ok: false, error: checklistError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    crew: crewResponse.data || [],
    checklists: checklists || [],
  });
}

function isSchemaCacheError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return error.code === "PGRST204" || /schema cache|column/i.test(error.message || "");
}

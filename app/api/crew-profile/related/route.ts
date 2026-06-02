import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type RelatedKind = "document" | "experience" | "reference" | "portfolio";
type RelatedAction = "save" | "delete";

const relatedTables: Record<RelatedKind, { table: string; columns: string[] }> = {
  document: {
    table: "crew_documents",
    columns: [
      "document_type",
      "category",
      "issuer",
      "issue_date",
      "expiry_date",
      "no_expiry",
      "show_on_cv",
      "file_url",
      "notes",
    ],
  },
  experience: {
    table: "crew_experiences",
    columns: ["yacht_name", "position", "start_date", "end_date", "description", "photo_url"],
  },
  reference: {
    table: "crew_references",
    columns: ["name", "role", "vessel", "company", "phone", "email", "notes", "show_on_cv"],
  },
  portfolio: {
    table: "crew_portfolio_photos",
    columns: ["title", "image_url", "location"],
  },
};

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  if (!token) {
    return NextResponse.json({ ok: false, error: "Login session is required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: RelatedAction;
    kind?: RelatedKind;
    profileId?: string;
    id?: string;
    payload?: Record<string, unknown>;
  } | null;

  if (!body?.kind || !body.action || !body.profileId || !relatedTables[body.kind]) {
    return NextResponse.json({ ok: false, error: "Invalid crew profile request." }, { status: 400 });
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

  if (userError || !user?.id) {
    return NextResponse.json({ ok: false, error: "Login session is invalid." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("crew_profiles")
    .select("id,user_id,email")
    .eq("id", body.profileId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });
  }

  const userEmail = user.email?.trim().toLowerCase();
  const profileEmail = profile?.email?.trim().toLowerCase();
  const ownsProfile = profile?.user_id === user.id || Boolean(userEmail && profileEmail && userEmail === profileEmail);

  if (!profile || !ownsProfile) {
    return NextResponse.json({ ok: false, error: "Crew profile access denied." }, { status: 403 });
  }

  const config = relatedTables[body.kind];

  if (body.action === "delete") {
    if (!body.id) {
      return NextResponse.json({ ok: false, error: "Record id is required." }, { status: 400 });
    }

    const { error } = await serviceClient
      .from(config.table)
      .delete()
      .eq("id", body.id)
      .eq("crew_profile_id", body.profileId);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const payload = cleanPayload(body.payload || {}, config.columns);
  const row = { ...payload, crew_profile_id: body.profileId };

  const response = body.id
    ? await serviceClient
        .from(config.table)
        .update(row)
        .eq("id", body.id)
        .eq("crew_profile_id", body.profileId)
        .select("*")
        .single()
    : await serviceClient.from(config.table).insert(row).select("*").single();

  if (response.error) {
    return NextResponse.json({ ok: false, error: response.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: response.data });
}

function cleanPayload(payload: Record<string, unknown>, columns: string[]) {
  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => columns.includes(key) && value !== undefined),
  );
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseUrl } from "../../lib/supabaseConfig";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
  const checks = {
    app: true,
    supabaseUrl: Boolean(supabaseUrl),
    serviceRole: Boolean(supabaseServiceRoleKey),
    database: false,
  };

  if (supabaseUrl && supabaseServiceRoleKey) {
    const supabase = createClient(resolveSupabaseUrl(supabaseUrl), supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { error } = await supabase.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
    checks.database = !error;
  }

  const healthy = Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks,
      checkedAt: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}

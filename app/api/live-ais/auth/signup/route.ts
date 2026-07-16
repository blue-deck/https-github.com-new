import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseUrl } from "../../../../lib/supabaseConfig";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const supabase = createClient(
      resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { fullName, email, password, role } = body;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        full_name: fullName,
        role,
        yacht_id: "c5839d51-1c51-4747-8ab9-9762f6e8b06b",
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      user: data.user,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Live AIS account creation failed.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}

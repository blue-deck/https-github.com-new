import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { absoluteSiteUrl } from "../../../lib/site";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY || process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "BlueDeck password reset is not configured." }, { status: 500 });
  }

  let body: ForgotPasswordRequestBody;

  try {
    body = (await request.json()) as ForgotPasswordRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid password reset request." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() || "";
  const captchaToken = body.captchaToken?.trim() || "";
  const website = body.website?.trim() || "";

  if (website) {
    return NextResponse.json({ ok: true });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  if (!turnstileSecretKey) {
    return NextResponse.json(
      { error: "BlueDeck security verification is not configured yet." },
      { status: 503 }
    );
  }

  if (!captchaToken) {
    return NextResponse.json({ error: "Please complete the security verification." }, { status: 400 });
  }

  const captchaResult = await verifyTurnstileToken(captchaToken, getClientIp(request));

  if (!captchaResult.success) {
    return NextResponse.json({ error: "Security verification failed. Please try again." }, { status: 400 });
  }

  const supabase = createClient(resolveSupabaseUrl(supabaseUrl), supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: absoluteSiteUrl("/reset-password"),
  });

  if (error) {
    console.error("BlueDeck password reset request failed", error.message);
    return NextResponse.json(
      { error: "BlueDeck could not send the reset email. Please try again in a moment." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

type ForgotPasswordRequestBody = {
  email?: string;
  captchaToken?: string;
  website?: string;
};

type TurnstileVerifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

async function verifyTurnstileToken(token: string, remoteIp?: string) {
  const formData = new FormData();
  formData.append("secret", turnstileSecretKey || "");
  formData.append("response", token);
  if (remoteIp) formData.append("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });
    return (await response.json()) as TurnstileVerifyResponse;
  } catch {
    return { success: false };
  }
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("cf-connecting-ip") || forwardedFor || undefined;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

function getHashParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

export default function ConfirmAuthPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Confirming your BlueDeck account...");

  useEffect(() => {
    async function confirmAccount() {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = getHashParams();
      const next = safeNext(searchParams.get("next"));
      const errorDescription =
        searchParams.get("error_description") ||
        hashParams.get("error_description") ||
        searchParams.get("error") ||
        hashParams.get("error");

      if (errorDescription) {
        setStatus("error");
        setMessage(errorDescription.replaceAll("+", " "));
        return;
      }

      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type") as EmailOtpType | null;
      const code = searchParams.get("code");

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });

        if (error) {
          setStatus("error");
          setMessage(error.message);
          return;
        }
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setStatus("error");
          setMessage(error.message);
          return;
        }
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          setStatus("success");
          setMessage("Account confirmed. Opening your dashboard...");
          window.setTimeout(() => {
            window.location.replace(next);
          }, 900);
          return;
        }

        setStatus("error");
        setMessage("This confirmation link is incomplete or expired. Please request a new BlueDeck confirmation email.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      setStatus("success");
      setMessage(session ? "Account confirmed. Opening your dashboard..." : "Account confirmed. Please login to continue.");

      window.setTimeout(() => {
        window.location.replace(session ? next : "/login");
      }, 900);
    }

    confirmAccount();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#fbf7ef_0%,#eef7f8_48%,#f7efe0_100%)] p-5 text-slate-950">
      <div className="w-full max-w-lg rounded-[34px] border border-white/70 bg-white/90 p-8 text-center shadow-2xl shadow-cyan-950/12 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950 text-cyan-300">
          {status === "loading" && <Loader2 className="h-8 w-8 animate-spin" />}
          {status === "success" && <CheckCircle2 className="h-8 w-8" />}
          {status === "error" && <ShieldCheck className="h-8 w-8" />}
        </div>

        <p className="bd-kicker mt-7">BlueDeck Account</p>
        <h1 className="mt-3 text-4xl font-black">
          {status === "error" ? "Confirmation needs attention" : "Secure confirmation"}
        </h1>
        <p className="mt-4 leading-7 text-slate-600">{message}</p>

        {status === "error" && (
          <Link
            href="/login"
            className="mt-7 inline-flex rounded-2xl bg-cyan-600 px-6 py-4 font-black text-white transition hover:bg-cyan-700"
          >
            Back to Login
          </Link>
        )}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { BlueDeckLogoLink } from "../../components/BlueDeckLogo";
import { safeInternalPath } from "../../lib/safeNavigation";
import { supabase } from "../../lib/supabase";

function getHashParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

export default function ConfirmAuthPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Confirming your BlueDeck account...");
  const [loginHref, setLoginHref] = useState("/login");

  useEffect(() => {
    async function finishSuccess() {
      await supabase.auth.signOut();
      setStatus("success");
      setMessage("Your BlueDeck account has been activated. Please log in to continue securely to BlueDeck.");
    }

    async function confirmAccount() {
      const searchParams = new URLSearchParams(window.location.search);
      const nextPath = safeInternalPath(searchParams.get("next"));
      setLoginHref(
        nextPath === "/dashboard"
          ? "/login"
          : `/login?next=${encodeURIComponent(nextPath)}`,
      );
      const hashParams = getHashParams();
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
          await finishSuccess();
          return;
        }

        setStatus("error");
        setMessage("This confirmation link is incomplete or expired. Please request a new BlueDeck confirmation email.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        await finishSuccess();
        return;
      }

      setStatus("success");
      setMessage("Your BlueDeck account has been activated. Please log in to continue securely to BlueDeck.");
    }

    confirmAccount();
  }, []);

  return (
    <main className="bd-app-page bd-ocean-shell flex min-h-screen items-center justify-center p-5 text-slate-950">
      <div className="bd-glass-card-strong w-full max-w-lg rounded-[34px] p-8 text-center">
        <BlueDeckLogoLink
          href="/"
          className="mx-auto mb-6 h-12 w-40 rounded-none border-0 bg-transparent shadow-none sm:w-52"
          imageClassName="object-contain p-0"
        />
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950 text-cyan-300">
          {status === "loading" && <Loader2 className="h-8 w-8 animate-spin" />}
          {status === "success" && <CheckCircle2 className="h-8 w-8" />}
          {status === "error" && <ShieldCheck className="h-8 w-8" />}
        </div>

        <p className="bd-kicker mt-7">BlueDeck Account</p>
        <h1 className="bd-serif mt-3 text-5xl font-normal text-[#071f3c]">
          {status === "success" ? "Account activated" : status === "error" ? "Confirmation needs attention" : "Secure confirmation"}
        </h1>
        <p className="mt-4 leading-7 text-slate-600">{message}</p>

        {status !== "loading" && (
          <Link
            href={loginHref}
            className="mt-7 inline-flex rounded-2xl bg-cyan-600 px-6 py-4 font-black text-white transition hover:bg-cyan-700"
          >
            Login to BlueDeck
          </Link>
        )}
      </div>
    </main>
  );
}

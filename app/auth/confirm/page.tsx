"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { BlueDeckLogoLink } from "../../components/BlueDeckLogo";
import { hasValidSignupProofAmr } from "../../lib/activeBearerClaims";
import { safeInternalPath } from "../../lib/site";
import { resolveSupabaseUrl } from "../../lib/supabaseConfig";

export default function ConfirmAuthPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Confirming your BlueDeck account...");
  const [loginHref, setLoginHref] = useState("/login");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let active = true;

    function finishSuccess() {
      if (!active) return;
      setStatus("success");
      setMessage("Your BlueDeck account has been activated. Please login with your email and password to open My Dashboard.");
    }

    async function confirmAccount() {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const nextPath = safeInternalPath(searchParams.get("next"));
      window.history.replaceState(null, "", "/auth/confirm");
      setLoginHref(`/login?next=${encodeURIComponent(nextPath)}`);
      const errorDescription =
        searchParams.get("error_description") ||
        hashParams.get("error_description") ||
        searchParams.get("error") ||
        hashParams.get("error");

      if (errorDescription) {
        setStatus("error");
        setMessage(
          "This confirmation link is incomplete or expired. Please request a new BlueDeck confirmation email.",
        );
        return;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) {
        throw new Error("Account confirmation is unavailable");
      }
      const confirmationClient = createClient(
        resolveSupabaseUrl(supabaseUrl),
        anonKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        },
      );

      const tokenHashes = searchParams.getAll("token_hash");
      const codes = searchParams.getAll("code");
      const types = [
        ...searchParams.getAll("type"),
        ...hashParams.getAll("type"),
      ];
      const tokenHash = tokenHashes.length === 1 ? tokenHashes[0] : "";
      const code = codes.length === 1 ? codes[0] : "";
      const type = types.length === 1 ? types[0] : "";
      const accessTokens = hashParams.getAll("access_token");
      const refreshTokens = hashParams.getAll("refresh_token");
      const accessToken = accessTokens.length === 1 ? accessTokens[0] : "";
      const refreshToken = refreshTokens.length === 1 ? refreshTokens[0] : "";
      let signupProofFlow: "implicit_or_token_hash" | "pkce";

      if (type !== "signup") {
        throw new Error("The confirmation proof is not a signup proof");
      }

      if (tokenHash) {
        signupProofFlow = "implicit_or_token_hash";
        const { error } = await confirmationClient.auth.verifyOtp({
          token_hash: tokenHash,
          type: "signup",
        });
        if (error) throw error;
      } else if (code) {
        signupProofFlow = "pkce";
        const { data, error } =
          await confirmationClient.auth.exchangeCodeForSession(code);
        const redirectType = (
          data as typeof data & { redirectType?: string | null }
        ).redirectType;
        if (error || redirectType !== "signup") {
          throw error || new Error("The authorization code is not for signup");
        }
      } else if (accessToken && refreshToken) {
        signupProofFlow = "implicit_or_token_hash";
        const { error } = await confirmationClient.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw error;
      } else {
        throw new Error("The signup confirmation proof is incomplete");
      }

      const {
        data: { session },
      } = await confirmationClient.auth.getSession();
      if (!session) {
        throw new Error("The signup confirmation session is missing");
      }
      const { data: claimsData, error: claimsError } =
        await confirmationClient.auth.getClaims(session.access_token);
      const amr = Array.isArray(claimsData?.claims?.amr)
        ? claimsData.claims.amr
        : [];
      if (
        claimsError ||
        !hasValidSignupProofAmr(amr, signupProofFlow)
      ) {
        await confirmationClient.auth.signOut({ scope: "local" });
        throw new Error("The verified session is not a signup session");
      }

      await confirmationClient.auth.signOut({ scope: "local" });
      finishSuccess();
    }

    void confirmAccount().catch(() => {
      if (!active) return;
      setStatus("error");
      setMessage(
        "This confirmation link could not be verified. Please request a new BlueDeck confirmation email.",
      );
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="bd-app-page bd-ocean-shell flex min-h-screen items-center justify-center p-5 text-slate-950"
    >
      <div className="bd-glass-card-strong w-full max-w-lg rounded-[34px] p-8 text-center">
        <BlueDeckLogoLink
          href="/"
          className="mx-auto mb-6 h-12 w-40 rounded-none border-0 bg-transparent shadow-none sm:w-52"
          imageClassName="object-contain p-0"
        />
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950 text-cyan-300"
          aria-hidden
        >
          {status === "loading" && <Loader2 className="h-8 w-8 animate-spin" />}
          {status === "success" && <CheckCircle2 className="h-8 w-8" />}
          {status === "error" && <ShieldCheck className="h-8 w-8" />}
        </div>

        <p className="bd-kicker mt-7">BlueDeck Account</p>
        <h1 className="bd-serif mt-3 text-5xl font-normal text-[#071f3c]">
          {status === "success" ? "Account activated" : status === "error" ? "Confirmation needs attention" : "Secure confirmation"}
        </h1>
        <p
          className="mt-4 leading-7 text-slate-600"
          role={status === "error" ? "alert" : "status"}
          aria-live={status === "error" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          {message}
        </p>

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

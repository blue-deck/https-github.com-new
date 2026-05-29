"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Mail, Send, ShieldCheck } from "lucide-react";
import { PublicFooter, PublicHeader } from "../components/PublicSiteChrome";
import { TurnstileWidget } from "../components/TurnstileWidget";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const requestedEmail = searchParams.get("email");
    if (requestedEmail) setEmail(requestedEmail);
  }, []);

  async function submitResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      setNotice("Please enter a valid email address.");
      return;
    }

    if (!captchaToken) {
      setNotice("Please complete the security check.");
      return;
    }

    if (website) {
      setSent(true);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          captchaToken,
          website,
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok || result.error) {
        setNotice(result.error || "BlueDeck could not send the reset email. Please try again.");
        setCaptchaToken("");
        return;
      }

      setSent(true);
    } catch {
      setNotice("BlueDeck could not send the reset email. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bd-site-shell min-h-screen pt-[92px] text-[#071f3c]">
      <PublicHeader />

      <section className="border-b border-[#071f3c]/10 bg-white/64">
        <div className="mx-auto max-w-[1500px] px-5 py-14 sm:px-8 lg:px-12">
          <p className="bd-kicker">BlueDeck account recovery</p>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.02em] text-[#07182d] sm:text-5xl">
            Reset your password
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
        <form
          onSubmit={submitResetRequest}
          className="w-full max-w-2xl"
        >
          <p className="max-w-xl text-base leading-7 text-[#405570]">
            Enter your email address below and we will send you a secure link to reset your password.
          </p>

          <label className="mt-7 block max-w-xl">
            <span className="mb-2 block text-sm font-bold text-[#07182d]">Email address</span>
            <span className="flex h-14 items-center gap-3 rounded-xl border border-[#071f3c]/16 bg-white px-4 text-cyan-700 shadow-sm transition focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/10">
              <Mail className="h-5 w-5" />
              <input
                value={email}
                type="email"
                required
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-transparent text-[#071f3c] outline-none placeholder:text-slate-400"
                placeholder="name@youremail.com"
              />
            </span>
          </label>

          <input
            tabIndex={-1}
            aria-hidden="true"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            className="hidden"
            autoComplete="off"
          />

          <div className="mt-5 max-w-xl">
            {turnstileSiteKey ? (
              <div className="rounded-xl border border-[#071f3c]/12 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#07182d]">
                  <ShieldCheck className="h-4 w-4 text-cyan-700" />
                  Security verification
                </div>
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  className="min-h-[65px]"
                  onVerify={(token) => {
                    setCaptchaToken(token);
                    setNotice("");
                  }}
                  onExpire={() => setCaptchaToken("")}
                  onError={() => {
                    setCaptchaToken("");
                    setNotice("Security verification could not load. Please refresh and try again.");
                  }}
                />
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                BlueDeck security verification needs Cloudflare Turnstile keys before password reset can be used.
              </div>
            )}
          </div>

          {notice && (
            <div className="mt-5 max-w-xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
              {notice}
            </div>
          )}

          {sent && (
            <div className="mt-5 flex max-w-xl items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              If this email belongs to a BlueDeck account, a secure reset link has been sent.
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !turnstileSiteKey}
            className="mt-6 inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-cyan-600 px-7 text-base font-bold text-white shadow-lg shadow-cyan-700/20 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-5 w-5" />
            {loading ? "Sending reset link..." : "Send reset link"}
          </button>

          <Link href="/login" className="mt-6 flex w-fit items-center gap-2 text-sm font-bold text-cyan-700 transition hover:text-[#07182d]">
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
        </form>
      </section>

      <PublicFooter />
    </main>
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

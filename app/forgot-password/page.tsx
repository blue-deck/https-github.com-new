"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Mail, Send, ShieldCheck } from "lucide-react";
import { BlueDeckLogoLink } from "../components/BlueDeckLogo";
import { PublicHeader } from "../components/PublicSiteChrome";
import { absoluteSiteUrl } from "../lib/site";
import { supabase } from "../lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [humanCheck, setHumanCheck] = useState(false);
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

    if (!humanCheck) {
      setNotice("Please complete the security check.");
      return;
    }

    if (website) {
      setSent(true);
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: absoluteSiteUrl("/reset-password"),
      });

      if (error) {
        setNotice(error.message);
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
    <main className="bd-site-shell min-h-screen overflow-hidden pt-[92px] text-[#071f3c]">
      <PublicHeader />

      <section className="bd-ocean-content mx-auto grid min-h-[calc(100vh-92px)] max-w-[1280px] items-center gap-10 px-5 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-12">
        <div className="hidden lg:block">
          <p className="bd-kicker">Secure account recovery</p>
          <h1 className="bd-serif mt-5 max-w-2xl text-6xl leading-[1.02] text-[#071f3c]">
            Reset access without leaving BlueDeck.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#5b7088]">
            We send a private reset link to your registered email. The link opens a secure BlueDeck page where you can choose a new password.
          </p>
        </div>

        <form
          onSubmit={submitResetRequest}
          className="bd-glass-card-strong mx-auto w-full max-w-xl rounded-[34px] p-6 shadow-2xl shadow-slate-950/10 sm:p-9"
        >
          <BlueDeckLogoLink
            href="/"
            priority
            className="mb-7 h-14 w-48 rounded-none border-0 bg-transparent shadow-none"
            imageClassName="object-contain p-0"
          />

          <p className="bd-kicker">BlueDeck password reset</p>
          <h2 className="bd-serif mt-4 text-5xl leading-[1.02] text-[#071f3c]">
            Reset your password
          </h2>
          <p className="mt-4 text-base leading-7 text-[#5b7088]">
            Enter your email address below and we will send you a secure link to reset your password.
          </p>

          <label className="mt-8 block">
            <span className="mb-2 block text-sm font-bold text-[#071f3c]">Email address</span>
            <span className="flex items-center gap-3 rounded-2xl border border-[#071f3c]/14 bg-white px-4 py-4 text-cyan-700 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-100">
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

          <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[#071f3c]/12 bg-white/82 px-5 py-5 shadow-sm">
            <span className="flex items-center gap-4 text-base font-semibold text-[#071f3c]">
              <input
                type="checkbox"
                checked={humanCheck}
                onChange={(event) => setHumanCheck(event.target.checked)}
                className="h-6 w-6 rounded border-[#071f3c]/20 accent-cyan-600"
              />
              I am not a robot
            </span>
            <ShieldCheck className="h-8 w-8 text-cyan-600" />
          </label>

          {notice && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
              {notice}
            </div>
          )}

          {sent && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              If this email belongs to a BlueDeck account, a secure reset link has been sent.
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#0b2fba] px-6 py-4 text-base font-black text-white shadow-xl shadow-blue-950/18 transition hover:bg-[#09248f] disabled:opacity-60"
          >
            <Send className="h-5 w-5" />
            {loading ? "Sending reset link..." : "Send reset link"}
          </button>

          <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#0b2fba] transition hover:text-cyan-700">
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
        </form>
      </section>
    </main>
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

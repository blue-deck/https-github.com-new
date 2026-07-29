"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Mail, Send, ShieldCheck } from "lucide-react";
import { useLanguage } from "../components/LanguageProvider";
import { PublicFooter, PublicHeader } from "../components/PublicSiteChrome";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { useTurnstileConfiguration } from "../lib/useTurnstileConfiguration";

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const {
    enabled: turnstileEnabled,
    siteKey: turnstileSiteKey,
  } = useTurnstileConfiguration();
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
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
      setNotice(t("forgot.invalidEmail"));
      return;
    }

    if (turnstileEnabled && !captchaToken) {
      setNotice(t("forgot.completeSecurity"));
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
      const result = (await response.json()) as {
        error?: string;
        code?: string;
      };

      if (!response.ok || result.error) {
        setNotice(forgotPasswordNotice(result.code, response.status, t));
        setCaptchaToken("");
        setCaptchaAttempt((attempt) => attempt + 1);
        return;
      }

      setSent(true);
    } catch {
      setNotice(t("forgot.sendFailedMoment"));
      setCaptchaToken("");
      setCaptchaAttempt((attempt) => attempt + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PublicHeader />

      <main
        id="main-content"
        tabIndex={-1}
        className="bd-site-shell min-h-screen text-[#071f3c]"
      >
        <section className="border-b border-[#071f3c]/10 bg-white/64">
          <div className="mx-auto max-w-[1500px] px-5 py-14 sm:px-8 lg:px-12">
            <p className="bd-kicker">{t("forgot.eyebrow")}</p>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.02em] text-[#07182d] sm:text-5xl">
              {t("forgot.title")}
            </h1>
          </div>
        </section>

        <section className="mx-auto max-w-[1500px] px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
          <form
            onSubmit={submitResetRequest}
            aria-busy={loading}
            className="w-full max-w-2xl"
          >
          <p className="max-w-xl text-base leading-7 text-[#405570]">
            {t("forgot.intro")}
          </p>

          <div className="mt-7 block max-w-xl">
            <label
              htmlFor={emailId}
              className="mb-2 block select-text text-sm font-bold text-[#07182d]"
            >
              {t("forgot.email")}
            </label>
            <span className="flex h-14 items-center gap-3 rounded-xl border border-[#071f3c]/16 bg-white px-4 text-cyan-700 shadow-sm transition focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/10">
              <Mail className="h-5 w-5" aria-hidden />
              <input
                id={emailId}
                name="email"
                value={email}
                type="email"
                required
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-transparent text-[#071f3c] outline-none placeholder:text-slate-400"
                placeholder="name@youremail.com"
              />
            </span>
          </div>

          <input
            name="website"
            tabIndex={-1}
            aria-hidden="true"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            className="pointer-events-none absolute -left-[10000px] h-px w-px opacity-0"
            autoComplete="off"
          />

          {turnstileEnabled && turnstileSiteKey ? (
            <div className="mt-5 max-w-xl">
              <div className="rounded-xl border border-[#071f3c]/12 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#07182d]">
                  <ShieldCheck className="h-4 w-4 text-cyan-700" aria-hidden />
                  {t("forgot.security")}
                </div>
                <TurnstileWidget
                  key={captchaAttempt}
                  siteKey={turnstileSiteKey}
                  className="min-h-[65px]"
                  onVerify={(token) => {
                    setCaptchaToken(token);
                    setNotice("");
                  }}
                  onExpire={() => setCaptchaToken("")}
                  onError={() => {
                    setCaptchaToken("");
                    setNotice(t("forgot.securityError"));
                  }}
                />
              </div>
            </div>
          ) : null}

          {notice && (
            <div
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
              className="mt-5 max-w-xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700"
            >
              {notice}
            </div>
          )}

          {sent && (
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="mt-5 flex max-w-xl items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-800"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              {t("forgot.sent")}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="mt-6 inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-cyan-600 px-7 text-base font-bold text-white shadow-lg shadow-cyan-700/20 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-5 w-5" aria-hidden />
            {loading ? t("forgot.sending") : t("forgot.send")}
          </button>

          <Link href="/login" className="mt-6 flex w-fit items-center gap-2 text-sm font-bold text-cyan-700 transition hover:text-[#07182d]">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("login.backToLogin")}
          </Link>
          </form>
        </section>
      </main>

      <PublicFooter />
    </>
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function forgotPasswordNotice(
  code: string | undefined,
  status: number,
  t: ReturnType<typeof useLanguage>["t"],
) {
  if (code === "invalid_email") return t("forgot.invalidEmail");
  if (code === "captcha_required") return t("forgot.completeSecurity");
  if (code === "captcha_failed") return t("forgot.securityError");
  if (code === "rate_limited" || status === 429) {
    return t("forgot.rateLimited");
  }
  return t("forgot.sendFailedMoment");
}

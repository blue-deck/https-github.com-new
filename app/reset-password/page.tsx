"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { BlueDeckLogoLink } from "../components/BlueDeckLogo";
import { useLanguage } from "../components/LanguageProvider";
import { PublicHeader } from "../components/PublicSiteChrome";
import type { TranslationKey } from "../lib/i18n";
import { supabase } from "../lib/supabase";

type RecoveryState = "checking" | "ready" | "done" | "error";

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<RecoveryState>("checking");
  const [message, setMessage] = useState(() => t("reset.checking"));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const passwordStrength = useMemo(() => getPasswordStrength(password, t), [password, t]);

  useEffect(() => {
    async function prepareResetSession() {
      setMessage(t("reset.checking"));
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
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

      try {
        const code = searchParams.get("code");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const tokenHash = searchParams.get("token_hash") || hashParams.get("token_hash");
        const type = (searchParams.get("type") || hashParams.get("type")) as EmailOtpType | null;

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });
          if (error) throw error;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setStatus("error");
          setMessage(t("reset.incomplete"));
          return;
        }

        window.history.replaceState(null, "", "/reset-password");
        setStatus("ready");
        setMessage(t("reset.ready"));
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : t("reset.verifyFailed"));
      }
    }

    prepareResetSession();
  }, [t]);

  async function saveNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!password || !confirmPassword) {
      setMessage(t("login.notice.newPasswordTwice"));
      return;
    }

    if (password.length < 6) {
      setMessage(t("login.notice.minPassword"));
      return;
    }

    if (password !== confirmPassword) {
      setMessage(t("login.notice.passwordMismatch"));
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await supabase.auth.signOut();
      setPassword("");
      setConfirmPassword("");
      setStatus("done");
      setMessage(t("login.notice.passwordUpdated"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("reset.updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="bd-site-shell min-h-screen overflow-hidden text-[#071f3c]">
      <PublicHeader />

      <section className="bd-ocean-content mx-auto grid min-h-[calc(100dvh-var(--public-header-height))] max-w-[1280px] items-center gap-10 px-5 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-12">
        <div className="hidden lg:block">
          <p className="bd-kicker">{t("reset.privateAccess")}</p>
          <h1 className="bd-serif mt-5 max-w-2xl text-6xl leading-[1.02] text-[#071f3c]">
            {t("reset.leftTitle")}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#5b7088]">
            {t("reset.leftIntro")}
          </p>
        </div>

        <form
          onSubmit={saveNewPassword}
          className="bd-glass-card-strong mx-auto w-full max-w-xl rounded-[34px] p-6 shadow-2xl shadow-slate-950/10 sm:p-9"
        >
          <BlueDeckLogoLink
            href="/"
            priority
            className="mb-7 h-14 w-48 rounded-none border-0 bg-transparent shadow-none"
            imageClassName="object-contain p-0"
          />

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#07182d] text-cyan-200">
            {status === "checking" && <Loader2 className="h-7 w-7 animate-spin" />}
            {status === "ready" && <KeyRound className="h-7 w-7" />}
            {status === "done" && <CheckCircle2 className="h-7 w-7" />}
            {status === "error" && <ShieldCheck className="h-7 w-7" />}
          </div>

          <p className="bd-kicker mt-7">{t("reset.secureReset")}</p>
          <h2 className="bd-serif mt-4 text-5xl leading-[1.02] text-[#071f3c]">
            {status === "done" ? t("reset.updatedTitle") : status === "error" ? t("reset.expiredTitle") : t("reset.createTitle")}
          </h2>

          {message && (
            <div
              className={`mt-5 rounded-2xl border px-4 py-4 text-sm leading-6 ${
                status === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : status === "done"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-[#071f3c]/10 bg-white/70 text-[#5b7088]"
              }`}
            >
              {message}
            </div>
          )}

          {status === "ready" && (
            <div className="mt-7 space-y-4">
              <AuthField icon={<LockKeyhole className="h-5 w-5" />} label={t("reset.newPassword")}>
                <input
                  value={password}
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent text-[#071f3c] outline-none placeholder:text-slate-400"
                  placeholder={t("login.minimumPassword")}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </AuthField>

              <PasswordStrengthMeter strength={passwordStrength} />

              <AuthField icon={<LockKeyhole className="h-5 w-5" />} label={t("reset.repeatPassword")}>
                <input
                  value={confirmPassword}
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full bg-transparent text-[#071f3c] outline-none placeholder:text-slate-400"
                  placeholder={t("login.samePassword")}
                />
              </AuthField>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#0b2fba] px-6 py-4 text-base font-black text-white shadow-xl shadow-blue-950/18 transition hover:bg-[#09248f] disabled:opacity-60"
              >
                {saving ? t("reset.saving") : t("reset.save")}
              </button>
            </div>
          )}

          {status !== "ready" && status !== "checking" && (
            <Link href={status === "done" ? "/login" : "/forgot-password"} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#07182d] px-6 py-4 font-black text-white transition hover:bg-[#0b2842]">
              {status === "done" ? t("login.backToLogin") : t("reset.requestNew")}
            </Link>
          )}

          {status === "ready" && (
            <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#0b2fba] transition hover:text-cyan-700">
              <ArrowLeft className="h-4 w-4" />
              {t("login.backToLogin")}
            </Link>
          )}
        </form>
      </section>
    </main>
  );
}

function AuthField({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="block">
      <p className="mb-2 block select-text text-sm font-bold text-[#071f3c]">{label}</p>
      <span className="flex items-center gap-3 rounded-2xl border border-[#071f3c]/14 bg-white px-4 py-4 text-cyan-700 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-100">
        {icon}
        {children}
      </span>
    </div>
  );
}

function PasswordStrengthMeter({ strength }: { strength: PasswordStrength }) {
  const { t } = useLanguage();

  if (!strength.visible) return null;

  return (
    <div className="rounded-2xl border border-[#071f3c]/10 bg-white/70 p-3">
      <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.12em]">
        <span className="text-[#5b7088]">{t("password.strength")}</span>
        <span className={strength.textClass}>{strength.label}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={`h-2 rounded-full transition ${index < strength.score ? strength.barClass : "bg-slate-200"}`}
          />
        ))}
      </div>
    </div>
  );
}

type PasswordStrength = {
  visible: boolean;
  score: number;
  label: string;
  barClass: string;
  textClass: string;
};

function getPasswordStrength(password: string, t: (key: TranslationKey) => string): PasswordStrength {
  if (!password) {
    return { visible: false, score: 0, label: "", barClass: "bg-slate-200", textClass: "text-slate-500" };
  }

  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  if (password.length < 6 || checks <= 1) {
    return { visible: true, score: 1, label: t("password.weak"), barClass: "bg-rose-500", textClass: "text-rose-600" };
  }

  if (checks <= 3) {
    return { visible: true, score: 2, label: t("password.medium"), barClass: "bg-amber-500", textClass: "text-amber-600" };
  }

  return { visible: true, score: 3, label: t("password.strong"), barClass: "bg-emerald-500", textClass: "text-emerald-600" };
}

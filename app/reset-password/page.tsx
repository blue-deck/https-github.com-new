"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { BlueDeckLogoLink } from "../components/BlueDeckLogo";
import { useLanguage } from "../components/LanguageProvider";
import { PublicHeader } from "../components/PublicSiteChrome";
import type { TranslationKey } from "../lib/i18n";

type RecoveryState = "checking" | "confirm" | "ready" | "done" | "error";
type RecoveryMessageTone = "info" | "success" | "error";
type RecoveryProof = {
  state: string;
  type: "recovery";
  tokenHash?: string;
  accessToken?: string;
};

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const passwordRequirementsId = useId();
  const [status, setStatus] = useState<RecoveryState>("checking");
  const [message, setMessage] = useState(() => t("reset.checking"));
  const [messageTone, setMessageTone] = useState<RecoveryMessageTone>("info");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const recoveryCheckStarted = useRef(false);
  const recoveryProof = useRef<RecoveryProof | null>(null);
  const passwordStrength = useMemo(() => getPasswordStrength(password, t), [password, t]);

  useEffect(() => {
    if (recoveryCheckStarted.current) return;
    recoveryCheckStarted.current = true;

    async function prepareResetTransaction() {
      // Recovery credentials must never remain in history or leak through a
      // same-origin referrer, including links issued before the server-only
      // callback was introduced.
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const proof = readRecoveryProof(searchParams, hashParams);
      const providerError =
        searchParams.get("error") ||
        searchParams.get("error_description") ||
        hashParams.get("error") ||
        hashParams.get("error_description");
      window.history.replaceState(null, "", "/reset-password");
      setMessage(t("reset.checking"));
      setMessageTone("info");

      if (providerError) {
        setStatus("error");
        setMessage(t("reset.verifyFailed"));
        setMessageTone("error");
        return;
      }

      if (proof) {
        recoveryProof.current = proof;
        setStatus("confirm");
        setMessage(t("reset.continueIntro"));
        setMessageTone("info");
        return;
      }

      try {
        const statusResponse = await fetch("/api/auth/reset-password", {
          method: "GET",
          cache: "no-store",
        });
        if (statusResponse.ok) {
          setStatus("ready");
          setMessage(t("reset.ready"));
          setMessageTone("info");
          return;
        }
        setStatus("confirm");
        setMessage(t("reset.continueIntro"));
        setMessageTone("info");
      } catch {
        setStatus("confirm");
        setMessage(t("reset.continueIntro"));
        setMessageTone("info");
      }
    }

    void prepareResetTransaction();
  }, [t]);

  async function confirmRecovery() {
    setStatus("checking");
    setMessage(t("reset.checking"));
    setMessageTone("info");
    try {
      const proof = recoveryProof.current;
      const response = await fetch("/api/auth/recovery/confirm", {
        method: "POST",
        cache: "no-store",
        ...(proof
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(proof),
            }
          : {}),
      });
      if (!response.ok) throw new Error("Recovery confirmation failed");
      recoveryProof.current = null;
      setStatus("ready");
      setMessage(t("reset.ready"));
      setMessageTone("info");
    } catch {
      recoveryProof.current = null;
      setStatus("error");
      setMessage(t("reset.verifyFailed"));
      setMessageTone("error");
    }
  }

  async function saveNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setMessageTone("info");

    if (!password || !confirmPassword) {
      setMessage(t("login.notice.newPasswordTwice"));
      setMessageTone("error");
      return;
    }

    if (!hasSignupPasswordRequirements(password)) {
      setMessage(t("login.notice.signupPassword"));
      setMessageTone("error");
      return;
    }

    if (password !== confirmPassword) {
      setMessage(t("login.notice.passwordMismatch"));
      setMessageTone("error");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Password update failed");

      setPassword("");
      setConfirmPassword("");
      setStatus("done");
      setMessage(t("login.notice.passwordUpdated"));
      setMessageTone("success");
    } catch {
      setMessage(t("reset.updateFailed"));
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PublicHeader />

      <main
        id="main-content"
        tabIndex={-1}
        className="bd-app-page bd-site-shell min-h-screen overflow-hidden text-[#071f3c]"
      >
        <section className="bd-ocean-content bd-page-frame bd-page-gutter mx-auto grid min-h-[calc(100dvh-var(--public-header-height))] max-w-[1280px] items-center gap-10 px-5 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-12">
          <div className="hidden lg:block">
            <p className="bd-kicker">{t("reset.privateAccess")}</p>
            <h2 className="bd-serif mt-5 max-w-2xl text-6xl leading-[1.02] text-[#071f3c]">
              {t("reset.leftTitle")}
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#5b7088]">
              {t("reset.leftIntro")}
            </p>
          </div>

          <form
            onSubmit={saveNewPassword}
            aria-busy={saving}
            className="bd-glass-card-strong mx-auto w-full max-w-xl rounded-[34px] p-6 shadow-2xl shadow-slate-950/10 sm:p-9"
          >
          <BlueDeckLogoLink
            href="/"
            priority
            className="mb-7 h-14 w-48 rounded-none border-0 bg-transparent shadow-none"
            imageClassName="object-contain p-0"
          />

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#07182d] text-cyan-200" aria-hidden>
            {status === "checking" && <Loader2 className="h-7 w-7 animate-spin" />}
            {(status === "confirm" || status === "ready") && <KeyRound className="h-7 w-7" />}
            {status === "done" && <CheckCircle2 className="h-7 w-7" />}
            {status === "error" && <ShieldCheck className="h-7 w-7" />}
          </div>

          <p className="bd-kicker mt-7">{t("reset.secureReset")}</p>
          <h1 className="bd-serif mt-4 text-5xl leading-[1.02] text-[#071f3c]">
            {status === "done" ? t("reset.updatedTitle") : status === "error" ? t("reset.expiredTitle") : t("reset.createTitle")}
          </h1>

          {message && (
            <div
              role={messageTone === "error" ? "alert" : "status"}
              aria-live={messageTone === "error" ? "assertive" : "polite"}
              aria-atomic="true"
              className={`mt-5 rounded-2xl border px-4 py-4 text-sm leading-6 ${
                messageTone === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : messageTone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-[#071f3c]/10 bg-white/70 text-[#5b7088]"
              }`}
            >
              {message}
            </div>
          )}

          {status === "ready" && (
            <div className="mt-7 space-y-4">
              <AuthField
                htmlFor={passwordId}
                icon={<LockKeyhole className="h-5 w-5" aria-hidden />}
                label={t("reset.newPassword")}
              >
                <input
                  id={passwordId}
                  name="new-password"
                  value={password}
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  aria-describedby={passwordRequirementsId}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent text-[#071f3c] outline-none placeholder:text-slate-400"
                  placeholder={t("login.minimumSignupPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t("settings.hidePassword") : t("settings.showPassword")}
                  aria-controls={`${passwordId} ${confirmPasswordId}`}
                  aria-pressed={showPassword}
                  className="bd-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-cyan-700"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
                </button>
              </AuthField>

              <PasswordStrengthMeter strength={passwordStrength} />

              <p
                id={passwordRequirementsId}
                className="rounded-2xl border border-cyan-200 bg-cyan-50/70 px-4 py-3 text-xs leading-5 text-slate-600"
              >
                {t("login.minimumSignupPassword")}. {t("login.passwordRequirements")}
              </p>

              <AuthField
                htmlFor={confirmPasswordId}
                icon={<LockKeyhole className="h-5 w-5" aria-hidden />}
                label={t("reset.repeatPassword")}
              >
                <input
                  id={confirmPasswordId}
                  name="confirm-password"
                  value={confirmPassword}
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full bg-transparent text-[#071f3c] outline-none placeholder:text-slate-400"
                  placeholder={t("login.samePassword")}
                />
              </AuthField>

              <button
                type="submit"
                disabled={saving}
                aria-busy={saving}
                className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#0b2fba] px-6 py-4 text-base font-black text-white shadow-xl shadow-blue-950/18 transition hover:bg-[#09248f] disabled:opacity-60"
              >
                {saving ? t("reset.saving") : t("reset.save")}
              </button>
            </div>
          )}

          {status === "confirm" && (
            <button
              type="button"
              onClick={() => void confirmRecovery()}
              className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#0b2fba] px-6 py-4 text-base font-black text-white shadow-xl shadow-blue-950/18 transition hover:bg-[#09248f]"
            >
              <ShieldCheck className="h-5 w-5" aria-hidden />
              {t("reset.continueSecurely")}
            </button>
          )}

          {(status === "done" || status === "error") && (
            <Link href={status === "done" ? "/login" : "/forgot-password"} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#07182d] px-6 py-4 font-black text-white transition hover:bg-[#0b2842]">
              {status === "done" ? t("login.backToLogin") : t("reset.requestNew")}
            </Link>
          )}

          {status === "ready" && (
            <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#0b2fba] transition hover:text-cyan-700">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {t("login.backToLogin")}
            </Link>
          )}
          </form>
        </section>
      </main>
    </>
  );
}

function readRecoveryProof(
  searchParams: URLSearchParams,
  hashParams: URLSearchParams,
): RecoveryProof | null {
  const states = searchParams.getAll("state");
  const tokenHashes = searchParams.getAll("token_hash");
  const accessTokens = hashParams.getAll("access_token");
  const types = [
    ...searchParams.getAll("type"),
    ...hashParams.getAll("type"),
  ];
  if (states.length !== 1 || types.length !== 1 || types[0] !== "recovery") {
    return null;
  }

  const state = states[0];
  const tokenHash = tokenHashes.length === 1 ? tokenHashes[0] : "";
  const accessToken = accessTokens.length === 1 ? accessTokens[0] : "";
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(state) ||
    Boolean(tokenHash) === Boolean(accessToken) ||
    (tokenHash && !/^[a-f0-9]{64}$/i.test(tokenHash)) ||
    (accessToken && (accessToken.length < 100 || accessToken.length > 8_192))
  ) {
    return null;
  }

  return tokenHash
    ? { state, type: "recovery", tokenHash }
    : { state, type: "recovery", accessToken };
}

function AuthField({
  htmlFor,
  label,
  icon,
  children,
}: {
  htmlFor: string;
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="block">
      <label
        htmlFor={htmlFor}
        className="mb-2 block select-text text-sm font-bold text-[#071f3c]"
      >
        {label}
      </label>
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
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="rounded-2xl border border-[#071f3c]/10 bg-white/70 p-3"
    >
      <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.12em]">
        <span className="text-[#5b7088]">{t("password.strength")}</span>
        <span className={strength.textClass}>{strength.label}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            aria-hidden="true"
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

  if (password.length < 8 || checks <= 1) {
    return { visible: true, score: 1, label: t("password.weak"), barClass: "bg-rose-500", textClass: "text-rose-600" };
  }

  if (checks <= 3) {
    return { visible: true, score: 2, label: t("password.medium"), barClass: "bg-amber-500", textClass: "text-amber-600" };
  }

  return { visible: true, score: 3, label: t("password.strong"), barClass: "bg-emerald-500", textClass: "text-emerald-600" };
}

function hasSignupPasswordRequirements(value: string) {
  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

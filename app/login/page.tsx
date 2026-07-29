"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { BlueDeckMark } from "../components/BlueDeckLogo";
import { PublicHeader } from "../components/PublicSiteChrome";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { useLanguage } from "../components/LanguageProvider";
import type { TranslationKey } from "../lib/i18n";
import { authConfirmUrl, safeInternalPath } from "../lib/site";
import { supabase } from "../lib/supabase";
import { useTurnstileConfiguration } from "../lib/useTurnstileConfiguration";
import { getDefaultPositionForAccountType, positionSelectGroups } from "../lib/yachtOperations";

type AuthMode = "login" | "signup" | "recovery";

const roleAccessCopy: Record<string, TranslationKey> = {
  crew: "login.roleCrewAccess",
  captain: "login.roleCaptainAccess",
  owner: "login.roleOwnerAccess",
  management: "login.roleManagementAccess",
};

const crewFeatureBullets = [
  "login.bullet1",
  "login.bullet2",
  "login.bullet3",
] satisfies TranslationKey[];

const employerFeatureBullets = [
  "login.employerBullet1",
  "login.employerBullet2",
  "login.employerBullet3",
] satisfies TranslationKey[];

export default function LoginPage() {
  const { t } = useLanguage();
  const {
    enabled: turnstileEnabled,
    siteKey: turnstileSiteKey,
  } = useTurnstileConfiguration();
  const router = useRouter();
  const formTitleId = useId();
  const fullNameId = useId();
  const roleId = useId();
  const positionId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [position, setPosition] = useState("");
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const [website, setWebsite] = useState("");
  const [notice, setNotice] = useState("");
  const [nextPath, setNextPath] = useState("/dashboard");
  const passwordStrength = useMemo(() => getPasswordStrength(password, t), [password, t]);
  const featureBullets =
    mode === "signup" && ["owner", "management"].includes(role)
      ? employerFeatureBullets
      : crewFeatureBullets;
  const forgotPasswordHref = email.trim()
    ? `/forgot-password?email=${encodeURIComponent(email.trim().toLowerCase())}`
    : "/forgot-password";

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const requestedMode = searchParams.get("mode");
    const requestedRole = searchParams.get("role");
    const requestedNext = safeInternalPath(searchParams.get("next"));
    const isPasswordRecovery =
      requestedMode === "recovery" ||
      searchParams.get("type") === "recovery" ||
      hashParams.get("type") === "recovery";

    if (isPasswordRecovery) {
      window.location.replace(`/reset-password${window.location.search}${window.location.hash}`);
      return;
    }

    if (requestedMode !== "signup") return;

    const frame = window.requestAnimationFrame(() => {
      setNextPath(requestedNext);
      setMode("signup");

      if (requestedRole && ["crew", "captain", "owner", "management"].includes(requestedRole)) {
        setRole(requestedRole);
        setPosition(getDefaultPositionForAccountType(requestedRole));
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const requestedNext = safeInternalPath(searchParams.get("next"));
    const isPasswordRecovery =
      searchParams.get("mode") === "recovery" ||
      searchParams.get("type") === "recovery" ||
      hashParams.get("type") === "recovery";
    let active = true;

    setNextPath(requestedNext);

    async function redirectAuthenticatedUser() {
      if (isPasswordRecovery) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (active && session) router.replace(requestedNext);
    }

    void redirectAuthenticatedUser();

    return () => {
      active = false;
    };
  }, [router]);

  async function submit() {
    setNotice("");

    if (mode === "recovery") {
      if (!password || !confirmPassword) {
        setNotice(t("login.notice.newPasswordTwice"));
        return;
      }

      if (!hasSignupPasswordRequirements(password)) {
        setNotice(t("login.notice.signupPassword"));
        return;
      }

      if (password !== confirmPassword) {
        setNotice(t("login.notice.passwordMismatch"));
        return;
      }

      setLoading(true);

      try {
        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
          setNotice(t("login.notice.resetFailed"));
          return;
        }

        await supabase.auth.signOut();
        setPassword("");
        setConfirmPassword("");
        setMode("login");
        setNotice(t("login.notice.passwordUpdated"));
      } catch {
        setNotice(t("login.notice.resetFailed"));
      } finally {
        setLoading(false);
      }

      return;
    }

    if (!email || !password) {
      setNotice(t("login.notice.emailPassword"));
      return;
    }

    if (mode === "signup" && (!fullName.trim() || !role || !position)) {
      setNotice(t("login.notice.required"));
      return;
    }

    if (mode === "signup" && !acceptedPrivacy) {
      setNotice(t("login.notice.privacy"));
      return;
    }

    if (mode === "signup" && !hasSignupPasswordRequirements(password)) {
      setNotice(t("login.notice.signupPassword"));
      return;
    }

    if (mode === "signup" && turnstileEnabled && !captchaToken) {
      setNotice(t("login.notice.completeSecurity"));
      return;
    }

    setLoading(true);

    if (mode === "login") {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        setLoading(false);

        if (error) {
          setNotice(
            authNotice(
              error.code,
              t,
              "login.notice.loginService",
            ),
          );
          return;
        }

        window.location.href = nextPath;
      } catch {
        setLoading(false);
        setNotice(t("login.notice.loginService"));
      }

      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName: fullName.trim(),
          role,
          position,
          next: nextPath,
          captchaToken,
          website,
        }),
      });

      const result = (await response.json()) as {
        error?: string;
        code?: string;
        userId?: string | null;
        needsEmailConfirmation?: boolean;
      };

      if (!response.ok || result.error) {
        setLoading(false);
        setNotice(signupNotice(result.code, response.status, t));
        setCaptchaToken("");
        setCaptchaAttempt((attempt) => attempt + 1);
        return;
      }

      setLoading(false);

      if (result.needsEmailConfirmation) {
        setNotice(t("login.notice.confirmEmail"));
        setMode("login");
        return;
      }

      setNotice(t("login.notice.accountCreated"));
      setMode("login");
    } catch {
      setLoading(false);
      setNotice(t("login.notice.createFailed"));
      setCaptchaToken("");
      setCaptchaAttempt((attempt) => attempt + 1);
    }
  }

  async function resendConfirmation() {
    if (!email) {
      setNotice(t("login.notice.enterEmail"));
      return;
    }

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: authConfirmUrl(nextPath) },
      });

      setNotice(
        error
          ? authNotice(error.code, t, "login.notice.resendFailed")
          : t("login.notice.confirmationSent"),
      );
    } catch {
      setNotice(t("login.notice.resendFailed"));
    }
  }

  return (
    <>
      <PublicHeader />
      <main
        id="main-content"
        className="bd-site-shell min-h-screen overflow-x-clip text-slate-900"
      >
      <div className="bd-ocean-content mx-auto grid min-h-[calc(100dvh-var(--public-header-height))] max-w-6xl items-center gap-8 px-5 py-8 lg:grid-cols-[1fr_460px] lg:px-8">
        <section className="hidden lg:block">
          <p className="bd-kicker">{t("login.heroEyebrow")}</p>
          <h2 className="bd-serif mt-5 max-w-3xl text-6xl font-normal leading-tight text-[#071f3c]">
            {t("login.heroTitle")}
          </h2>
          <div className="mt-8 grid max-w-2xl gap-3 text-sm text-slate-700">
            {featureBullets.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-xl border border-[#071f3c]/10 bg-white/80 px-4 py-3"
              >
                <CheckCircle2 className="h-5 w-5 text-cyan-700" aria-hidden />
                {t(item)}
              </div>
            ))}
          </div>
        </section>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          aria-labelledby={formTitleId}
          className="relative w-full rounded-2xl border border-[#071f3c]/10 bg-white p-6 shadow-xl shadow-[#071f3c]/8 sm:p-8"
        >
          <div className="flex items-center gap-3">
            <BlueDeckMark className="h-14 w-16 rounded-xl" imageClassName="p-1" />
            <div>
              <p className="font-semibold text-slate-950">BlueDeck</p>
              <p className="text-xs text-slate-500">{t("login.secureAccess")}</p>
            </div>
          </div>

          {mode === "recovery" ? (
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setNotice("");
              }}
              className="bd-focus mt-7 min-h-11 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-50"
            >
              {t("login.backToLogin")}
            </button>
          ) : (
            <div
              role="group"
              aria-label={t("login.secureAccess")}
              className="mt-7 grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1"
            >
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setCaptchaToken("");
                }}
                aria-pressed={mode === "login"}
                className={`bd-focus min-h-11 rounded-lg px-4 py-2.5 text-sm font-semibold ${mode === "login" ? "bg-[#071f3c] text-white" : "text-slate-600 hover:bg-white"}`}
              >
                {t("login.tabLogin")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setCaptchaToken("");
                  setCaptchaAttempt((attempt) => attempt + 1);
                }}
                aria-pressed={mode === "signup"}
                className={`bd-focus min-h-11 rounded-lg px-4 py-2.5 text-sm font-semibold ${mode === "signup" ? "bg-[#071f3c] text-white" : "text-slate-600 hover:bg-white"}`}
              >
                {t("login.tabSignup")}
              </button>
            </div>
          )}

          <h1 id={formTitleId} className="mt-7 text-3xl font-semibold text-slate-950">
            {mode === "login" ? t("login.welcomeBack") : mode === "recovery" ? t("login.newPasswordTitle") : t("login.createTitle")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {mode === "login"
              ? t("login.loginIntro")
              : mode === "recovery"
                ? t("login.recoveryIntro")
              : t("login.signupIntro")}
          </p>

          <div className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <AuthField
                  htmlFor={fullNameId}
                  icon={<UserRound className="h-5 w-5" aria-hidden />}
                  label={t("login.fullName")}
                  required
                >
                  <input
                    id={fullNameId}
                    value={fullName}
                    required
                    autoComplete="name"
                    onChange={(event) => setFullName(event.target.value)}
                    className="min-h-12 w-full bg-transparent text-slate-950 outline-none placeholder:text-slate-400"
                    placeholder={t("login.fullName")}
                  />
                </AuthField>
                <div className="block">
                  <label
                    htmlFor={roleId}
                    className="mb-2 block select-text text-sm text-slate-600"
                  >
                    {t("login.accountType")}{" "}
                    <span aria-hidden="true" className="text-rose-500">*</span>
                  </label>
                  <select
                    id={roleId}
                    value={role}
                    required
                    onChange={(event) => {
                      const nextRole = event.target.value;
                      setRole(nextRole);
                      setPosition(getDefaultPositionForAccountType(nextRole));
                    }}
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                  >
                    <option value="">{t("login.selectAccountType")}</option>
                    <option value="crew">{t("login.roleCrew")}</option>
                    <option value="captain">{t("login.roleCaptain")}</option>
                    <option value="owner">{t("login.roleOwner")}</option>
                    <option value="management">{t("login.roleManagement")}</option>
                  </select>
                  {role && roleAccessCopy[role] ? (
                    <p className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50/70 px-4 py-3 text-sm leading-6 text-slate-700">
                      {t(roleAccessCopy[role])}
                    </p>
                  ) : null}
                </div>
                <div className="block">
                  <label
                    htmlFor={positionId}
                    className="mb-2 block select-text text-sm text-slate-600"
                  >
                    {t("login.position")}{" "}
                    <span aria-hidden="true" className="text-rose-500">*</span>
                  </label>
                  <select
                    id={positionId}
                    value={position}
                    required
                    onChange={(event) => setPosition(event.target.value)}
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                  >
                    <option value="">{t("login.selectPosition")}</option>
                    {positionSelectGroups.map((group) => (
                      <optgroup key={group.department} label={group.department}>
                        {group.positions.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </>
            )}

            {mode !== "recovery" && (
              <AuthField
                htmlFor={emailId}
                icon={<Mail className="h-5 w-5" aria-hidden />}
                label={t("login.email")}
                required
              >
                <input
                  id={emailId}
                  value={email}
                  type="email"
                  required
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  className="min-h-12 w-full bg-transparent text-slate-950 outline-none placeholder:text-slate-400"
                  placeholder="you@example.com"
                />
              </AuthField>
            )}

            <AuthField
              htmlFor={passwordId}
              icon={<LockKeyhole className="h-5 w-5" aria-hidden />}
              label={mode === "recovery" ? t("login.newPassword") : t("login.password")}
              required
            >
              <input
                id={passwordId}
                value={password}
                type={showPassword ? "text" : "password"}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                onChange={(event) => setPassword(event.target.value)}
                className="min-h-12 w-full bg-transparent text-slate-950 outline-none placeholder:text-slate-400"
                placeholder={
                  mode === "login"
                    ? t("login.password")
                    : mode === "signup"
                      ? t("login.minimumSignupPassword")
                      : t("login.minimumPassword")
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t("settings.hidePassword") : t("settings.showPassword")}
                aria-controls={
                  mode === "recovery"
                    ? `${passwordId} ${confirmPasswordId}`
                    : passwordId
                }
                aria-pressed={showPassword}
                className="bd-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-cyan-700"
              >
                {showPassword ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
              </button>
            </AuthField>

            {(mode === "signup" || mode === "recovery") && (
              <>
                <PasswordStrengthMeter strength={passwordStrength} />
                {mode === "signup" && (
                  <p className="rounded-xl border border-cyan-200 bg-cyan-50/70 px-4 py-3 text-xs leading-5 text-slate-600">
                    {t("login.passwordRequirements")}
                  </p>
                )}
              </>
            )}

            {mode === "recovery" && (
              <>
                <AuthField
                  htmlFor={confirmPasswordId}
                  icon={<LockKeyhole className="h-5 w-5" aria-hidden />}
                  label={t("login.repeatPassword")}
                  required
                >
                  <input
                    id={confirmPasswordId}
                    value={confirmPassword}
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="min-h-12 w-full bg-transparent text-slate-950 outline-none placeholder:text-slate-400"
                    placeholder={t("login.samePassword")}
                  />
                </AuthField>
              </>
            )}

            {mode === "signup" && (
              <label className="flex min-h-11 items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                <input
                  type="checkbox"
                  checked={acceptedPrivacy}
                  required
                  onChange={(event) => setAcceptedPrivacy(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-cyan-600"
                />
                <span>
                  {t("login.privacyAgree")}{" "}
                  <Link href="/privacy" className="bd-focus rounded-sm font-semibold text-cyan-700">
                    {t("login.privacyPolicy")}
                  </Link>
                  . <span aria-hidden="true" className="text-rose-500">*</span>
                </span>
              </label>
            )}

            {mode === "signup" && (
              <>
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
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <ShieldCheck className="h-4 w-4 text-cyan-700" aria-hidden />
                      {t("login.security")}
                    </div>
                    <TurnstileWidget
                      key={captchaAttempt}
                      siteKey={turnstileSiteKey}
                      action="signup"
                      className="min-h-[65px]"
                      onVerify={(token) => {
                        setCaptchaToken(token);
                        setNotice("");
                      }}
                      onExpire={() => setCaptchaToken("")}
                      onError={() => {
                        setCaptchaToken("");
                        setNotice(t("login.notice.securityError"));
                      }}
                    />
                  </div>
                ) : null}
              </>
            )}

            {notice && (
              <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="rounded-xl border border-cyan-300/30 bg-cyan-50 p-4 text-sm leading-6 text-slate-700"
              >
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="bd-focus min-h-12 w-full rounded-xl bg-[#071f3c] px-5 py-3 font-bold text-white transition hover:bg-[#0d355f] disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? t("login.wait") : mode === "login" ? t("login.loginButton") : mode === "recovery" ? t("login.savePassword") : t("login.createButton")}
            </button>

            {mode !== "recovery" && (
              <div className="flex flex-wrap justify-between gap-3 text-sm">
                <Link href={forgotPasswordHref} className="bd-focus inline-flex min-h-11 items-center rounded-lg px-1 font-semibold text-cyan-700">
                  {t("login.forgot")}
                </Link>
                <button type="button" onClick={resendConfirmation} className="bd-focus min-h-11 rounded-lg px-1 font-semibold text-slate-600">
                  {t("login.resend")}
                </button>
              </div>
            )}

            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" aria-hidden />
              {t("login.protection")}
            </div>
          </div>
        </form>
      </div>
      </main>
    </>
  );
}

function AuthField({
  htmlFor,
  label,
  icon,
  children,
  required = false,
}: {
  htmlFor: string;
  label: string;
  icon: ReactNode;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="block">
      <label
        htmlFor={htmlFor}
        className="mb-2 block select-text text-sm text-slate-600"
      >
        {label}{" "}
        {required ? <span aria-hidden="true" className="text-rose-500">*</span> : null}
      </label>
      <span className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-cyan-700 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-100">
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
      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
    >
      <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.12em]">
        <span className="text-slate-500">{t("password.strength")}</span>
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

function authNotice(
  code: string | undefined,
  t: (key: TranslationKey) => string,
  fallback: TranslationKey,
) {
  if (code === "invalid_credentials") {
    return t("login.notice.invalidCredentials");
  }
  if (code === "email_not_confirmed") {
    return t("login.notice.emailNotConfirmed");
  }
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  ) {
    return t("login.notice.rateLimited");
  }
  return t(fallback);
}

function signupNotice(
  code: string | undefined,
  status: number,
  t: (key: TranslationKey) => string,
) {
  if (code === "email_in_use") return t("login.notice.emailInUse");
  if (code === "weak_password") return t("login.notice.signupPassword");
  if (code === "captcha_required") {
    return t("login.notice.completeSecurity");
  }
  if (code === "captcha_failed") return t("login.notice.securityError");
  if (code === "rate_limited" || status === 429) {
    return t("login.notice.rateLimited");
  }
  return t("login.notice.accountFailed");
}

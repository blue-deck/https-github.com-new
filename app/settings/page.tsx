"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { PhoneInput } from "../components/PhoneInput";
import { useLanguage } from "../components/LanguageProvider";
import { saveBaseProfileById } from "../lib/baseProfiles";
import { saveCrewProfileByUserId } from "../lib/crewProfiles";
import { languages } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { getDefaultPositionForAccountType } from "../lib/yachtOperations";

type SettingsProfile = {
  id?: string;
  email: string;
  full_name: string;
  phone: string;
  role: string;
  current_position: string;
  current_positions?: string[];
};

type Notice = {
  tone: "success" | "error";
  message: string;
};

const accountTypes = [
  { value: "crew", labelKey: "login.roleCrew" },
  { value: "captain", labelKey: "login.roleCaptain" },
  { value: "owner", labelKey: "login.roleOwner" },
  { value: "management", labelKey: "login.roleManagement" },
] as const;

const emptyProfile: SettingsProfile = {
  email: "",
  full_name: "",
  phone: "",
  role: "crew",
  current_position: "",
};

export default function SettingsPage() {
  const { language, setLanguage, t } = useLanguage();
  const [profile, setProfile] = useState<SettingsProfile>(emptyProfile);
  const [savedProfile, setSavedProfile] = useState<SettingsProfile | null>(null);
  const [originalEmail, setOriginalEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [profileNotice, setProfileNotice] = useState<Notice | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<Notice | null>(null);

  const passwordRules = useMemo(() => getPasswordRules(newPassword), [newPassword]);
  const profileChanged = useMemo(
    () => Boolean(savedProfile) && comparableProfile(profile) !== comparableProfile(savedProfile),
    [profile, savedProfile],
  );
  const accountType = accountTypes.find((item) => item.value === profile.role);
  const accountTypeLabel = accountType ? t(accountType.labelKey) : profile.role || "—";

  function updateProfile(patch: Partial<SettingsProfile>) {
    setProfile((current) => ({ ...current, ...patch }));
    setProfileNotice(null);
  }

  async function loadSettings() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.replace("/login");
        return;
      }

      const [
        { data: baseProfile, error: baseProfileError },
        { data: crewProfile, error: crewProfileError },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase
          .from("crew_profiles")
          .select("full_name, phone, email, current_position, current_positions")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (baseProfileError || crewProfileError) {
        throw baseProfileError || crewProfileError;
      }

      const email = user.email || baseProfile?.email || crewProfile?.email || "";
      const fullName =
        cleanText(baseProfile?.full_name) ||
        cleanText(crewProfile?.full_name) ||
        cleanText(user.user_metadata?.full_name) ||
        email;
      const phone =
        baseProfile?.phone ||
        crewProfile?.phone ||
        (typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : "");
      const currentPosition =
        cleanText(crewProfile?.current_position) ||
        cleanStringList(crewProfile?.current_positions)[0] ||
        "";
      const role =
        normalizeRole(baseProfile?.role || user.user_metadata?.role) ||
        inferRoleFromPosition(currentPosition) ||
        "crew";
      const nextProfile: SettingsProfile = {
        id: user.id,
        email,
        full_name: fullName,
        phone,
        role,
        current_position:
          currentPosition || getDefaultPositionForAccountType(role) || "Deckhand",
        current_positions: currentPosition ? [currentPosition] : [],
      };

      setProfile(nextProfile);
      setSavedProfile(nextProfile);
      setOriginalEmail(email);
    } catch {
      setProfileNotice({ tone: "error", message: t("settings.loadError") });
    } finally {
      setLoading(false);
    }
  }

  async function saveAccountProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileNotice(null);

    if (!profile.full_name.trim()) {
      setProfileNotice({ tone: "error", message: t("settings.requiredError") });
      return;
    }

    if (profile.phone && !isCompletePhoneNumber(profile.phone)) {
      setProfileNotice({ tone: "error", message: t("settings.phoneError") });
      return;
    }

    setSavingProfile(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.replace("/login");
        return;
      }

      const email = (originalEmail || profile.email || user.email || "")
        .trim()
        .toLowerCase();
      const fullName = profile.full_name.trim();
      const phone = profile.phone.trim();

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          phone,
        },
      });

      if (authError) {
        setProfileNotice({ tone: "error", message: authError.message });
        return;
      }

      const [{ error: baseError }, { error: crewError }] = await Promise.all([
        saveBaseProfileById(supabase, {
          id: user.id,
          email,
          full_name: fullName,
          phone,
        }),
        saveCrewProfileByUserId(supabase, user.id, {
          email,
          full_name: fullName,
          phone,
          public_crew_id: user.id.slice(0, 8).toUpperCase(),
        }),
      ]);

      if (baseError || crewError) {
        setProfileNotice({
          tone: "error",
          message:
            baseError?.message ||
            crewError?.message ||
            t("settings.saveError"),
        });
        return;
      }

      const nextProfile = {
        ...profile,
        email,
        full_name: fullName,
        phone,
      };

      setOriginalEmail(email);
      setProfile(nextProfile);
      setSavedProfile(nextProfile);
      setProfileNotice({ tone: "success", message: t("settings.profileSaved") });
    } catch {
      setProfileNotice({ tone: "error", message: t("settings.saveError") });
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordNotice(null);

    if (!currentPassword) {
      setPasswordNotice({ tone: "error", message: t("settings.currentPasswordError") });
      return;
    }

    if (!newPassword || !repeatPassword) {
      setPasswordNotice({ tone: "error", message: t("settings.newPasswordError") });
      return;
    }

    if (!passwordRules.every((rule) => rule.passed)) {
      setPasswordNotice({ tone: "error", message: t("settings.passwordPolicyError") });
      return;
    }

    if (newPassword !== repeatPassword) {
      setPasswordNotice({ tone: "error", message: t("settings.passwordMismatchError") });
      return;
    }

    setSavingPassword(true);

    try {
      const accountEmail = (originalEmail || profile.email).trim().toLowerCase();

      if (!accountEmail) {
        setPasswordNotice({ tone: "error", message: t("settings.emailVerifyError") });
        return;
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: accountEmail,
        password: currentPassword,
      });

      if (verifyError) {
        setPasswordNotice({ tone: "error", message: t("settings.incorrectPasswordError") });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setPasswordNotice({ tone: "error", message: error.message });
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      setPasswordOpen(false);
      setPasswordNotice({ tone: "success", message: t("settings.passwordChanged") });
    } catch {
      setPasswordNotice({ tone: "error", message: t("settings.passwordChangeError") });
    } finally {
      setSavingPassword(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <main className="bd-app-page min-h-screen bg-[#f4f6f8] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-[800px]">
        <header className="mb-7">
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#0b1f33] sm:text-[34px]">
            {t("settings.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-[15px]">
            {t("settings.intro")}
          </p>
        </header>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <section aria-labelledby="profile-settings-title">
            <div className="px-5 pb-2 pt-5 sm:px-7 sm:pt-7">
              <h2 id="profile-settings-title" className="text-lg font-semibold tracking-[-0.01em] text-slate-950">
                {t("settings.profileTitle")}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {t("settings.profileDescription")}
              </p>
            </div>

            <form onSubmit={saveAccountProfile}>
              <fieldset
                disabled={savingProfile}
                className="grid min-w-0 gap-5 px-5 py-5 sm:grid-cols-2 sm:px-7"
              >
                <TextField
                  id="settings-full-name"
                  label={t("login.fullName")}
                  required
                  value={profile.full_name}
                  onChange={(value) => updateProfile({ full_name: value })}
                  autoComplete="name"
                />
                <PhoneInput
                  label={t("login.mobile")}
                  value={profile.phone}
                  onChange={(value) => updateProfile({ phone: value })}
                  variant="profile"
                />
              </fieldset>

              <dl className="grid gap-5 border-t border-slate-200 bg-[#f8fafc] px-5 py-5 sm:grid-cols-3 sm:px-7">
                <AccountDetail
                  label={t("login.email")}
                  value={profile.email}
                  hint={t("settings.emailManaged")}
                />
                <AccountDetail
                  label={t("login.position")}
                  value={profile.current_position}
                  hint={t("settings.positionManaged")}
                />
                <AccountDetail
                  label={t("login.accountType")}
                  value={accountTypeLabel}
                  hint={t("settings.roleManaged")}
                />
              </dl>

              {profileNotice && (
                <div className="px-5 pt-5 sm:px-7">
                  <NoticeBanner notice={profileNotice} />
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <div className="min-h-5 text-sm font-medium text-amber-700">
                  {profileChanged ? t("settings.unsavedChanges") : null}
                </div>
                <button
                  type="submit"
                  disabled={savingProfile || !profileChanged}
                  className="bd-focus inline-flex min-h-11 items-center justify-center rounded-[10px] bg-[#0b1f33] px-5 text-sm font-semibold text-white transition hover:bg-[#123a5a] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {savingProfile ? t("settings.savingProfile") : t("settings.saveProfile")}
                </button>
              </div>
            </form>
          </section>

          <section className="border-t border-slate-200 px-5 py-5 sm:px-7" aria-labelledby="language-settings-title">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="language-settings-title" className="text-lg font-semibold tracking-[-0.01em] text-slate-950">
                  {t("settings.languageNav")}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {t("settings.languageDescription")}
                </p>
              </div>
              <div className="inline-flex w-full rounded-xl border border-slate-200 bg-[#f5f7f9] p-1 sm:w-auto">
                {languages.map((item) => {
                  const active = item.code === language;

                  return (
                    <button
                      key={item.code}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setLanguage(item.code)}
                      className={`bd-focus min-h-10 flex-1 rounded-lg px-4 text-sm font-semibold transition sm:flex-none ${
                        active
                          ? "bg-white text-[#0b1f33] shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="border-t border-slate-200 px-5 py-5 sm:px-7 sm:py-6" aria-labelledby="security-settings-title">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="security-settings-title" className="text-lg font-semibold tracking-[-0.01em] text-slate-950">
                  {t("settings.securityTitle")}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {t("settings.securityDescription")}
                </p>
              </div>
              {!passwordOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setPasswordNotice(null);
                    setPasswordOpen(true);
                  }}
                  className="bd-focus inline-flex min-h-10 items-center justify-center rounded-[10px] border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  {t("settings.changePassword")}
                </button>
              )}
            </div>

            {passwordNotice && (
              <div className="mt-5">
                <NoticeBanner notice={passwordNotice} />
              </div>
            )}

            {passwordOpen && (
              <form onSubmit={changePassword} className="mt-6 border-t border-slate-200 pt-6">
                <p className="mb-5 text-sm leading-6 text-slate-500">
                  {t("settings.protectedDescription")}
                </p>

                <fieldset disabled={savingPassword} className="space-y-5">
                  <PasswordField
                    id="settings-current-password"
                    label={t("settings.currentPassword")}
                    value={currentPassword}
                    onChange={(value) => {
                      setCurrentPassword(value);
                      setPasswordNotice(null);
                    }}
                    autoComplete="current-password"
                    showLabel={t("settings.showPassword")}
                    hideLabel={t("settings.hidePassword")}
                    required
                  />

                  <div className="grid gap-5 sm:grid-cols-2">
                    <PasswordField
                      id="settings-new-password"
                      label={t("login.newPassword")}
                      value={newPassword}
                      onChange={(value) => {
                        setNewPassword(value);
                        setPasswordNotice(null);
                      }}
                      autoComplete="new-password"
                      showLabel={t("settings.showPassword")}
                      hideLabel={t("settings.hidePassword")}
                      describedBy="settings-password-requirements"
                      required
                    />
                    <PasswordField
                      id="settings-repeat-password"
                      label={t("login.repeatPassword")}
                      value={repeatPassword}
                      onChange={(value) => {
                        setRepeatPassword(value);
                        setPasswordNotice(null);
                      }}
                      autoComplete="new-password"
                      showLabel={t("settings.showPassword")}
                      hideLabel={t("settings.hidePassword")}
                      required
                    />
                  </div>

                  {newPassword && (
                    <PasswordRequirements
                      id="settings-password-requirements"
                      title={t("settings.passwordRequirements")}
                      rules={passwordRules.map((rule) => ({
                        label: t(rule.key),
                        passed: rule.passed,
                      }))}
                    />
                  )}
                </fieldset>

                <div className="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    href={`/forgot-password?email=${encodeURIComponent((originalEmail || profile.email).trim().toLowerCase())}`}
                    className="bd-focus w-fit rounded-md text-sm font-semibold text-cyan-800 transition hover:text-[#0b1f33]"
                  >
                    {t("login.forgot")}
                  </Link>
                  <div className="grid gap-3 sm:flex">
                    <button
                      type="button"
                      disabled={savingPassword}
                      onClick={() => {
                        setCurrentPassword("");
                        setNewPassword("");
                        setRepeatPassword("");
                        setPasswordNotice(null);
                        setPasswordOpen(false);
                      }}
                      className="bd-focus min-h-11 rounded-[10px] border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t("settings.cancel")}
                    </button>
                    <button
                      type="submit"
                      disabled={savingPassword}
                      className="bd-focus min-h-11 rounded-[10px] bg-[#0b1f33] px-5 text-sm font-semibold text-white transition hover:bg-[#123a5a] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingPassword ? t("settings.changingPassword") : t("settings.changePassword")}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  required = false,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        id={id}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full rounded-[10px] border border-slate-200 bg-white px-3.5 text-base font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/10 sm:text-sm"
      />
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  showLabel,
  hideLabel,
  describedBy,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  showLabel: string;
  hideLabel: string;
  describedBy?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          required={required}
          autoComplete={autoComplete}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-12 w-full rounded-[10px] border border-slate-200 bg-white py-3 pl-3.5 pr-12 text-base font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/10 sm:text-sm"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="bd-focus absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function AccountDetail({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd data-i18n-ignore className="mt-1 truncate text-sm font-semibold text-slate-900">{value || "—"}</dd>
      <dd className="mt-1 text-xs leading-5 text-slate-500">{hint}</dd>
    </div>
  );
}

function NoticeBanner({ notice }: { notice: Notice }) {
  const success = notice.tone === "success";

  return (
    <div
      role={success ? "status" : "alert"}
      aria-live={success ? "polite" : "assertive"}
      className={`flex items-start gap-3 rounded-[10px] border px-4 py-3 text-sm font-medium ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-rose-200 bg-rose-50 text-rose-900"
      }`}
    >
      {success ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span>{notice.message}</span>
    </div>
  );
}

type PasswordRule = {
  key:
    | "settings.passwordRuleLength"
    | "settings.passwordRuleCase"
    | "settings.passwordRuleNumber"
    | "settings.passwordRuleSymbol";
  passed: boolean;
};

function getPasswordRules(password: string): PasswordRule[] {
  return [
    { key: "settings.passwordRuleLength", passed: password.length >= 8 },
    {
      key: "settings.passwordRuleCase",
      passed: /[A-Z]/.test(password) && /[a-z]/.test(password),
    },
    { key: "settings.passwordRuleNumber", passed: /\d/.test(password) },
    { key: "settings.passwordRuleSymbol", passed: /[^A-Za-z0-9]/.test(password) },
  ];
}

function PasswordRequirements({
  id,
  title,
  rules,
}: {
  id: string;
  title: string;
  rules: Array<{ label: string; passed: boolean }>;
}) {
  return (
    <div id={id} className="rounded-[10px] bg-[#f8fafc] px-4 py-3">
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
        {rules.map((rule) => (
          <li
            key={rule.label}
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              rule.passed ? "text-emerald-700" : "text-slate-500"
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                rule.passed
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-300 bg-white"
              }`}
            >
              {rule.passed && <Check className="h-3 w-3" />}
            </span>
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <main className="bd-app-page min-h-screen bg-[#f4f6f8] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-[800px] animate-pulse" aria-busy="true" aria-label="Loading settings">
        <div className="h-9 w-40 rounded-lg bg-slate-200" />
        <div className="mt-3 h-4 w-full max-w-md rounded bg-slate-200/80" />
        <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="h-[420px] border-b border-slate-200" />
          <div className="h-24 border-b border-slate-200" />
          <div className="h-28" />
        </div>
      </div>
    </main>
  );
}

function comparableProfile(profile: SettingsProfile | null) {
  if (!profile) return "";
  return JSON.stringify({
    full_name: profile.full_name.trim(),
    phone: profile.phone.trim(),
  });
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean);
}

function normalizeRole(value: unknown) {
  const role = cleanText(value).toLowerCase();
  return accountTypes.some((item) => item.value === role) ? role : "";
}

function inferRoleFromPosition(value: unknown) {
  const position = cleanText(value).toLowerCase();
  if (position.includes("captain")) return "captain";
  if (position.includes("owner")) return "owner";
  if (position.includes("manager") || position.includes("management")) return "management";
  return "";
}

function isCompletePhoneNumber(value: string) {
  return /^\+\d{1,5}\s+[\d\s()-]{5,}$/.test(value.trim());
}

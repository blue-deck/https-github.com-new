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
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Languages,
  LockKeyhole,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { PhoneInput } from "../components/PhoneInput";
import { useLanguage } from "../components/LanguageProvider";
import { saveBaseProfileById } from "../lib/baseProfiles";
import { saveCrewProfileByUserId } from "../lib/crewProfiles";
import { languages } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import {
  getDefaultPositionForAccountType,
  positionSelectGroups,
} from "../lib/yachtOperations";

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
  const [profileNotice, setProfileNotice] = useState<Notice | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<Notice | null>(null);

  const passwordRules = useMemo(() => getPasswordRules(newPassword), [newPassword]);
  const passwordStrength = useMemo(
    () => getPasswordStrength(newPassword, passwordRules),
    [newPassword, passwordRules],
  );
  const profileChanged = useMemo(
    () => Boolean(savedProfile) && comparableProfile(profile) !== comparableProfile(savedProfile),
    [profile, savedProfile],
  );
  const initials = useMemo(() => getInitials(profile.full_name || profile.email), [profile.email, profile.full_name]);
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

      const [{ data: baseProfile }, { data: crewProfile }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase
          .from("crew_profiles")
          .select("full_name, phone, email, current_position, current_positions")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

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

    if (!profile.full_name.trim() || !profile.current_position) {
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
      const currentPosition = profile.current_position;

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          phone,
          position: currentPosition,
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
          current_position: currentPosition,
          current_positions: currentPosition ? [currentPosition] : [],
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
        current_position: currentPosition,
        current_positions: currentPosition ? [currentPosition] : [],
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
    <main className="bd-app-page bd-ocean-shell min-h-screen px-5 py-7 text-slate-900 sm:px-8 sm:py-10 lg:px-10">
      <div className="bd-ocean-content mx-auto max-w-6xl">
        <header className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#07182d] text-white shadow-2xl shadow-slate-950/15">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/12 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-80 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-7 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
                {t("settings.eyebrow")}
              </p>
              <h1 className="bd-serif mt-3 text-4xl font-normal tracking-[-0.03em] sm:text-5xl">
                {t("settings.title")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68 sm:text-base sm:leading-7">
                {t("settings.intro")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-300/10 px-4 py-2.5 text-sm font-bold text-emerald-100">
                <ShieldCheck className="h-4 w-4" />
                {t("settings.secureAccount")}
              </div>
              <Link
                href="/dashboard"
                className="bd-focus inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/8 px-4 py-2.5 text-sm font-bold text-white transition hover:border-cyan-200/60 hover:bg-white/14"
              >
                {t("settings.backToDashboard")}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[255px_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-[112px]">
            <div className="hidden rounded-[26px] border border-slate-200/80 bg-white/88 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-xl lg:block">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#07182d,#0e7490)] text-sm font-black tracking-[0.08em] text-white shadow-lg shadow-cyan-950/15">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p data-i18n-ignore className="truncate text-sm font-black text-slate-950">
                    {profile.full_name || t("settings.account")}
                  </p>
                  <p data-i18n-ignore className="mt-0.5 truncate text-xs font-medium text-slate-500">
                    {profile.email}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-black text-cyan-800">
                  {accountTypeLabel}
                </span>
                <span data-i18n-ignore className="max-w-full truncate rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                  {profile.current_position}
                </span>
              </div>
            </div>

            <nav
              aria-label={t("settings.navigation")}
              className="grid grid-cols-3 gap-1 rounded-[22px] border border-slate-200/80 bg-white/88 p-2 shadow-xl shadow-slate-900/5 backdrop-blur-xl lg:block lg:rounded-[26px]"
            >
              <SettingsNavItem
                href="#profile-settings"
                icon={UserRound}
                label={t("settings.profileNav")}
                description={t("settings.profileNavHint")}
              />
              <SettingsNavItem
                href="#language-settings"
                icon={Languages}
                label={t("settings.languageNav")}
                description={t("settings.languageNavHint")}
              />
              <SettingsNavItem
                href="#security-settings"
                icon={KeyRound}
                label={t("settings.securityNav")}
                description={t("settings.securityNavHint")}
              />
            </nav>
          </aside>

          <div className="min-w-0 space-y-6">
            <SettingsSection
              id="profile-settings"
              icon={UserRound}
              eyebrow={t("settings.account")}
              title={t("settings.profileTitle")}
              description={t("settings.profileDescription")}
            >
              <form onSubmit={saveAccountProfile}>
                <div className="grid gap-5 p-5 sm:p-7 md:grid-cols-2">
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
                  />
                  <ReadOnlyField
                    icon={Mail}
                    label={t("login.email")}
                    value={profile.email}
                    hint={t("settings.emailManaged")}
                  />
                  <ReadOnlyField
                    icon={ShieldCheck}
                    label={t("login.accountType")}
                    value={accountTypeLabel}
                    hint={t("settings.roleManaged")}
                  />
                  <SelectField
                    id="settings-position"
                    label={t("login.position")}
                    placeholder={t("login.selectPosition")}
                    value={profile.current_position}
                    onChange={(value) =>
                      updateProfile({
                        current_position: value,
                        current_positions: value ? [value] : [],
                      })
                    }
                  />
                </div>

                <div className="border-t border-slate-200/80 bg-slate-50/70 px-5 py-5 sm:px-7">
                  {profileNotice && <NoticeBanner notice={profileNotice} />}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                      {profileChanged ? (
                        <>
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          {t("settings.unsavedChanges")}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          {t("settings.upToDate")}
                        </>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={savingProfile || !profileChanged}
                      className="bd-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#07182d] px-5 text-sm font-black text-white shadow-lg shadow-slate-950/12 transition hover:bg-cyan-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                    >
                      {savingProfile ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {savingProfile ? t("settings.savingProfile") : t("settings.saveProfile")}
                    </button>
                  </div>
                </div>
              </form>
            </SettingsSection>

            <SettingsSection
              id="language-settings"
              icon={Languages}
              eyebrow={t("settings.preferences")}
              title={t("settings.languageTitle")}
              description={t("settings.languageDescription")}
            >
              <div className="p-5 sm:p-7">
                <div className="grid gap-3 sm:grid-cols-2">
                  {languages.map((item) => {
                    const active = item.code === language;

                    return (
                      <button
                        key={item.code}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setLanguage(item.code)}
                        className={`bd-focus flex min-h-[76px] items-center gap-4 rounded-2xl border p-4 text-left transition ${
                          active
                            ? "border-cyan-500 bg-cyan-50 shadow-sm shadow-cyan-900/8"
                            : "border-slate-200 bg-white hover:border-cyan-300 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-2xl" aria-hidden="true">{item.flag}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black text-slate-950">{item.name}</span>
                          <span data-i18n-ignore className="mt-0.5 block text-xs font-semibold text-slate-500">{item.label}</span>
                        </span>
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                            active
                              ? "border-cyan-600 bg-cyan-700 text-white"
                              : "border-slate-300 bg-white text-transparent"
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  {t("settings.languageAvailable")}
                </p>
              </div>
            </SettingsSection>

            <SettingsSection
              id="security-settings"
              icon={KeyRound}
              eyebrow={t("settings.security")}
              title={t("settings.securityTitle")}
              description={t("settings.securityDescription")}
            >
              <form onSubmit={changePassword}>
                <div className="space-y-6 p-5 sm:p-7">
                  <div className="rounded-2xl border border-cyan-100 bg-cyan-50/55 p-4 sm:flex sm:items-center sm:gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-800 shadow-sm">
                      <LockKeyhole className="h-5 w-5" />
                    </div>
                    <div className="mt-3 sm:mt-0">
                      <p className="text-sm font-black text-slate-950">{t("settings.protectedTitle")}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{t("settings.protectedDescription")}</p>
                    </div>
                  </div>

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

                  <div className="grid gap-5 md:grid-cols-2">
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
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                      <PasswordStrengthMeter
                        strength={passwordStrength}
                        title={t("password.strength")}
                        weakLabel={t("password.weak")}
                        mediumLabel={t("password.medium")}
                        strongLabel={t("password.strong")}
                      />
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                          {t("settings.passwordRequirements")}
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {passwordRules.map((rule) => (
                            <div key={rule.key} className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                                  rule.passed
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-200 text-slate-400"
                                }`}
                              >
                                <Check className="h-3 w-3" />
                              </span>
                              {t(rule.key)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200/80 bg-slate-50/70 px-5 py-5 sm:px-7">
                  {passwordNotice && <NoticeBanner notice={passwordNotice} />}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Link
                      href={`/forgot-password?email=${encodeURIComponent((originalEmail || profile.email).trim().toLowerCase())}`}
                      className="bd-focus w-fit rounded-lg px-1 py-2 text-sm font-black text-cyan-800 transition hover:text-[#07182d]"
                    >
                      {t("login.forgot")}
                    </Link>
                    <button
                      type="submit"
                      disabled={savingPassword}
                      className="bd-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#07182d] px-5 text-sm font-black text-white shadow-lg shadow-slate-950/12 transition hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingPassword ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                      {savingPassword ? t("settings.changingPassword") : t("settings.changePassword")}
                    </button>
                  </div>
                </div>
              </form>
            </SettingsSection>
          </div>
        </div>
      </div>
    </main>
  );
}

function SettingsNavItem({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="bd-focus group flex min-w-0 flex-col items-center gap-2 rounded-[16px] px-2 py-3 text-center transition hover:bg-cyan-50 lg:flex-row lg:gap-3 lg:rounded-[18px] lg:px-3 lg:text-left"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition group-hover:border-cyan-200 group-hover:text-cyan-800">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-slate-800">{label}</span>
        <span className="mt-0.5 hidden truncate text-xs font-medium text-slate-500 lg:block">{description}</span>
      </span>
      <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-cyan-700 lg:block" />
    </a>
  );
}

function SettingsSection({
  id,
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/92 shadow-xl shadow-slate-900/5 backdrop-blur-xl"
    >
      <div className="flex items-start gap-4 border-b border-slate-200/80 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-100 bg-cyan-50 text-cyan-800">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-700">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-slate-950 sm:text-2xl">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
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
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        id={id}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[52px] w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-medium text-slate-950 outline-none shadow-sm transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
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
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  showLabel: string;
  hideLabel: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          required={required}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-[52px] w-full rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-12 text-base font-medium text-slate-950 outline-none shadow-sm transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="bd-focus absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-800"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function ReadOnlyField({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold text-slate-700">{label}</p>
      <div className="flex min-h-[52px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-700">
        <Icon className="h-4 w-4 shrink-0 text-slate-400" />
        <span data-i18n-ignore className="min-w-0 flex-1 truncate text-sm font-bold">{value || "—"}</span>
        <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>
    </div>
  );
}

function SelectField({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="md:col-span-2">
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-slate-700">
        {label} <span className="text-rose-500">*</span>
      </label>
      <select
        id={id}
        data-i18n-ignore
        value={value}
        required
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[52px] w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none shadow-sm transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
      >
        <option value="">{placeholder}</option>
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
  );
}

function NoticeBanner({ notice }: { notice: Notice }) {
  const success = notice.tone === "success";

  return (
    <div
      role={success ? "status" : "alert"}
      aria-live={success ? "polite" : "assertive"}
      className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
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

type PasswordStrength = {
  score: number;
  tone: "weak" | "medium" | "strong";
  barClass: string;
  textClass: string;
};

function getPasswordStrength(password: string, rules: PasswordRule[]): PasswordStrength {
  const passed = rules.filter((rule) => rule.passed).length;

  if (password.length < 8 || passed <= 1) {
    return { score: 1, tone: "weak", barClass: "bg-rose-500", textClass: "text-rose-600" };
  }

  if (passed < rules.length) {
    return { score: Math.max(2, passed), tone: "medium", barClass: "bg-amber-500", textClass: "text-amber-600" };
  }

  return { score: 4, tone: "strong", barClass: "bg-emerald-500", textClass: "text-emerald-600" };
}

function PasswordStrengthMeter({
  strength,
  title,
  weakLabel,
  mediumLabel,
  strongLabel,
}: {
  strength: PasswordStrength;
  title: string;
  weakLabel: string;
  mediumLabel: string;
  strongLabel: string;
}) {
  const label =
    strength.tone === "strong"
      ? strongLabel
      : strength.tone === "medium"
        ? mediumLabel
        : weakLabel;

  return (
    <div
      role="progressbar"
      aria-label={title}
      aria-valuemin={0}
      aria-valuemax={4}
      aria-valuenow={strength.score}
      aria-valuetext={label}
      className="rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.12em]">
        <span className="text-slate-500">{title}</span>
        <span className={strength.textClass}>{label}</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`h-2 rounded-full transition ${index < strength.score ? strength.barClass : "bg-slate-200"}`}
          />
        ))}
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen px-5 py-7 text-slate-900 sm:px-8 sm:py-10 lg:px-10">
      <div className="bd-ocean-content mx-auto max-w-6xl animate-pulse" aria-busy="true" aria-label="Loading settings">
        <div className="h-52 rounded-[30px] bg-slate-900/90" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[255px_minmax(0,1fr)]">
          <div className="h-72 rounded-[26px] border border-slate-200 bg-white/80" />
          <div className="space-y-6">
            <div className="h-[480px] rounded-[28px] border border-slate-200 bg-white/80" />
            <div className="h-64 rounded-[28px] border border-slate-200 bg-white/80" />
          </div>
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
    current_position: profile.current_position,
  });
}

function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "BD";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
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

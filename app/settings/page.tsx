"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { useLanguage } from "../components/LanguageProvider";
import { loadAccountCapabilities } from "../lib/accountCapabilities";
import { saveBaseProfileById } from "../lib/baseProfiles";
import { saveCrewProfileByUserId } from "../lib/crewProfiles";
import { languages } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { getDefaultPositionForAccountType } from "../lib/yachtOperations";

type SettingsProfile = {
  id?: string;
  email: string;
  full_name: string;
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
  const [hasCrewWorkspace, setHasCrewWorkspace] = useState(false);
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

      const capabilities = await loadAccountCapabilities();
      const canUseCrewWorkspace =
        capabilities?.canUseCrewWorkspace === true;
      const [
        { data: baseProfile, error: baseProfileError },
        { data: crewProfile, error: crewProfileError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("email, full_name, role")
          .eq("id", user.id)
          .maybeSingle(),
        canUseCrewWorkspace
          ? supabase
              .from("crew_profiles")
              .select("full_name, email, current_position, current_positions")
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
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
      const currentPosition =
        cleanText(crewProfile?.current_position) ||
        cleanStringList(crewProfile?.current_positions)[0] ||
        cleanText(capabilities?.position) ||
        "";
      const role =
        normalizeRole(capabilities?.role) ||
        normalizeRole(baseProfile?.role) ||
        "crew";
      const nextProfile: SettingsProfile = {
        id: user.id,
        email,
        full_name: fullName,
        role,
        current_position:
          currentPosition || getDefaultPositionForAccountType(role) || "Deckhand",
        current_positions: currentPosition ? [currentPosition] : [],
      };

      setProfile(nextProfile);
      setSavedProfile(nextProfile);
      setOriginalEmail(email);
      setHasCrewWorkspace(canUseCrewWorkspace);
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

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
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
        }),
        hasCrewWorkspace
          ? saveCrewProfileByUserId(supabase, user.id, {
              email,
              full_name: fullName,
              public_crew_id: user.id.slice(0, 8).toUpperCase(),
            })
          : Promise.resolve({ data: null, error: null }),
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

      // Supabase verifies current_password inside this authenticated update.
      // Avoid a second password grant: production Auth requires a fresh
      // single-use CAPTCHA token for every password sign-in.
      const { error } = await supabase.auth.updateUser({
        email: accountEmail,
        current_password: currentPassword,
        password: newPassword,
      });

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
    <main className="bd-app-page bd-page-gutter relative min-h-screen overflow-hidden bg-[#edf3f4] px-4 py-7 text-[#102a3b] sm:px-6 sm:py-11">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(rgba(16, 54, 70, 0.035) 1px, transparent 1px)",
          backgroundSize: "100% 40px",
        }}
      />

      <div className="bd-page-frame relative mx-auto max-w-[1080px]">
        <header className="border-b-2 border-[#17394a] pb-7 sm:pb-8">
          <div className="grid gap-7 md:grid-cols-[minmax(0,1fr)_340px] md:items-end">
            <div>
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#0b7682] sm:text-[11px]">
                <span data-i18n-ignore className="font-mono">BD–03</span>
                <span className="h-px w-8 bg-[#20a8b5]" />
                <span>{t("settings.eyebrow")}</span>
              </div>
              <h1 className="bd-serif mt-3 text-[44px] leading-none tracking-[-0.035em] text-[#09263a] sm:text-[58px]">
                {t("settings.title")}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[#5b7180] sm:text-[15px]">
                {t("settings.intro")}
              </p>
            </div>

            <dl className="grid grid-cols-2 border-y border-[#bfcdd2] md:border-y-0 md:border-l">
              <div className="py-4 pr-4 md:px-5 md:py-1">
                <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4f6876]">
                  {t("settings.account")}
                </dt>
                <dd className="mt-1.5 text-sm font-semibold text-[#102a3b]">{accountTypeLabel}</dd>
                <dd data-i18n-ignore className="mt-0.5 text-xs text-[#526a78]">{profile.current_position}</dd>
              </div>
              <div className="border-l border-[#bfcdd2] py-4 pl-4 md:px-5 md:py-1">
                <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4f6876]">
                  {t("settings.security")}
                </dt>
                <dd className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-[#102a3b]">
                  <span className="h-2 w-2 rounded-full bg-[#16836d]" />
                  {t("settings.secureAccount")}
                </dd>
                <dd className="mt-0.5 text-xs text-[#526a78]">{t("settings.securityNavHint")}</dd>
              </div>
            </dl>
          </div>
        </header>

        <div className="mt-8 space-y-7 sm:mt-10">
          <LedgerSection
            id="profile-settings"
            index="01"
            eyebrow={t("settings.profileNavHint")}
            title={t("settings.profileTitle")}
            description={t("settings.profileDescription")}
          >
            <form onSubmit={saveAccountProfile}>
              <fieldset disabled={savingProfile} className="min-w-0 max-w-xl">
                <TextField
                  id="settings-full-name"
                  label={t("login.fullName")}
                  required
                  value={profile.full_name}
                  onChange={(value) => updateProfile({ full_name: value })}
                  autoComplete="name"
                />
              </fieldset>

              <div className="mt-7">
                <div className="flex items-center gap-3 border-b border-[#d2dde0] pb-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0b7682]">
                    {t("settings.account")}
                  </span>
                  <span className="h-px flex-1 bg-[#d2dde0]" />
                  <span data-i18n-ignore className="font-mono text-[10px] text-[#526a78]">BD / 01</span>
                </div>
                <dl className="divide-y divide-[#d7e1e3] md:grid md:grid-cols-3 md:divide-x md:divide-y-0">
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
              </div>

              {profileNotice && (
                <div className="mt-5">
                  <NoticeBanner notice={profileNotice} />
                </div>
              )}

              <div className="mt-6 flex flex-col gap-4 border-t border-dashed border-[#c8d5d9] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className={`flex min-h-5 items-center gap-2 text-sm font-semibold ${profileChanged ? "text-amber-700" : "text-[#367063]"}`}>
                  <span className={`h-2 w-2 rounded-full ${profileChanged ? "bg-amber-500" : "bg-[#1c8a72]"}`} />
                  {profileChanged ? t("settings.unsavedChanges") : t("settings.upToDate")}
                </div>
                <button
                  type="submit"
                  disabled={savingProfile || !profileChanged}
                  className="bd-focus inline-flex min-h-11 items-center justify-center rounded-[6px] bg-[#09263a] px-5 text-sm font-semibold text-white transition hover:bg-[#123e54] disabled:cursor-not-allowed disabled:bg-[#dce5e8] disabled:text-[#8797a0]"
                >
                  {savingProfile ? t("settings.savingProfile") : t("settings.saveProfile")}
                </button>
              </div>
            </form>
          </LedgerSection>

          <LedgerSection
            id="language-settings"
            index="02"
            eyebrow={t("settings.preferences")}
            title={t("settings.languageTitle")}
            description={t("settings.languageDescription")}
          >
            <div
              role="radiogroup"
              aria-label={t("settings.languageTitle")}
              className="grid overflow-hidden rounded-[4px] border border-[#c5d3d7] sm:grid-cols-2"
            >
              {languages.map((item) => {
                const active = item.code === language;

                return (
                  <label
                    key={item.code}
                    className={`flex min-h-[68px] cursor-pointer items-center gap-4 border-b border-[#c5d3d7] px-4 text-left transition last:border-b-0 focus-within:z-10 focus-within:ring-2 focus-within:ring-[#087f8c] focus-within:ring-inset sm:border-b-0 sm:border-r sm:last:border-r-0 ${
                      active
                        ? "bg-[#e5f3f2] text-[#0b3544]"
                        : "bg-white text-[#526a78] hover:bg-[#f6f9f9] hover:text-[#102a3b]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="settings-language"
                      value={item.code}
                      checked={active}
                      onChange={() => setLanguage(item.code)}
                      className="sr-only"
                    />
                    <span data-i18n-ignore className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border font-mono text-xs font-bold ${active ? "border-[#178b96] bg-white text-[#08717c]" : "border-[#c5d3d7] bg-[#f6f9f9] text-[#687d89]"}`}>
                      {item.label}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.name}</span>
                      <span data-i18n-ignore className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-[#526a78]">
                        {`BlueDeck / ${item.label}`}
                      </span>
                    </span>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${active ? "border-[#087f8c] bg-[#087f8c] text-white" : "border-[#b7c6cb] bg-white text-transparent"}`}>
                      <Check className="h-3 w-3" />
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-4 text-xs leading-5 text-[#526a78]">{t("settings.languageAvailable")}</p>
          </LedgerSection>

          <LedgerSection
            id="security-settings"
            index="03"
            eyebrow={t("settings.security")}
            title={t("settings.securityTitle")}
            description={t("settings.securityDescription")}
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] border border-[#bdd7d7] bg-[#e7f4f3] text-[#08717c]">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#102a3b]">{t("settings.protectedTitle")}</p>
                  <p className="mt-1 text-xs leading-5 text-[#526a78]">{t("settings.protectedDescription")}</p>
                </div>
              </div>
              {!passwordOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setPasswordNotice(null);
                    setPasswordOpen(true);
                  }}
                  className="bd-focus inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[6px] border border-[#99aeb6] bg-white px-4 text-sm font-semibold text-[#17384a] transition hover:border-[#087f8c] hover:bg-[#f1f8f8]"
                >
                  {t("settings.changePassword")}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>

            {passwordNotice && (
              <div className="mt-5">
                <NoticeBanner notice={passwordNotice} />
              </div>
            )}

            {passwordOpen && (
              <form onSubmit={changePassword} className="mt-6 border-t border-[#d2dde0] pt-6">
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
                      describedBy={newPassword ? "settings-password-requirements" : undefined}
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
                      metLabel={t("settings.requirementMet")}
                      pendingLabel={t("settings.requirementPending")}
                      rules={passwordRules.map((rule) => ({
                        label: t(rule.key),
                        passed: rule.passed,
                      }))}
                    />
                  )}

                </fieldset>

                <div className="mt-6 flex flex-col gap-4 border-t border-dashed border-[#c8d5d9] pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    href={`/forgot-password?email=${encodeURIComponent((originalEmail || profile.email).trim().toLowerCase())}`}
                    className="bd-focus w-fit rounded-[4px] text-sm font-semibold text-[#08717c] transition hover:text-[#09263a]"
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
                      className="bd-focus min-h-11 rounded-[6px] border border-[#aabac0] bg-white px-4 text-sm font-semibold text-[#425d6c] transition hover:bg-[#f5f8f8] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t("settings.cancel")}
                    </button>
                    <button
                      type="submit"
                      disabled={savingPassword}
                      className="bd-focus min-h-11 rounded-[6px] bg-[#09263a] px-5 text-sm font-semibold text-white transition hover:bg-[#123e54] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingPassword ? t("settings.changingPassword") : t("settings.changePassword")}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </LedgerSection>
        </div>
      </div>
    </main>
  );
}

function LedgerSection({
  id,
  index,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  index: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const titleId = `${id}-title`;

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className="rounded-[4px] border border-[#cbd8dc] bg-white/95 shadow-[0_10px_30px_rgba(9,38,58,0.045)]"
    >
      <div className="grid lg:grid-cols-[215px_minmax(0,1fr)]">
        <header className="relative border-b border-[#cbd8dc] bg-[#f2f7f7] px-5 py-5 lg:border-b-0 lg:border-r lg:px-6 lg:py-7">
          <div className="flex items-start gap-3">
            <span data-i18n-ignore className="font-mono text-[40px] font-light leading-none tracking-[-0.08em] text-[#adc2c8]">
              {index}
            </span>
            <span className="mt-4 h-px w-7 bg-[#20a8b5]" />
          </div>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.17em] text-[#0b7682]">{eyebrow}</p>
          <h2 id={titleId} className="mt-1.5 text-lg font-semibold tracking-[-0.015em] text-[#102a3b]">
            {title}
          </h2>
          <p className="mt-2 max-w-sm text-xs leading-5 text-[#526a78]">{description}</p>
        </header>
        <div className="min-w-0 p-5 sm:p-7 lg:p-8">{children}</div>
      </div>
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
      <label htmlFor={id} className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#536b78]">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        id={id}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[50px] w-full rounded-[6px] border border-[#aebfc5] bg-white px-3.5 text-base font-medium text-[#102a3b] outline-none transition placeholder:text-[#83949d] focus:border-[#087f8c] focus:ring-2 focus:ring-[#087f8c]/10 sm:text-sm"
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
      <label htmlFor={id} className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#536b78]">
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
          className="min-h-[50px] w-full rounded-[6px] border border-[#aebfc5] bg-white py-3 pl-3.5 pr-12 text-base font-medium text-[#102a3b] outline-none transition placeholder:text-[#83949d] focus:border-[#087f8c] focus:ring-2 focus:ring-[#087f8c]/10 sm:text-sm"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="bd-focus absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[4px] text-[#526a78] transition hover:bg-[#edf5f5] hover:text-[#08717c]"
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
    <div className="min-w-0 py-4 md:px-5 md:first:pl-0 md:last:pr-0">
      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#526a78]">{label}</dt>
      <dd data-i18n-ignore className="mt-1.5 break-words text-sm font-semibold text-[#102a3b]">{value || "—"}</dd>
      <dd className="mt-1 text-xs leading-5 text-[#526a78]">{hint}</dd>
    </div>
  );
}

function NoticeBanner({ notice }: { notice: Notice }) {
  const success = notice.tone === "success";

  return (
    <div
      role={success ? "status" : "alert"}
      aria-live={success ? "polite" : "assertive"}
      className={`flex items-start gap-3 rounded-[4px] border px-4 py-3 text-sm font-medium ${
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
  metLabel,
  pendingLabel,
  rules,
}: {
  id: string;
  title: string;
  metLabel: string;
  pendingLabel: string;
  rules: Array<{ label: string; passed: boolean }>;
}) {
  return (
    <div id={id} className="border-y border-[#d2dde0] py-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#526a78]">{title}</p>
      <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {rules.map((rule) => (
          <li
            key={rule.label}
            aria-label={`${rule.label}: ${rule.passed ? metLabel : pendingLabel}`}
            className={`inline-flex items-center gap-2 text-xs font-medium ${
              rule.passed ? "text-[#16715d]" : "text-[#526a78]"
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                rule.passed
                  ? "bg-[#1c8a72] text-white"
                  : "border border-[#aebfc5] bg-white"
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
    <main className="bd-app-page bd-page-gutter min-h-screen bg-[#edf3f4] px-4 py-7 text-[#102a3b] sm:px-6 sm:py-11">
      <div className="bd-page-frame mx-auto max-w-[1080px] animate-pulse" aria-busy="true" aria-label="Loading settings">
        <div className="border-b-2 border-[#c1cfd3] pb-8">
          <div className="h-3 w-40 rounded-sm bg-[#c9d7da]" />
          <div className="mt-4 h-14 w-56 rounded-sm bg-[#b8c9cd]" />
          <div className="mt-4 h-4 w-full max-w-xl rounded-sm bg-[#cfdbde]" />
        </div>
        <div className="mt-10 space-y-7">
          {[330, 150, 180].map((height, index) => (
            <div key={height} className="grid overflow-hidden rounded-[4px] border border-[#cbd8dc] bg-white lg:grid-cols-[215px_minmax(0,1fr)]">
              <div className="border-b border-[#cbd8dc] bg-[#e8f0f1] p-6 lg:border-b-0 lg:border-r">
                <div className="h-10 w-16 rounded-sm bg-[#cbd8dc]" />
                <div className="mt-5 h-3 w-20 rounded-sm bg-[#c1d1d5]" />
                <div className="mt-3 h-5 w-32 rounded-sm bg-[#b8c9cd]" />
              </div>
              <div className="p-6 sm:p-8" style={{ minHeight: height }}>
                <div className="h-5 w-40 rounded-sm bg-[#d2dde0]" />
                <div className="mt-5 h-12 rounded-[4px] bg-[#e1e8ea]" />
                {index === 0 && <div className="mt-6 h-24 rounded-[4px] bg-[#edf2f3]" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function comparableProfile(profile: SettingsProfile | null) {
  if (!profile) return "";
  return JSON.stringify({
    full_name: profile.full_name.trim(),
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

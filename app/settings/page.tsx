"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  KeyRound,
  Save,
  UserRound,
} from "lucide-react";
import { PhoneInput } from "../components/PhoneInput";
import { saveBaseProfileById } from "../lib/baseProfiles";
import { saveCrewProfileByUserId } from "../lib/crewProfiles";
import { supabase } from "../lib/supabase";

type SettingsProfile = {
  id?: string;
  email: string;
  full_name: string;
  phone: string;
  role: string;
};

type Notice = {
  tone: "success" | "error";
  message: string;
};

const accountTypes = [
  { value: "crew", label: "Crew" },
  { value: "captain", label: "Captain" },
  { value: "owner", label: "Owner" },
  { value: "management", label: "Management" },
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<SettingsProfile>({
    email: "",
    full_name: "",
    phone: "",
    role: "crew",
  });
  const [originalEmail, setOriginalEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const passwordStrength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  async function loadSettings() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const [{ data: baseProfile }, { data: crewProfile }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("crew_profiles").select("full_name, phone, email, current_position").eq("user_id", user.id).maybeSingle(),
    ]);

    const email = baseProfile?.email || crewProfile?.email || user.email || "";
    const fullName =
      cleanText(baseProfile?.full_name) ||
      cleanText(crewProfile?.full_name) ||
      cleanText(user.user_metadata?.full_name) ||
      email;
    const phone =
      baseProfile?.phone ||
      crewProfile?.phone ||
      (typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : "");
    const role =
      normalizeRole(baseProfile?.role || user.user_metadata?.role) ||
      inferRoleFromPosition(crewProfile?.current_position) ||
      "crew";

    setProfile({
      id: user.id,
      email,
      full_name: fullName,
      phone,
      role,
    });
    setOriginalEmail(email);
    setLoading(false);
  }

  async function saveAccountProfile() {
    setNotice(null);

    if (!profile.full_name.trim() || !profile.email.trim() || !profile.role) {
      setNotice({ tone: "error", message: "Name, email and account type are required." });
      return;
    }

    if (profile.phone && !isCompletePhoneNumber(profile.phone)) {
      setNotice({ tone: "error", message: "Please select a country code and enter a valid mobile number." });
      return;
    }

    setSavingProfile(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const email = profile.email.trim().toLowerCase();
    const fullName = profile.full_name.trim();
    const phone = profile.phone.trim();
    const role = profile.role;
    const authPayload: {
      email?: string;
      data: {
        full_name: string;
        phone: string;
        role: string;
      };
    } = {
      data: {
        full_name: fullName,
        phone,
        role,
      },
    };

    if (email && email !== user.email) authPayload.email = email;

    const { error: authError } = await supabase.auth.updateUser(authPayload);

    if (authError) {
      setSavingProfile(false);
      setNotice({ tone: "error", message: authError.message });
      return;
    }

    const [{ error: baseError }, { error: crewError }] = await Promise.all([
      saveBaseProfileById(supabase, {
        id: user.id,
        email,
        full_name: fullName,
        phone,
        role,
      }),
      saveCrewProfileByUserId(
        supabase,
        user.id,
        {
          email,
          full_name: fullName,
          phone,
          public_crew_id: user.id.slice(0, 8).toUpperCase(),
        }
      ),
    ]);

    setSavingProfile(false);

    if (baseError || crewError) {
      setNotice({ tone: "error", message: baseError?.message || crewError?.message || "Settings could not be saved." });
      return;
    }

    setOriginalEmail(email);
    setProfile((current) => ({ ...current, email, full_name: fullName, phone, role }));
    setNotice({
      tone: "success",
      message:
        email !== user.email
          ? "Account details saved. Please confirm the new email address from your inbox before using it to login."
          : "Account details saved.",
    });
  }

  async function changePassword() {
    setNotice(null);

    if (!newPassword || !repeatPassword) {
      setNotice({ tone: "error", message: "Enter and repeat your new password." });
      return;
    }

    if (newPassword.length < 6) {
      setNotice({ tone: "error", message: "Password must be at least 6 characters." });
      return;
    }

    if (newPassword !== repeatPassword) {
      setNotice({ tone: "error", message: "Passwords do not match." });
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      setNotice({ tone: "error", message: error.message });
      return;
    }

    setNewPassword("");
    setRepeatPassword("");
    setNotice({ tone: "success", message: "Password changed successfully." });
  }

  useEffect(() => {
    loadSettings();
  }, []);

  if (loading) {
    return (
      <main className="bd-ocean-shell min-h-screen p-8 text-slate-900">
        <div className="bd-ocean-content">Loading settings...</div>
      </main>
    );
  }

  return (
    <main className="bd-ocean-shell min-h-screen px-5 py-8 text-slate-900 sm:px-8 lg:px-10">
      <div className="bd-ocean-content mx-auto max-w-6xl">
        <header className="bd-glass-card-strong overflow-hidden rounded-[34px]">
          <div className="h-1.5 bg-[linear-gradient(90deg,#07111f_0%,#0891b2_34%,#d7b46a_68%,#ef776f_100%)]" />
          <div className="flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="bd-kicker">Account Settings</p>
              <h1 className="bd-serif mt-3 text-5xl font-normal text-[#071f3c] sm:text-6xl">BlueDeck Settings</h1>
              <p className="mt-3 max-w-2xl leading-7 text-slate-600">
                Manage your login details, password, phone number and account security from one clean control room.
              </p>
            </div>
          </div>
        </header>

        {notice && (
          <div
            className={`mt-5 rounded-2xl border px-5 py-4 text-sm font-semibold shadow-sm ${
              notice.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            {notice.message}
          </div>
        )}

        <div className="mt-6">
          <SettingsPanel
            icon={<UserRound className="h-5 w-5" />}
            title="Profile and login"
            description="Update your identity, login details, phone number and password from one clean settings area."
          >
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Profile Details</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    These details appear on your dashboard and account record.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Name and surname"
                    required
                    value={profile.full_name}
                    onChange={(value) => setProfile({ ...profile, full_name: value })}
                    autoComplete="name"
                  />
                  <TextField
                    label="Email"
                    required
                    type="email"
                    value={profile.email}
                    onChange={(value) => setProfile({ ...profile, email: value })}
                    autoComplete="email"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <PhoneInput label="Mobile number" value={profile.phone} onChange={(value) => setProfile({ ...profile, phone: value })} />
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-600">
                      Account type <span className="text-rose-500">*</span>
                    </span>
                    <select
                      value={profile.role}
                      required
                      onChange={(event) => setProfile({ ...profile, role: event.target.value })}
                      className="min-h-[54px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none shadow-sm transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    >
                      {accountTypes.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={saveAccountProfile}
                    disabled={savingProfile}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-slate-900/12 transition hover:bg-cyan-900 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {savingProfile ? "Saving..." : "Save profile details"}
                  </button>
                  {profile.email !== originalEmail && (
                    <span className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                      New email will require inbox confirmation.
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-950/10 bg-[linear-gradient(135deg,#07111f_0%,#0d2231_64%,#10313a_100%)] p-4 text-white shadow-xl shadow-slate-950/10">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-300 text-slate-950">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Password</p>
                    <p className="mt-1 text-sm leading-6 text-white/70">
                      Change your login password without leaving settings.
                    </p>
                  </div>
                </div>
                <DarkTextField
                  label="New password"
                  type="password"
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                />
                <PasswordStrengthMeter strength={passwordStrength} dark />
                <DarkTextField
                  label="Repeat new password"
                  type="password"
                  value={repeatPassword}
                  onChange={setRepeatPassword}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={changePassword}
                  disabled={savingPassword}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-4 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:bg-cyan-200 disabled:opacity-60"
                >
                  <KeyRound className="h-4 w-4" />
                  {savingPassword ? "Changing..." : "Change password"}
                </button>
              </div>
            </div>
          </SettingsPanel>
        </div>
      </div>
    </main>
  );
}

function SettingsPanel({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="bd-glass-card-strong rounded-[30px] p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 text-cyan-700">
          {icon}
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
      <div className="mt-6 space-y-4">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-600">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      <input
        value={value}
        type={type}
        required={required}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[54px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none shadow-sm transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
      />
    </label>
  );
}

function DarkTextField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-white/75">{label}</span>
      <input
        value={value}
        type={type}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[54px] w-full rounded-2xl border border-white/12 bg-white/8 px-4 text-base text-white outline-none shadow-sm transition placeholder:text-white/35 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/10"
      />
    </label>
  );
}

function PasswordStrengthMeter({ strength, dark = false }: { strength: PasswordStrength; dark?: boolean }) {
  if (!strength.visible) return null;

  return (
    <div className={`rounded-2xl border p-3 ${dark ? "border-white/10 bg-white/7" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.12em]">
        <span className={dark ? "text-white/55" : "text-slate-500"}>Password strength</span>
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

function getPasswordStrength(password: string): PasswordStrength {
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
    return { visible: true, score: 1, label: "Weak", barClass: "bg-rose-500", textClass: "text-rose-600" };
  }

  if (checks <= 3) {
    return { visible: true, score: 2, label: "Medium", barClass: "bg-amber-500", textClass: "text-amber-600" };
  }

  return { visible: true, score: 3, label: "Strong", barClass: "bg-emerald-500", textClass: "text-emerald-600" };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRole(value: unknown) {
  const role = cleanText(value).toLowerCase();
  return accountTypes.some((item) => item.value === role) ? role : "";
}

function inferRoleFromPosition(value: unknown) {
  const position = cleanText(value).toLowerCase();
  if (position.includes("captain")) return "captain";
  if (position.includes("owner")) return "owner";
  if (position.includes("management")) return "management";
  return "";
}

function isCompletePhoneNumber(value: string) {
  return /^\+\d{1,5}\s+[\d\s()-]{5,}$/.test(value.trim());
}

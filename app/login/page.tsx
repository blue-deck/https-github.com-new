"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { BlueDeckMark } from "../components/BlueDeckLogo";
import { PublicHeader } from "../components/PublicSiteChrome";
import { PhoneInput } from "../components/PhoneInput";
import { saveBaseProfileById } from "../lib/baseProfiles";
import { saveCrewProfileByUserId } from "../lib/crewProfiles";
import { supabase } from "../lib/supabase";
import { getDefaultPositionForAccountType, positionSelectGroups } from "../lib/yachtOperations";

type AuthMode = "login" | "signup";
const productionSiteUrl = "https://www.bluedeck.app";
const confirmationRedirectUrl = `${productionSiteUrl}/auth/confirm?next=/dashboard`;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [position, setPosition] = useState("");
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [notice, setNotice] = useState("");
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(() => {
    async function redirectIfLoggedIn() {
      const requestedMode = new URLSearchParams(window.location.search).get("mode");
      if (requestedMode === "signup") setMode("signup");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) window.location.href = "/dashboard";
    }

    redirectIfLoggedIn();
  }, []);

  async function createProfiles(userId: string, userEmail: string) {
    await saveBaseProfileById(supabase, {
      id: userId,
      email: userEmail,
      full_name: fullName || userEmail,
      phone,
      role,
    });

    await saveCrewProfileByUserId(
      supabase,
      userId,
      {
        email: userEmail,
        full_name: fullName || userEmail,
        phone,
        current_position: position || getDefaultPositionForAccountType(role) || "Deckhand",
        public_crew_id: userId.slice(0, 8).toUpperCase(),
      }
    );
  }

  async function submit() {
    setNotice("");

    if (!email || !password) {
      setNotice("Please enter your email and password.");
      return;
    }

    if (mode === "signup" && (!fullName.trim() || !phone.trim() || !role || !position)) {
      setNotice("Name, email, password, phone, account type and yacht position are required.");
      return;
    }

    if (mode === "signup" && !isCompletePhoneNumber(phone)) {
      setNotice("Please select a country code and enter a valid mobile number.");
      return;
    }

    if (mode === "signup" && !acceptedPrivacy) {
      setNotice("Please accept the Privacy Policy to create your account.");
      return;
    }

    if (mode === "signup" && password.length < 6) {
      setNotice("Password must be at least 6 characters.");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setNotice("Passwords do not match.");
      return;
    }

    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      setLoading(false);

      if (error) {
        setNotice(error.message);
        return;
      }

      window.location.href = "/dashboard";
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
          phone,
          role,
          position,
        }),
      });

      const result = (await response.json()) as {
        error?: string;
        userId?: string | null;
        needsEmailConfirmation?: boolean;
      };

      if (!response.ok || result.error) {
        setLoading(false);
        setNotice(result.error || "Account could not be created. Please try again.");
        return;
      }

      if (result.userId) await createProfiles(result.userId, email.trim().toLowerCase());

      setLoading(false);

      if (result.needsEmailConfirmation) {
        setNotice("Account created. Please check your email and confirm your BlueDeck account, then login.");
        setMode("login");
        return;
      }

      setNotice("Account created. Please login to continue to My Dashboard.");
      setMode("login");
    } catch {
      setLoading(false);
      setNotice("Create account request failed. Please check your internet connection and try again.");
    }
  }

  async function resendConfirmation() {
    if (!email) {
      setNotice("Enter your email first.");
      return;
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: confirmationRedirectUrl },
    });

    setNotice(error ? error.message : "Confirmation email sent again. Please check your inbox.");
  }

  async function resetPassword() {
    if (!email) {
      setNotice("Enter your email first.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${productionSiteUrl}/login`,
    });

    setNotice(error ? error.message : "Password reset email sent.");
  }

  return (
    <main className="bd-site-shell min-h-screen overflow-hidden pt-[92px] text-slate-900">
      <PublicHeader />

      <div className="bd-ocean-content mx-auto grid min-h-[calc(100vh-92px)] max-w-6xl items-center gap-8 px-5 py-8 lg:grid-cols-[1fr_460px] lg:px-8">
        <section className="hidden lg:block">
          <p className="bd-kicker">BlueDeck YachtOS</p>
          <h1 className="bd-serif mt-5 max-w-3xl text-6xl font-normal leading-tight text-[#071f3c]">
            Secure yacht profiles, documents and crew operations.
          </h1>
          <div className="mt-8 grid max-w-2xl gap-3 text-sm text-slate-700">
            {["Private crew ID and dashboard", "Professional CV and document vault", "Captain invitations, contracts and checklists"].map((item) => (
              <div key={item} className="bd-glass-card flex items-center gap-3 rounded-2xl px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-cyan-700" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="bd-glass-card-strong relative w-full rounded-[30px] p-6 sm:p-8"
        >
          <div className="flex items-center gap-3">
            <BlueDeckMark className="h-14 w-16 rounded-2xl" imageClassName="p-1" />
            <div>
              <p className="font-semibold text-slate-950">BlueDeck</p>
              <p className="text-xs text-slate-500">Secure account access</p>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-xl px-4 py-3 text-sm font-semibold ${mode === "login" ? "bg-cyan-600 text-white" : "text-slate-500"}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-xl px-4 py-3 text-sm font-semibold ${mode === "signup" ? "bg-cyan-600 text-white" : "text-slate-500"}`}
            >
              Create account
            </button>
          </div>

          <h2 className="mt-7 text-3xl font-semibold text-slate-950">
            {mode === "login" ? "Welcome back" : "Create your BlueDeck account"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {mode === "login"
              ? "Login to continue to My Dashboard."
              : "Use your real email and phone. BlueDeck will send a secure confirmation email."}
          </p>

          <div className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <AuthField icon={<UserRound className="h-5 w-5" />} label="Name and surname" required>
                  <input
                    value={fullName}
                    required
                    autoComplete="name"
                    onChange={(event) => setFullName(event.target.value)}
                    className="w-full bg-transparent text-slate-950 outline-none placeholder:text-slate-400"
                    placeholder="Name and surname"
                  />
                </AuthField>
                <PhoneInput label="Mobile number" value={phone} onChange={setPhone} required />
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-500">
                    Account type <span className="text-rose-500">*</span>
                  </span>
                  <select
                    value={role}
                    required
                    onChange={(event) => {
                      const nextRole = event.target.value;
                      setRole(nextRole);
                      setPosition(getDefaultPositionForAccountType(nextRole));
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 outline-none focus:border-cyan-300"
                  >
                    <option value="">Select account type</option>
                    <option value="crew">Crew</option>
                    <option value="captain">Captain</option>
                    <option value="owner">Owner</option>
                    <option value="management">Management</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-500">
                    Yacht position <span className="text-rose-500">*</span>
                  </span>
                  <select
                    value={position}
                    required
                    onChange={(event) => setPosition(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 outline-none focus:border-cyan-300"
                  >
                    <option value="">Select yacht position</option>
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
                </label>
              </>
            )}

            <AuthField icon={<Mail className="h-5 w-5" />} label="Email" required={mode === "signup"}>
              <input
                value={email}
                type="email"
                required
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-transparent text-slate-950 outline-none placeholder:text-slate-400"
                placeholder="you@example.com"
              />
            </AuthField>

            <AuthField icon={<LockKeyhole className="h-5 w-5" />} label="Password" required={mode === "signup"}>
              <input
                value={password}
                type={showPassword ? "text" : "password"}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-transparent text-slate-950 outline-none placeholder:text-slate-400"
                placeholder="Minimum 6 characters"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </AuthField>

            {mode === "signup" && (
              <>
                <PasswordStrengthMeter strength={passwordStrength} />
                <AuthField icon={<LockKeyhole className="h-5 w-5" />} label="Repeat password" required>
                  <input
                    value={confirmPassword}
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full bg-transparent text-slate-950 outline-none placeholder:text-slate-400"
                    placeholder="Enter the same password again"
                  />
                </AuthField>
                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  <input
                    type="checkbox"
                    checked={acceptedPrivacy}
                    required
                    onChange={(event) => setAcceptedPrivacy(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-cyan-600"
                  />
                  <span>
                    I agree to the BlueDeck{" "}
                    <Link href="/privacy" className="font-semibold text-cyan-700">
                      Privacy Policy
                    </Link>
                    . <span className="text-rose-500">*</span>
                  </span>
                </label>
              </>
            )}

            {notice && (
              <div className="rounded-2xl border border-cyan-300/30 bg-cyan-50 p-4 text-sm leading-6 text-slate-700">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-cyan-600 px-5 py-4 font-bold text-white transition hover:bg-cyan-700 disabled:opacity-60"
            >
              {loading ? "Please wait..." : mode === "login" ? "Login to My Dashboard" : "Create secure account"}
            </button>

            <div className="flex flex-wrap justify-between gap-3 text-sm">
              <button type="button" onClick={resetPassword} className="font-semibold text-cyan-700">
                Forgot password?
              </button>
              <button type="button" onClick={resendConfirmation} className="font-semibold text-slate-600">
                Resend confirmation email
              </button>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
              BlueDeck protects new accounts with email confirmation. If the email does not arrive, check spam or resend the confirmation email.
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

function AuthField({ label, icon, children, required = false }: { label: string; icon: ReactNode; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-500">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      <span className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-cyan-700 focus-within:border-cyan-300">
        {icon}
        {children}
      </span>
    </label>
  );
}

function PasswordStrengthMeter({ strength }: { strength: PasswordStrength }) {
  if (!strength.visible) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.12em]">
        <span className="text-slate-500">Password strength</span>
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

function isCompletePhoneNumber(value: string) {
  return /^\+\d{1,5}\s+[\d\s()-]{5,}$/.test(value.trim());
}

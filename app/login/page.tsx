"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, Phone, ShieldCheck, Ship, UserRound } from "lucide-react";
import { blueDeckCountries } from "../lib/countries";
import { supabase } from "../lib/supabase";

type AuthMode = "login" | "signup";
const productionSiteUrl = "https://bluedeck.app";
const confirmationRedirectUrl = `${productionSiteUrl}/auth/confirm?next=/dashboard`;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("crew");
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function redirectIfLoggedIn() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) window.location.href = "/dashboard";
    }

    redirectIfLoggedIn();
  }, []);

  async function createProfiles(userId: string, userEmail: string) {
    await supabase.from("profiles").upsert({
      id: userId,
      email: userEmail,
      full_name: fullName || userEmail,
      phone,
      role,
    });

    await supabase.from("crew_profiles").upsert(
      {
        user_id: userId,
        email: userEmail,
        full_name: fullName || userEmail,
        phone,
        current_position: role === "captain" ? "Captain" : "Crew",
        public_crew_id: userId.slice(0, 8).toUpperCase(),
      },
      { onConflict: "user_id" }
    );
  }

  async function submit() {
    setNotice("");

    if (!email || !password) {
      setNotice("Please enter your email and password.");
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
          fullName,
          phone,
          role,
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
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#fbf7ef_0%,#eef7f8_48%,#f7efe0_100%)] text-slate-900">
      <Image
        src="/bluedeck-hero.png"
        alt="Luxury yacht bridge"
        fill
        priority
        className="object-cover opacity-20"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.96),rgba(238,247,248,0.86),rgba(255,255,255,0.96))]" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-5 py-8 lg:grid-cols-[1fr_460px] lg:px-8">
        <section className="hidden lg:block">
          <p className="bd-kicker">BlueDeck YachtOS</p>
          <h1 className="mt-5 max-w-3xl text-6xl font-semibold leading-tight text-slate-950">
            Secure yacht profiles, documents and crew operations.
          </h1>
          <div className="mt-8 grid max-w-2xl gap-3 text-sm text-slate-700">
            {["Private crew ID and dashboard", "Professional CV and document vault", "Captain invitations, contracts and checklists"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
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
          className="relative w-full rounded-3xl border border-white/70 bg-white/88 p-6 shadow-2xl shadow-cyan-950/12 backdrop-blur-xl sm:p-8"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-100 text-cyan-700">
              <Ship className="h-6 w-6" />
            </div>
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
                <AuthField icon={<UserRound className="h-5 w-5" />} label="Full name">
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="w-full bg-transparent text-slate-950 outline-none placeholder:text-slate-400"
                    placeholder="Name and surname"
                  />
                </AuthField>
                <SignupPhoneField value={phone} onChange={setPhone} />
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-500">Account type</span>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 outline-none focus:border-cyan-300"
                  >
                    <option value="crew">Crew</option>
                    <option value="captain">Captain</option>
                    <option value="owner">Owner</option>
                    <option value="management">Management</option>
                  </select>
                </label>
              </>
            )}

            <AuthField icon={<Mail className="h-5 w-5" />} label="Email">
              <input
                value={email}
                type="email"
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-transparent text-slate-950 outline-none placeholder:text-slate-400"
                placeholder="you@example.com"
              />
            </AuthField>

            <AuthField icon={<LockKeyhole className="h-5 w-5" />} label="Password">
              <input
                value={password}
                type={showPassword ? "text" : "password"}
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
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                <input
                  type="checkbox"
                  checked={acceptedPrivacy}
                  onChange={(event) => setAcceptedPrivacy(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-cyan-600"
                />
                <span>
                  I agree to the BlueDeck{" "}
                  <Link href="/privacy" className="font-semibold text-cyan-700">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
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

function AuthField({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-500">{label}</span>
      <span className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-cyan-700 focus-within:border-cyan-300">
        {icon}
        {children}
      </span>
    </label>
  );
}

function SignupPhoneField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const currentCountry = blueDeckCountries.find((country) => value.startsWith(`${country.dial} `)) || blueDeckCountries.find((country) => country.country === "Turkey") || blueDeckCountries[0];
  const localNumber = value.replace(`${currentCountry.dial} `, "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const preferredCountries = blueDeckCountries.filter((country) => {
    return country.country === "Turkey" || country.region === "Europe" || ["United States", "Russia", "United Arab Emirates", "Israel"].includes(country.country);
  });
  const filteredCountries = (query.trim() ? blueDeckCountries : preferredCountries)
    .filter((country) => `${country.country} ${country.nationality} ${country.dial}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, query.trim() ? 80 : 60);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="block" ref={wrapperRef}>
      <span className="mb-2 block text-sm text-slate-500">Phone</span>
      <div className="flex rounded-2xl border border-slate-200 bg-white focus-within:border-cyan-300">
        <div className="relative w-[126px] shrink-0">
          <button
            type="button"
            onClick={() => {
              setOpen(!open);
              setQuery("");
            }}
            className="flex h-full w-full items-center justify-between gap-2 rounded-l-2xl border-r border-slate-200 px-4 py-4 text-left text-sm font-semibold text-slate-950"
          >
            <span className="truncate">{currentCountry.flag} {currentCountry.code} {currentCountry.dial}</span>
            <span className="text-cyan-700">⌄</span>
          </button>
          {open && (
            <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[min(420px,92vw)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-cyan-950/15">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search country..."
                className="w-full border-b border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none"
              />
              <div className="max-h-72 overflow-auto p-2">
                {filteredCountries.map((country) => (
                  <button
                    key={`${country.country}-${country.dial}`}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onChange(`${country.dial} ${localNumber}`.trim());
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-cyan-50"
                  >
                    <span className="truncate">{country.flag} {country.country}</span>
                    <span className="shrink-0 font-semibold text-cyan-700">{country.dial}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <span className="flex items-center pl-3 text-cyan-700">
          <Phone className="h-5 w-5" />
        </span>
        <input
          value={localNumber}
          onChange={(event) => onChange(`${currentCountry.dial} ${event.target.value}`.trim())}
          className="min-w-0 flex-1 rounded-r-2xl bg-transparent px-3 py-4 text-slate-950 outline-none placeholder:text-slate-400"
          placeholder="Phone number"
        />
      </div>
    </div>
  );
}

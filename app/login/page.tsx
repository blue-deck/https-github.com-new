"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, Phone, ShieldCheck, Ship, UserRound } from "lucide-react";
import { blueDeckCountries } from "../lib/countries";
import { supabase } from "../lib/supabase";

type AuthMode = "login" | "signup";
const productionSiteUrl = "https://www.bluedeck.app";

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
        setNotice("Account created. Please check your email inbox and confirm your BlueDeck account, then login.");
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
      options: { emailRedirectTo: `${productionSiteUrl}/dashboard` },
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
    <main className="relative min-h-screen overflow-hidden bg-[#020817] text-[#eef7ff]">
      <Image
        src="/bluedeck-hero.png"
        alt="Luxury yacht bridge"
        fill
        priority
        className="object-cover opacity-35"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,9,20,0.97),rgba(5,9,20,0.82),rgba(5,9,20,0.95))]" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-5 py-8 lg:grid-cols-[1fr_460px] lg:px-8">
        <section className="hidden lg:block">
          <p className="bd-kicker">BlueDeck YachtOS</p>
          <h1 className="mt-5 max-w-3xl text-6xl font-semibold leading-tight text-white">
            Secure yacht profiles, documents and crew operations.
          </h1>
          <div className="mt-8 grid max-w-2xl gap-3 text-sm text-[#d8deea]">
            {["Private crew ID and dashboard", "Professional CV and document vault", "Captain invitations, contracts and checklists"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 backdrop-blur">
                <CheckCircle2 className="h-5 w-5 text-cyan-300" />
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
          className="relative w-full rounded-3xl border border-white/10 bg-[#08111f]/88 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
              <Ship className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-white">BlueDeck</p>
              <p className="text-xs text-[#aeb8c8]">Secure account access</p>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 rounded-2xl border border-white/10 bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-xl px-4 py-3 text-sm font-semibold ${mode === "login" ? "bg-cyan-300 text-[#020817]" : "text-slate-300"}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-xl px-4 py-3 text-sm font-semibold ${mode === "signup" ? "bg-cyan-300 text-[#020817]" : "text-slate-300"}`}
            >
              Create account
            </button>
          </div>

          <h2 className="mt-7 text-3xl font-semibold text-white">
            {mode === "login" ? "Welcome back" : "Create your BlueDeck account"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#aeb8c8]">
            {mode === "login"
              ? "Login to continue to My Dashboard."
              : "Use your real email and phone. Email confirmation is handled by Supabase when enabled in your project."}
          </p>

          <div className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <AuthField icon={<UserRound className="h-5 w-5" />} label="Full name">
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="w-full bg-transparent text-white outline-none placeholder:text-[#6f7b8e]"
                    placeholder="Name and surname"
                  />
                </AuthField>
                <SignupPhoneField value={phone} onChange={setPhone} />
                <label className="block">
                  <span className="mb-2 block text-sm text-[#aeb8c8]">Account type</span>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-white outline-none"
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
                className="w-full bg-transparent text-white outline-none placeholder:text-[#6f7b8e]"
                placeholder="you@example.com"
              />
            </AuthField>

            <AuthField icon={<LockKeyhole className="h-5 w-5" />} label="Password">
              <input
                value={password}
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-transparent text-white outline-none placeholder:text-[#6f7b8e]"
                placeholder="Minimum 6 characters"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </AuthField>

            {mode === "signup" && (
              <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-300">
                <input
                  type="checkbox"
                  checked={acceptedPrivacy}
                  onChange={(event) => setAcceptedPrivacy(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-cyan-300"
                />
                <span>
                  I agree to the BlueDeck{" "}
                  <Link href="/privacy" className="font-semibold text-cyan-200">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
            )}

            {notice && (
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-cyan-300 px-5 py-4 font-bold text-[#020817] transition hover:bg-white disabled:opacity-60"
            >
              {loading ? "Please wait..." : mode === "login" ? "Login to My Dashboard" : "Create secure account"}
            </button>

            <div className="flex flex-wrap justify-between gap-3 text-sm">
              <button type="button" onClick={resetPassword} className="font-semibold text-cyan-200">
                Forgot password?
              </button>
              <button type="button" onClick={resendConfirmation} className="font-semibold text-slate-300">
                Resend confirmation email
              </button>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-xs leading-5 text-slate-400">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
              Email confirmation emails are sent by Supabase when email confirmations are enabled in the Supabase Auth settings. SMS login requires a configured SMS provider in Supabase.
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
      <span className="mb-2 block text-sm text-[#aeb8c8]">{label}</span>
      <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-cyan-200 focus-within:border-cyan-300/60">
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
      <span className="mb-2 block text-sm text-[#aeb8c8]">Phone</span>
      <div className="flex rounded-2xl border border-white/10 bg-black/25 focus-within:border-cyan-300/60">
        <div className="relative w-[126px] shrink-0">
          <button
            type="button"
            onClick={() => {
              setOpen(!open);
              setQuery("");
            }}
            className="flex h-full w-full items-center justify-between gap-2 rounded-l-2xl border-r border-white/10 px-4 py-4 text-left text-sm font-semibold text-white"
          >
            <span className="truncate">{currentCountry.flag} {currentCountry.code} {currentCountry.dial}</span>
            <span className="text-cyan-200">⌄</span>
          </button>
          {open && (
            <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[min(420px,92vw)] overflow-hidden rounded-2xl border border-white/10 bg-[#071426] shadow-2xl">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search country..."
                className="w-full border-b border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
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
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-100 hover:bg-cyan-400/10"
                  >
                    <span className="truncate">{country.flag} {country.country}</span>
                    <span className="shrink-0 font-semibold text-cyan-200">{country.dial}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <span className="flex items-center pl-3 text-cyan-200">
          <Phone className="h-5 w-5" />
        </span>
        <input
          value={localNumber}
          onChange={(event) => onChange(`${currentCountry.dial} ${event.target.value}`.trim())}
          className="min-w-0 flex-1 rounded-r-2xl bg-transparent px-3 py-4 text-white outline-none placeholder:text-[#6f7b8e]"
          placeholder="Phone number"
        />
      </div>
    </div>
  );
}

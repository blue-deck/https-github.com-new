"use client";

import Image from "next/image";
import { useState } from "react";
import { LockKeyhole, Mail, Ship } from "lucide-react";
import { blueDeckCountries } from "../lib/countries";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("crew");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email || !password) {
      alert("Email and password required.");
      return;
    }

    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoading(false);
        alert(error.message);
        return;
      }

      window.location.href = "/dashboard";
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          role,
        },
      },
    });

    if (error) {
      setLoading(false);
      alert(error.message);
      return;
    }

    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email,
        full_name: fullName || email,
        phone,
        role,
      });

      await supabase.from("crew_profiles").upsert(
        {
          user_id: data.user.id,
          email,
          full_name: fullName || email,
          phone,
          current_position: role === "captain" ? "Captain" : "Crew",
          public_crew_id: data.user.id.slice(0, 8).toUpperCase(),
        },
        { onConflict: "user_id" }
      );
    }

    setLoading(false);
    alert("Account created. Please check your email if confirmation is enabled, then login.");
    setMode("login");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020817] p-5 text-[#eef7ff]">
      <Image
        src="/bluedeck-hero.png"
        alt="Luxury yacht bridge"
        fill
        priority
        className="object-cover opacity-35"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,9,20,0.96),rgba(5,9,20,0.72),rgba(5,9,20,0.96))]" />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="bd-panel relative w-full max-w-md rounded-3xl p-6 sm:p-8"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#22d3ee]/35 bg-[#22d3ee]/15 text-[#22d3ee]">
            <Ship className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#22d3ee]">BlueDeck</p>
            <p className="text-xs text-[#aeb8c8]">Secure yacht account</p>
          </div>
        </div>

        <h1 className="mt-8 text-4xl font-semibold text-white">
          {mode === "login" ? "Login" : "Create Account"}
        </h1>
        <p className="mt-3 leading-7 text-[#aeb8c8]">
          Use your own email and password. Every user gets a private BlueDeck
          profile, crew ID and personal document portal.
        </p>

        <div className="mt-8 space-y-4">
          {mode === "signup" && (
            <>
              <label className="block">
                <span className="mb-2 block text-sm text-[#aeb8c8]">Full name</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bd-focus w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-white"
                />
              </label>

              <SignupPhoneField value={phone} onChange={setPhone} />

              <label className="block">
                <span className="mb-2 block text-sm text-[#aeb8c8]">Account type</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="bd-focus w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-white"
                >
                  <option value="crew">Crew</option>
                  <option value="captain">Captain</option>
                  <option value="owner">Owner</option>
                  <option value="management">Management</option>
                </select>
              </label>
            </>
          )}

          <label className="block">
            <span className="mb-2 block text-sm text-[#aeb8c8]">Email</span>
            <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-4">
              <Mail className="h-5 w-5 text-[#22d3ee]" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bd-focus w-full bg-transparent text-white placeholder:text-[#6f7b8e]"
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-[#aeb8c8]">Password</span>
            <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-4">
              <LockKeyhole className="h-5 w-5 text-[#22d3ee]" />
              <input
                value={password}
                type="password"
                onChange={(e) => setPassword(e.target.value)}
                className="bd-focus w-full bg-transparent text-white placeholder:text-[#6f7b8e]"
              />
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="bd-focus w-full rounded-full bg-[#22d3ee] px-5 py-4 font-bold text-[#020817] transition hover:bg-[#eef7ff]"
          >
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
          </button>

          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="bd-focus w-full rounded-full py-2 text-sm font-semibold text-cyan-200"
          >
            {mode === "login" ? "Create a new account" : "I already have an account"}
          </button>
        </div>
      </form>
    </main>
  );
}

function SignupPhoneField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
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

  return (
    <div className="block">
      <span className="mb-2 block text-sm text-[#aeb8c8]">Phone</span>
      <div className="grid gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setOpen(!open);
              setQuery("");
            }}
            className="flex w-full items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-left text-sm font-semibold text-white"
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
        <input
          value={localNumber}
          onChange={(event) => onChange(`${currentCountry.dial} ${event.target.value}`.trim())}
          className="bd-focus w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-white"
          placeholder="Phone number"
        />
      </div>
    </div>
  );
}

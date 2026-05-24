"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("crew");
  const [loading, setLoading] = useState(false);

  async function createOrUpdateProfile(userId: string, userEmail: string) {
    await supabase.from("profiles").upsert({
      id: userId,
      email: userEmail,
      full_name: fullName || userEmail,
      role,
    });
  }

  async function handleAuth() {
    if (!email || !password) {
      alert("Email and password are required");
      return;
    }

    setLoading(true);

    if (isLogin) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoading(false);
        alert(error.message);
        return;
      }

      if (data.user) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();

        if (!existingProfile) {
          await supabase.from("profiles").insert({
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.email,
            role: "crew",
          });
        }
      }

      window.location.href = "/dashboard";
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      alert(error.message);
      return;
    }

    if (data.user) {
      await createOrUpdateProfile(data.user.id, email);
    }

    alert("Account created. You can now login.");
    setIsLogin(true);
    setLoading(false);
  }

  return (
    <main className="bd-shell flex min-h-screen items-center justify-center p-5 text-[#eef7ff] sm:p-8">
      <div className="bd-panel w-full max-w-xl rounded-3xl p-7 sm:p-10">
        <p className="bd-kicker text-center">BlueDeck Authentication</p>

        <h1 className="mt-4 text-center text-4xl font-semibold text-white sm:text-5xl">
          {isLogin ? "Login" : "Create Account"}
        </h1>

        <div className="mt-10 space-y-4">
          {!isLogin && (
            <>
              <input
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bd-focus w-full rounded-2xl border border-white/10 bg-black/20 p-5 text-white placeholder:text-[#6f7b8e]"
              />

              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="bd-focus w-full rounded-2xl border border-white/10 bg-black/20 p-5 text-white"
              >
                <option value="crew">Crew</option>
                <option value="captain">Captain</option>
                <option value="management">Management</option>
                <option value="owner">Owner</option>
              </select>
            </>
          )}

          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bd-focus w-full rounded-2xl border border-white/10 bg-black/20 p-5 text-white placeholder:text-[#6f7b8e]"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bd-focus w-full rounded-2xl border border-white/10 bg-black/20 p-5 text-white placeholder:text-[#6f7b8e]"
          />

          <button
            onClick={handleAuth}
            disabled={loading}
            className="bd-focus w-full rounded-full bg-[#22d3ee] p-5 text-lg font-bold text-[#020817] transition hover:bg-[#eef7ff] disabled:opacity-50"
          >
            {loading ? "Please wait..." : isLogin ? "Login" : "Create Account"}
          </button>
        </div>

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="bd-focus mt-8 w-full rounded-full text-[#22d3ee]"
        >
          {isLogin ? "Create new account" : "Already have an account?"}
        </button>
      </div>
    </main>
  );
}

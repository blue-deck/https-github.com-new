"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ship } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("captain@bluedeck.app");
  const [password, setPassword] = useState("123456");

  function login() {
    if (!email || !password) {
      alert("Email and password required.");
      return;
    }

    localStorage.setItem(
      "bluedeck_user",
      JSON.stringify({
        email,
        role: "captain",
        yachtId: "f434e90f-b8d8-443c-ad23-d5cedbe4308f",
      })
    );

    router.push("/yachts/f434e90f-b8d8-443c-ad23-d5cedbe4308f");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#020817] p-6 text-white">
      <div className="w-full max-w-lg rounded-[40px] border border-white/10 bg-white/5 p-10">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400 text-black">
          <Ship className="h-9 w-9" />
        </div>

        <p className="mt-8 text-cyan-300">BlueDeck YachtOS</p>
        <h1 className="mt-3 text-6xl font-black">Login</h1>

        <div className="mt-8 space-y-4">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl bg-white/10 p-5 outline-none"
          />

          <input
            value={password}
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl bg-white/10 p-5 outline-none"
          />

          <button
            onClick={login}
            className="w-full rounded-2xl bg-cyan-400 py-5 text-lg font-black text-black"
          >
            Enter BlueDeck
          </button>
        </div>
      </div>
    </main>
  );
}
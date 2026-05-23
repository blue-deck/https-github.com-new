"use client";

import Link from "next/link";
import { Ship } from "lucide-react";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#020817] p-6 text-white">
      <div className="w-full max-w-lg rounded-[40px] border border-white/10 bg-white/5 p-10">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400 text-black">
          <Ship className="h-9 w-9" />
        </div>

        <p className="mt-8 text-cyan-300">BlueDeck YachtOS</p>
        <h1 className="mt-3 text-6xl font-black">Account Setup</h1>

        <p className="mt-6 text-lg text-gray-400">
          Secure account registration will be enabled in production.
          For now, continue with local captain access.
        </p>

        <Link
          href="/login"
          className="mt-8 block rounded-2xl bg-cyan-400 py-5 text-center text-lg font-black text-black"
        >
          Go to Login
        </Link>
      </div>
    </main>
  );
}
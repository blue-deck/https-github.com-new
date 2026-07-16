"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function JobsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[jobs] Page render failed", {
      digest: error.digest,
    });
  }, [error]);

  return (
    <section className="mx-auto flex min-h-[65vh] max-w-[1500px] items-center justify-center px-5 py-16 sm:px-8 lg:px-12">
      <div className="max-w-xl rounded-3xl border border-rose-900/10 bg-white p-8 text-center shadow-[0_24px_80px_rgba(7,31,60,0.09)] sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-black text-[#071f3c]">
          We could not load the jobs board
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#657991]">
          Please try again. If the issue continues, return to BlueDeck and come
          back shortly.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#07182d] px-5 text-xs font-black uppercase tracking-[0.15em] text-white transition hover:-translate-y-0.5 hover:bg-[#0b2949]"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#b8c6d5] bg-white px-5 text-xs font-black uppercase tracking-[0.15em] text-[#071f3c] transition hover:border-[#7890a8]"
          >
            BlueDeck home
          </Link>
        </div>
      </div>
    </section>
  );
}

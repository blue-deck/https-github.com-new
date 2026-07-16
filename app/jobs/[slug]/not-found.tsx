import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function JobNotFound() {
  return (
    <section className="mx-auto flex min-h-[65vh] max-w-[1500px] items-center justify-center px-5 py-16 sm:px-8 lg:px-12">
      <div className="max-w-xl rounded-3xl border border-[#071f3c]/10 bg-white p-8 text-center shadow-[0_24px_80px_rgba(7,31,60,0.09)] sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-800">
          <SearchX className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-black text-[#071f3c]">
          This role is no longer available
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#657991]">
          It may have closed, expired or moved out of public view. Browse the
          board for current published opportunities.
        </p>
        <Link
          href="/jobs"
          className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#07182d] px-5 text-xs font-black uppercase tracking-[0.15em] text-white transition hover:-translate-y-0.5 hover:bg-[#0b2949]"
        >
          <ArrowLeft className="h-4 w-4" />
          View current roles
        </Link>
      </div>
    </section>
  );
}

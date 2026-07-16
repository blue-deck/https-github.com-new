import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Ship } from "lucide-react";

export function JobsHero({ total }: { total: number }) {
  return (
    <section className="relative overflow-hidden border-b border-[#071f3c]/10 bg-[#06172b] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_14%,rgba(34,211,238,0.19),transparent_28rem),radial-gradient(circle_at_12%_92%,rgba(15,121,236,0.18),transparent_30rem)]" />
      <div className="relative mx-auto grid max-w-[1500px] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-12 lg:py-24">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-100">
            <Ship className="h-4 w-4" />
            BlueDeck Yacht Careers
          </div>
          <h1 className="bd-serif mt-7 text-5xl leading-[0.98] sm:text-6xl lg:text-7xl">
            Your next role at sea starts here.
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
            Explore published yacht opportunities by position, department,
            contract type and location — in one focused professional board.
          </p>
        </div>

        <div className="flex flex-col items-start gap-4 lg:items-end">
          {total > 0 ? (
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-white">
              <BriefcaseBusiness className="h-4 w-4 text-cyan-200" />
              {total.toLocaleString("en-GB")} published{" "}
              {total === 1 ? "role" : "roles"}
            </p>
          ) : null}
          <Link
            href="/hire-crew"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/25 bg-white px-5 text-xs font-black uppercase tracking-[0.16em] text-[#07182d] transition hover:-translate-y-0.5 hover:bg-cyan-50"
          >
            Hire yacht crew
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

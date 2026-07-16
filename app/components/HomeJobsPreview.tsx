"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  MapPin,
  Ship,
} from "lucide-react";

type HomeJob = {
  id: string;
  slug: string;
  title: string;
  position?: string | null;
  department?: string | null;
  employmentType?: string | null;
  location?: string | null;
  yachtLengthMetres?: number | null;
  yachtType?: string | null;
  startDate?: string | null;
  employer?: {
    name?: string | null;
    verified?: boolean;
  } | null;
  featured?: boolean;
};

function cleanLabel(value?: string | null) {
  return (value || "").replace(/[_-]+/g, " ").trim();
}

function formatDate(value?: string | null) {
  if (!value) return "Flexible start";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Flexible start";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function HomeJobsPreview() {
  const [jobs, setJobs] = useState<HomeJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadJobs() {
      try {
        const response = await fetch("/api/jobs?limit=3", {
          headers: { Accept: "application/json" },
        });
        const payload = (await response.json()) as {
          jobs?: HomeJob[];
          data?: HomeJob[];
          meta?: {
            available?: boolean;
          };
        };

        if (!active) return;
        setAvailable(response.ok && payload.meta?.available !== false);
        setJobs(Array.isArray(payload.jobs) ? payload.jobs : Array.isArray(payload.data) ? payload.data : []);
      } catch {
        if (active) {
          setAvailable(false);
          setJobs([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadJobs();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3" aria-label="Loading yacht jobs">
        {[0, 1, 2].map((item) => (
          <div key={item} className="bd-job-preview-card min-h-64 animate-pulse" aria-hidden>
            <div className="h-3 w-28 rounded-full bg-slate-200" />
            <div className="mt-8 h-8 w-3/4 rounded-xl bg-slate-200" />
            <div className="mt-4 h-4 w-1/2 rounded-full bg-slate-100" />
            <div className="mt-14 h-12 rounded-2xl bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  if (!available) {
    return (
      <div className="bd-jobs-empty-state">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#071631] text-cyan-200">
          <BriefcaseBusiness className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <h3 className="text-2xl font-extrabold tracking-[-0.03em] text-[#071f3c]">
            Live yacht roles are temporarily unavailable.
          </h3>
          <p className="mt-2 max-w-2xl leading-7 text-[#5b7088]">
            We could not refresh the latest opportunities just now. Your account
            and application information remain unchanged; please try the full job
            board again shortly.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 lg:ml-auto">
          <Link href="/for-crew" className="bd-secondary-cta">
            Explore crew resources
          </Link>
          <Link href="/jobs" className="bd-primary-cta">
            Try job board
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (!jobs.length) {
    return (
      <div className="bd-jobs-empty-state">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#071631] text-cyan-200">
          <BriefcaseBusiness className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <h3 className="text-2xl font-extrabold tracking-[-0.03em] text-[#071f3c]">
            The BlueDeck job board is ready for its first verified roles.
          </h3>
          <p className="mt-2 max-w-2xl leading-7 text-[#5b7088]">
            No placeholder vacancies are shown. Published opportunities will appear here automatically
            with their real vessel, contract, location and application details.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 lg:ml-auto">
          <Link href="/jobs" className="bd-secondary-cta">
            Open job board
          </Link>
          <Link href="/hiring" className="bd-primary-cta">
            Post the first role
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {jobs.map((job) => {
        const employer = job.employer?.name || "Confidential yacht employer";
        const title = job.title || job.position || "Yacht position";

        return (
          <Link
            key={job.id}
            href={`/jobs/${encodeURIComponent(job.slug)}`}
            className="bd-job-preview-card group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf7fb] text-[#0e7490]">
                <Ship className="h-6 w-6" />
              </div>
              {job.featured ? (
                <span className="rounded-full border border-[#c99a56]/35 bg-[#fff9ef] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#8b642a]">
                  Featured
                </span>
              ) : null}
            </div>

            <p data-i18n-ignore className="mt-6 break-words text-xs font-black uppercase tracking-[0.16em] text-[#0e7490] [overflow-wrap:anywhere]">
              {employer}
            </p>
            <h3 data-i18n-ignore className="mt-2 break-words text-2xl font-extrabold tracking-[-0.035em] text-[#071f3c] [overflow-wrap:anywhere]">
              {title}
            </h3>

            <div className="mt-5 grid gap-2 text-sm font-semibold text-[#5b7088]">
              <span className="flex min-w-0 items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0e7490]" />
                <span data-i18n-ignore className="min-w-0 break-words [overflow-wrap:anywhere]">
                  {job.location || "Location discussed privately"}
                </span>
              </span>
              <span className="flex min-w-0 items-start gap-2">
                <BriefcaseBusiness className="mt-0.5 h-4 w-4 shrink-0 text-[#0e7490]" />
                <span data-i18n-ignore className="min-w-0 break-words [overflow-wrap:anywhere]">
                  {[cleanLabel(job.employmentType), cleanLabel(job.department)]
                    .filter(Boolean)
                    .join(" · ") || "Yacht employment"}
                </span>
              </span>
              <span className="flex min-w-0 items-start gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#0e7490]" />
                <span data-i18n-ignore>{formatDate(job.startDate)}</span>
              </span>
            </div>

            <div className="mt-7 flex min-w-0 items-center justify-between gap-3 border-t border-[#0d254f]/10 pt-5">
              <span data-i18n-ignore className="min-w-0 break-words text-xs font-bold text-[#718398] [overflow-wrap:anywhere]">
                {job.yachtLengthMetres
                  ? `${job.yachtLengthMetres}m ${cleanLabel(job.yachtType) || "yacht"}`
                  : cleanLabel(job.yachtType) || "Professional yacht role"}
              </span>
              <span className="inline-flex shrink-0 items-center gap-2 text-sm font-black text-[#071f3c]">
                View role
                <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

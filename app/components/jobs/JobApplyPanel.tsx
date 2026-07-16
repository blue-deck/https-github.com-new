"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  FileUser,
  LoaderCircle,
  LogIn,
  Send,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";

type ApplyPhase =
  | "loading"
  | "guest"
  | "unavailable"
  | "no-profile"
  | "incomplete"
  | "ready"
  | "submitted"
  | "error";

type CandidateProfile = {
  id: string;
  fullName: string;
  currentPosition: string;
  location: string;
  ready: boolean;
  missingFields: string[];
};

type ApplicationSummary = {
  id: string;
  status: string;
  submittedAt: string | null;
};

type ApplyApiResponse = {
  data?: {
    profile?: CandidateProfile | null;
    application?: ApplicationSummary | null;
  } | null;
  meta?: { available?: boolean };
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
};

const COVER_NOTE_MINIMUM_LENGTH = 40;
const COVER_NOTE_MAXIMUM_LENGTH = 2_000;

export function JobApplyPanel({
  jobId,
  jobSlug,
  jobTitle,
}: {
  jobId: string;
  jobSlug: string;
  jobTitle: string;
}) {
  const [phase, setPhase] = useState<ApplyPhase>("loading");
  const [accessToken, setAccessToken] = useState("");
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [application, setApplication] =
    useState<ApplicationSummary | null>(null);
  const [coverNote, setCoverNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadApplicationReadiness() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      if (!session) {
        setPhase("guest");
        return;
      }

      setAccessToken(session.access_token);

      try {
        const response = await fetch(`/api/jobs/${jobId}/apply`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });
        const payload = (await response.json()) as ApplyApiResponse;
        if (!active) return;

        if (response.status === 401) {
          setPhase("guest");
          return;
        }
        if (
          response.status === 503 ||
          payload.meta?.available === false
        ) {
          setPhase("unavailable");
          return;
        }
        if (!response.ok) {
          setNotice(
            payload.error?.message ||
              "Application readiness could not be checked.",
          );
          setPhase("error");
          return;
        }

        const nextProfile = payload.data?.profile || null;
        const nextApplication = payload.data?.application || null;
        setProfile(nextProfile);
        setApplication(nextApplication);

        if (nextApplication) {
          setPhase("submitted");
        } else if (!nextProfile) {
          setPhase("no-profile");
        } else if (!nextProfile.ready) {
          setPhase("incomplete");
        } else {
          setPhase("ready");
        }
      } catch {
        if (!active) return;
        setNotice("Application readiness could not be checked.");
        setPhase("error");
      }
    }

    void loadApplicationReadiness();
    return () => {
      active = false;
    };
  }, [jobId]);

  async function submitApplication(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const cleanNote = coverNote.trim();

    if (
      cleanNote.length < COVER_NOTE_MINIMUM_LENGTH ||
      cleanNote.length > COVER_NOTE_MAXIMUM_LENGTH
    ) {
      setNotice(
        `Write a cover note between ${COVER_NOTE_MINIMUM_LENGTH} and ${COVER_NOTE_MAXIMUM_LENGTH} characters.`,
      );
      return;
    }
    if (!consent) {
      setNotice("Confirm profile sharing before submitting.");
      return;
    }

    setSubmitting(true);
    setNotice("");

    try {
      let token = accessToken;
      if (!token) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        token = session?.access_token || "";
      }

      if (!token) {
        setPhase("guest");
        return;
      }

      const response = await fetch(`/api/jobs/${jobId}/apply`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          coverNote: cleanNote,
          consentToShareProfile: true,
        }),
      });
      const payload = (await response.json()) as ApplyApiResponse;

      if (response.status === 401) {
        setPhase("guest");
        return;
      }
      if (response.status === 503) {
        setPhase("unavailable");
        return;
      }
      if (
        response.status === 409 &&
        payload.error?.code === "ALREADY_APPLIED"
      ) {
        setApplication(payload.data?.application || null);
        setPhase("submitted");
        return;
      }
      if (
        response.status === 422 &&
        payload.error?.code === "PROFILE_NOT_READY"
      ) {
        const nextProfile = payload.data?.profile || null;
        setProfile(nextProfile);
        setNotice(payload.error.message || "");
        setPhase(nextProfile ? "incomplete" : "no-profile");
        return;
      }
      if (!response.ok) {
        setNotice(
          payload.error?.message ||
            "Your application could not be submitted.",
        );
        return;
      }

      setApplication(payload.data?.application || null);
      setCoverNote("");
      setConsent(false);
      setPhase("submitted");
    } catch {
      setNotice(
        "Your application could not be submitted. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "loading") {
    return (
      <PanelFrame>
        <LoaderCircle className="h-6 w-6 animate-spin text-cyan-200" />
        <h2 className="mt-4 text-2xl font-black">Checking your profile…</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Preparing a secure application for this role.
        </p>
      </PanelFrame>
    );
  }

  if (phase === "guest") {
    const returnPath = `/jobs/${jobSlug}`;
    return (
      <PanelFrame>
        <LogIn className="h-6 w-6 text-cyan-200" />
        <h2 className="mt-4 text-2xl font-black">
          Sign in to apply
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Applications are connected to your private BlueDeck crew profile.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(returnPath)}`}
          className={primaryActionClassName}
        >
          Sign in
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href={`/login?mode=signup&next=${encodeURIComponent(returnPath)}`}
          className={secondaryActionClassName}
        >
          Create an account
        </Link>
      </PanelFrame>
    );
  }

  if (phase === "unavailable") {
    return (
      <PanelFrame>
        <BriefcaseBusiness className="h-6 w-6 text-cyan-200" />
        <h2 className="mt-4 text-2xl font-black">
          Applications open soon
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          This role is visible, but the protected application service is
          still being prepared. No application data has been created.
        </p>
        <Link href="/applications" className={secondaryActionClassName}>
          My applications
        </Link>
      </PanelFrame>
    );
  }

  if (phase === "no-profile" || phase === "incomplete") {
    return (
      <PanelFrame>
        <UserRoundCheck className="h-6 w-6 text-cyan-200" />
        <h2 className="mt-4 text-2xl font-black">
          {phase === "no-profile"
            ? "Create your crew profile"
            : "Complete your crew profile"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          A professional crew profile is required before it can be shared
          with the verified employer.
        </p>
        {profile?.missingFields.length ? (
          <div className="mt-5 rounded-2xl border border-amber-200/20 bg-amber-100/8 p-4">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-amber-100">
              Complete these fields
            </p>
            <ul className="mt-3 grid gap-2 text-sm text-slate-200">
              {profile.missingFields.map((field) => (
                <li key={field} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-200" />
                  {field}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {notice ? <PanelNotice message={notice} /> : null}
        <Link href="/profile" className={primaryActionClassName}>
          Open my profile
          <ArrowRight className="h-4 w-4" />
        </Link>
      </PanelFrame>
    );
  }

  if (phase === "submitted") {
    return (
      <PanelFrame tone="success">
        <CheckCircle2 className="h-7 w-7 text-emerald-200" />
        <h2 className="mt-4 text-2xl font-black">
          Application submitted
        </h2>
        <p className="mt-3 text-sm leading-6 text-emerald-50/80">
          Your profile and cover note are securely connected to this role.
        </p>
        {application?.submittedAt ? (
          <p
            data-i18n-ignore
            className="mt-4 text-xs font-bold text-emerald-100/70"
          >
            Submitted {formatDate(application.submittedAt)}
          </p>
        ) : null}
        <Link href="/applications" className={primaryActionClassName}>
          Track application
          <ArrowRight className="h-4 w-4" />
        </Link>
      </PanelFrame>
    );
  }

  if (phase === "error") {
    return (
      <PanelFrame>
        <AlertCircle className="h-6 w-6 text-amber-200" />
        <h2 className="mt-4 text-2xl font-black">
          Readiness check unavailable
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {notice || "Please refresh the page and try again."}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={secondaryActionClassName}
        >
          Try again
        </button>
      </PanelFrame>
    );
  }

  const cleanNoteLength = coverNote.trim().length;
  const formReady =
    cleanNoteLength >= COVER_NOTE_MINIMUM_LENGTH &&
    cleanNoteLength <= COVER_NOTE_MAXIMUM_LENGTH &&
    consent;

  return (
    <PanelFrame>
      <Sparkles className="h-6 w-6 text-cyan-200" />
      <h2 className="mt-4 text-2xl font-black">Apply with BlueDeck</h2>
      {profile ? (
        <div className="mt-4 rounded-2xl border border-white/12 bg-white/7 p-4">
          <p
            data-i18n-ignore
            className="font-black text-white"
          >
            {profile.fullName}
          </p>
          <p
            data-i18n-ignore
            className="mt-1 text-xs font-semibold leading-5 text-slate-300"
          >
            {[profile.currentPosition, profile.location]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-3 flex items-center gap-2 text-xs font-bold text-cyan-100">
            <Check className="h-4 w-4" />
            Profile ready to share
          </p>
        </div>
      ) : null}

      <form onSubmit={submitApplication} className="mt-5">
        <label className="block">
          <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-cyan-100">
            <FileUser className="h-4 w-4" />
            Cover note
          </span>
          <textarea
            value={coverNote}
            onChange={(event) =>
              setCoverNote(
                event.target.value.slice(0, COVER_NOTE_MAXIMUM_LENGTH),
              )
            }
            minLength={COVER_NOTE_MINIMUM_LENGTH}
            maxLength={COVER_NOTE_MAXIMUM_LENGTH}
            rows={7}
            placeholder={`Tell the employer why you are a strong fit for ${jobTitle}.`}
            data-i18n-ignore
            className="mt-2 w-full resize-y rounded-xl border border-white/20 bg-white/8 px-3.5 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:bg-white/10 focus:ring-4 focus:ring-cyan-300/10"
          />
        </label>
        <div className="mt-2 flex items-center justify-between gap-3 text-[0.68rem] font-bold text-slate-400">
          <span>Minimum {COVER_NOTE_MINIMUM_LENGTH} characters</span>
          <span data-i18n-ignore>
            {cleanNoteLength}/{COVER_NOTE_MAXIMUM_LENGTH}
          </span>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-white/12 bg-white/6 p-3.5">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400"
          />
          <span className="text-xs leading-5 text-slate-300">
            I consent to share my professional crew profile and this cover
            note with the verified employer for recruitment. See the{" "}
            <Link
              href="/privacy"
              className="font-bold text-cyan-100 underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        {notice ? <PanelNotice message={notice} /> : null}

        <button
          type="submit"
          disabled={!formReady || submitting}
          className={`${primaryActionClassName} disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0`}
        >
          {submitting ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {submitting ? "Submitting…" : "Submit application"}
        </button>
      </form>
    </PanelFrame>
  );
}

function PanelFrame({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success";
}) {
  return (
    <div
      className={`p-6 text-white ${
        tone === "success"
          ? "bg-[radial-gradient(circle_at_90%_10%,rgba(52,211,153,0.22),transparent_16rem),linear-gradient(145deg,#06382f,#075044)]"
          : "bg-[#07182d]"
      }`}
    >
      {children}
    </div>
  );
}

function PanelNotice({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200/20 bg-amber-100/10 p-3 text-xs font-semibold leading-5 text-amber-50"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

const primaryActionClassName =
  "mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-[#07182d] transition hover:-translate-y-0.5 hover:bg-cyan-50";

const secondaryActionClassName =
  "mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-4 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:border-white/40 hover:bg-white/8";

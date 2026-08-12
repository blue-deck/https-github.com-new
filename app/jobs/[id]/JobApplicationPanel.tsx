"use client";

import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  LogIn,
  Send,
  Undo2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  canWithdrawJobApplication,
  isJobApplicationMode,
  isJobApplicationStatus,
  type OwnJobApplication,
} from "../../lib/jobApplications";
import { supabase } from "../../lib/supabase";

type Language = "en" | "tr";

type ApplicationResponse = {
  ok?: boolean;
  error?: string;
  eligible?: boolean;
  role?: string;
  application?: OwnJobApplication | null;
  canWithdraw?: boolean;
  teamApplicationAllowed?: boolean;
  teamMembers?: unknown[];
};

type TeamApplicationMember = {
  relationshipId: string;
  fullName: string;
  currentPosition: string;
  accountRole: "crew" | "captain";
};

type PanelState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "ready"; eligible: boolean; role: string }
  | { kind: "error"; message: string };
type Notice = { tone: "success" | "error"; message: string };

export function JobApplicationPanel({
  jobId,
  language,
}: {
  jobId: string;
  language: Language;
}) {
  const c = copy[language];
  const returnPath = `/jobs/${encodeURIComponent(jobId)}#apply`;
  const loginHref = `/login?next=${encodeURIComponent(returnPath)}`;
  const signupHref = `/login?mode=signup&role=crew&next=${encodeURIComponent(returnPath)}`;
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<PanelState>({ kind: "loading" });
  const [application, setApplication] = useState<OwnJobApplication | null>(null);
  const [coverNote, setCoverNote] = useState("");
  const [applyAsTeam, setApplyAsTeam] = useState(false);
  const [canWithdraw, setCanWithdraw] = useState(false);
  const [teamApplicationAllowed, setTeamApplicationAllowed] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamApplicationMember[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const helpId = useId();

  useEffect(() => {
    let active = true;
    let loadedToken: string | null | undefined;

    async function loadForSession(currentSession: Session | null) {
      if (!active) return;
      const nextToken = currentSession?.access_token || null;
      if (loadedToken === nextToken) return;
      loadedToken = nextToken;
      setSession(currentSession);

      if (!currentSession) {
        setState({ kind: "signed-out" });
        return;
      }

      try {
        const response = await fetch(
          `/api/jobs/${encodeURIComponent(jobId)}/application`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${currentSession.access_token}`,
            },
            cache: "no-store",
          },
        );
        const payload = (await response
          .json()
          .catch(() => null)) as ApplicationResponse | null;

        if (response.status === 401) {
          setState({ kind: "signed-out" });
          return;
        }
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || c.loadError);
        }

        if (!active) return;
        setApplication(parseApplication(payload.application));
        setCanWithdraw(payload.canWithdraw === true);
        setTeamApplicationAllowed(payload.teamApplicationAllowed === true);
        setTeamMembers(parseTeamApplicationMembers(payload.teamMembers));
        setApplyAsTeam(false);
        setState({
          kind: "ready",
          eligible: payload.eligible === true,
          role: typeof payload.role === "string" ? payload.role : "",
        });
      } catch (error) {
        if (!active) return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : c.loadError,
        });
      }
    }

    void supabase.auth.getSession().then(({ data }) =>
      loadForSession(data.session),
    );
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        void loadForSession(nextSession);
      },
    );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [c.loadError, jobId]);

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || submitting || application) return;

    setSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/jobs/${encodeURIComponent(jobId)}/application`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            coverNote: coverNote.trim(),
            applyAsTeam,
          }),
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as ApplicationResponse | null;
      const nextApplication = parseApplication(payload?.application);

      if (!response.ok || !payload?.ok || !nextApplication) {
        throw new Error(payload?.error || c.submitError);
      }

      setApplication(nextApplication);
      setCanWithdraw(true);
      setCoverNote("");
      setNotice({ tone: "success", message: c.submitted });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : c.submitError,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function withdrawApplication() {
    if (
      !session ||
      !application ||
      submitting ||
      !canWithdrawJobApplication(application.status)
    ) {
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/jobs/${encodeURIComponent(jobId)}/application`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "withdraw",
            version: application.version,
          }),
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as ApplicationResponse | null;
      const nextApplication = parseApplication(payload?.application);

      if (
        !response.ok ||
        !payload?.ok ||
        !nextApplication ||
        nextApplication.status !== "withdrawn"
      ) {
        throw new Error(payload?.error || c.withdrawError);
      }

      setApplication(null);
      setCanWithdraw(false);
      setApplyAsTeam(false);
      setNotice({ tone: "success", message: c.withdrawn });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : c.withdrawError,
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <div
        className="mt-5 flex min-h-11 items-center gap-2.5 border-t border-slate-200 pt-5 text-sm font-semibold text-slate-600"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
        {c.loading}
      </div>
    );
  }

  if (state.kind === "signed-out") {
    return (
      <div className="mt-5 border-t border-slate-200 pt-5">
        <Link
          href={loginHref}
          className="bd-focus flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-4 text-sm font-black text-white transition hover:bg-cyan-800"
        >
          <LogIn className="h-4 w-4" aria-hidden />
          {c.signIn}
        </Link>
        <p className="mt-3 text-center text-xs leading-5 text-slate-500">
          {c.newToBlueDeck}{" "}
          <Link
            href={signupHref}
            className="bd-focus inline-flex min-h-10 items-center rounded px-1 font-bold text-cyan-800 underline decoration-cyan-300 underline-offset-4 transition hover:text-cyan-600"
          >
            {c.createProfile}
          </Link>
        </p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div
        className="mt-5 flex items-start gap-2.5 border-t border-slate-200 pt-5 text-sm leading-6 text-rose-700"
        role="alert"
      >
        <AlertCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden />
        <span>{state.message}</span>
      </div>
    );
  }

  if (application) {
    const withdrawable =
      canWithdraw && canWithdrawJobApplication(application.status);
    return (
      <div className="mt-5 border-t border-slate-200 pt-5">
        <div
          className="flex items-start gap-3"
          role="status"
          aria-live="polite"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-500">
              {c.applicationStatus}
            </p>
            <p className="mt-0.5 text-base font-semibold text-slate-950">
              {statusLabel(application.status, language)}
            </p>
            {application.applicationMode === "team_couple" ? (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-cyan-900">
                <UsersRound className="h-3.5 w-3.5" aria-hidden />
                {c.teamApplication}
              </p>
            ) : null}
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {c.statusHelp}
            </p>
          </div>
        </div>
        {withdrawable ? (
          <button
            type="button"
            onClick={() => void withdrawApplication()}
            disabled={submitting}
            aria-busy={submitting}
            className="bd-focus mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-xs font-bold text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Undo2 className="h-4 w-4" aria-hidden />
            )}
            {c.withdraw}
          </button>
        ) : application.applicationMode === "team_couple" &&
          canWithdrawJobApplication(application.status) ? (
          <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
            {c.teamWithdrawHelp}
          </p>
        ) : null}
        {notice ? (
          <p
            className={`mt-3 text-xs font-semibold leading-5 ${notice.tone === "success" ? "text-emerald-800" : "text-rose-700"}`}
            role={notice.tone === "error" ? "alert" : "status"}
          >
            {notice.message}
          </p>
        ) : null}
      </div>
    );
  }

  if (!state.eligible) {
    if (state.role !== "captain") {
      return null;
    }

    return (
      <div
        className="mt-5 flex items-start gap-2.5 border-t border-slate-200 pt-5 text-sm leading-6 text-amber-900"
        role="status"
        aria-live="polite"
      >
        <AlertCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden />
        <span>{c.publisherCannotApply}</span>
      </div>
    );
  }

  return (
    <form
      onSubmit={submitApplication}
      className="mt-5 min-w-0 border-t border-slate-200 pt-5"
    >
      {teamApplicationAllowed && teamMembers.length > 0 ? (
        <fieldset className="mb-4">
          <legend className="text-xs font-bold text-slate-600">
            {c.applicationType}
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <label
              className={`grid min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl border p-3.5 transition focus-within:ring-2 focus-within:ring-cyan-700 focus-within:ring-offset-2 ${
                !applyAsTeam
                  ? "border-cyan-500 bg-cyan-50/70"
                  : "border-slate-200 bg-white hover:border-cyan-300"
              }`}
            >
              <input
                type="radio"
                name="application-type"
                checked={!applyAsTeam}
                onChange={() => setApplyAsTeam(false)}
                disabled={submitting}
                className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-700"
              />
              <span className="min-w-0">
                <span className="flex min-w-0 items-start gap-2 text-sm font-black leading-5 text-[#071f3c]">
                  <UserRound
                    className="mt-0.5 h-4 w-4 shrink-0 text-cyan-800"
                    aria-hidden
                  />
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                    {c.applyIndividually}
                  </span>
                </span>
                <span className="mt-1 block break-words text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">
                  {c.applyIndividuallyHelp}
                </span>
              </span>
            </label>
            <label
              className={`grid min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl border p-3.5 transition focus-within:ring-2 focus-within:ring-cyan-700 focus-within:ring-offset-2 ${
                applyAsTeam
                  ? "border-cyan-500 bg-cyan-50/70"
                  : "border-slate-200 bg-white hover:border-cyan-300"
              }`}
            >
              <input
                type="radio"
                name="application-type"
                checked={applyAsTeam}
                onChange={() => setApplyAsTeam(true)}
                disabled={submitting}
                className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-700"
              />
              <span className="min-w-0">
                <span className="flex min-w-0 items-start gap-2 text-sm font-black leading-5 text-[#071f3c]">
                  <UsersRound
                    className="mt-0.5 h-4 w-4 shrink-0 text-cyan-800"
                    aria-hidden
                  />
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                    {c.applyAsTeam} · {teamMembers.length + 1}
                  </span>
                </span>
                <span className="mt-1 block break-words text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">
                  {c.applyAsTeamHelp}
                </span>
              </span>
            </label>
          </div>
          {applyAsTeam ? (
            <ul className="mt-3 grid gap-2 rounded-xl border border-cyan-100 bg-[#f8fcfd] p-3 sm:grid-cols-2 lg:grid-cols-1">
              {teamMembers.map((member) => (
                <li
                  key={member.relationshipId}
                  className="min-w-0 rounded-lg bg-white px-3 py-2"
                >
                  <p data-i18n-ignore className="truncate text-xs font-black text-[#071f3c]">
                    {member.fullName}
                  </p>
                  <p data-i18n-ignore className="mt-0.5 truncate text-[11px] text-slate-500">
                    {member.currentPosition || member.accountRole}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </fieldset>
      ) : null}
      <label className="block">
        <span className="text-xs font-bold text-slate-600">
          {c.coverNote}
        </span>
        <textarea
          value={coverNote}
          onChange={(event) => setCoverNote(event.target.value.slice(0, 2000))}
          maxLength={2000}
          rows={3}
          disabled={submitting}
          aria-describedby={helpId}
          placeholder={c.coverNotePlaceholder}
          className="bd-focus mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="bd-focus mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-4 text-sm font-black text-white transition hover:bg-cyan-800 disabled:cursor-wait disabled:opacity-60"
      >
        {submitting ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Send className="h-4 w-4" aria-hidden />
        )}
        {submitting
          ? c.applying
          : applyAsTeam
            ? c.applyAsTeamButton
            : c.apply}
      </button>
      <p id={helpId} className="mt-3 text-xs leading-5 text-slate-400">
        {c.applyHelp}
      </p>
      {notice ? (
        <p
          className={`mt-3 text-xs font-semibold leading-5 ${notice.tone === "success" ? "text-emerald-800" : "text-rose-700"}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.message}
        </p>
      ) : null}
    </form>
  );
}

function parseApplication(value: unknown): OwnJobApplication | null {
  if (!isRecord(value)) return null;

  const status = value.status;
  if (
    typeof value.id !== "string" ||
    typeof value.jobPostId !== "string" ||
    !isJobApplicationMode(value.applicationMode) ||
    !isJobApplicationStatus(status) ||
    typeof value.submittedAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    typeof value.version !== "number"
  ) {
    return null;
  }

  return {
    id: value.id,
    jobPostId: value.jobPostId,
    applicationMode: value.applicationMode,
    status,
    coverNote: typeof value.coverNote === "string" ? value.coverNote : "",
    submittedAt: value.submittedAt,
    updatedAt: value.updatedAt,
    withdrawnAt:
      typeof value.withdrawnAt === "string" ? value.withdrawnAt : null,
    version: value.version,
  };
}

function parseTeamApplicationMembers(value: unknown): TeamApplicationMember[] {
  if (!Array.isArray(value) || value.length > 7) return [];
  const members: TeamApplicationMember[] = [];
  for (const item of value) {
    if (!isRecord(item)) return [];
    const relationshipId = textValue(item.relationshipId, 36);
    const fullName = textValue(item.fullName, 120);
    const currentPosition = textValue(item.currentPosition, 120);
    const accountRole = item.accountRole;
    if (
      !/^[0-9a-f-]{36}$/i.test(relationshipId) ||
      !fullName ||
      (accountRole !== "crew" && accountRole !== "captain")
    ) {
      return [];
    }
    members.push({ relationshipId, fullName, currentPosition, accountRole });
  }
  return members;
}

function textValue(value: unknown, maximumLength: number) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return Array.from(normalized).length <= maximumLength ? normalized : "";
}

function statusLabel(status: OwnJobApplication["status"], language: Language) {
  const labels = {
    submitted: { en: "Submitted", tr: "Gönderildi" },
    reviewing: { en: "Under review", tr: "İnceleniyor" },
    shortlisted: { en: "Shortlisted", tr: "Kısa listede" },
    rejected: { en: "Not selected", tr: "Olumsuz sonuçlandı" },
    hired: { en: "Hired", tr: "İşe alındı" },
    withdrawn: { en: "Withdrawn", tr: "Geri çekildi" },
  } as const;
  return labels[status][language];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const copy = {
  en: {
    loading: "Checking your application…",
    loadError: "Your application status could not be loaded.",
    signIn: "Sign in to apply",
    newToBlueDeck: "New to BlueDeck?",
    createProfile: "Create crew account",
    coverNote: "Short note (optional)",
    coverNotePlaceholder:
      "Introduce your relevant experience, availability and interest in this role.",
    apply: "Apply for this role",
    applicationType: "Application type",
    applyIndividually: "Apply individually",
    applyIndividuallyHelp: "Submit only your own BlueDeck profile.",
    applyAsTeam: "Apply as Team/Couple",
    applyAsTeamHelp: "Submit one application with every accepted Team/Couple member.",
    applyAsTeamButton: "Apply as Team/Couple",
    applying: "Applying…",
    applyHelp:
      "Your BlueDeck profile summary is shared securely. Private documents and references are never included.",
    submitError: "Your application could not be submitted.",
    submitted: "Your application has been submitted.",
    applicationStatus: "Your application",
    teamApplication: "Team/Couple application",
    statusHelp: "The employer will update this status inside BlueDeck.",
    withdraw: "Withdraw application",
    teamWithdrawHelp:
      "Only the crew member who submitted this Team/Couple application can withdraw it.",
    withdrawError: "Your application could not be withdrawn.",
    withdrawn: "Your application has been withdrawn. You can apply again now.",
    publisherCannotApply:
      "A Captain cannot apply to a role on a yacht they currently publish or manage for.",
  },
  tr: {
    loading: "Başvuru durumunuz kontrol ediliyor…",
    loadError: "Başvuru durumunuz yüklenemedi.",
    signIn: "Başvurmak için giriş yap",
    newToBlueDeck: "BlueDeck'te yeni misiniz?",
    createProfile: "Crew hesabı oluştur",
    coverNote: "Kısa not (isteğe bağlı)",
    coverNotePlaceholder:
      "Bu pozisyonla ilgili deneyiminizi, müsaitliğinizi ve ilginizi kısaca anlatın.",
    apply: "Bu ilana başvur",
    applicationType: "Başvuru türü",
    applyIndividually: "Bireysel başvur",
    applyIndividuallyHelp: "Yalnızca kendi BlueDeck profilinizi gönderin.",
    applyAsTeam: "Team/Couple olarak başvur",
    applyAsTeamHelp: "Kabul edilmiş tüm Team/Couple üyeleriyle tek başvuru gönderin.",
    applyAsTeamButton: "Team/Couple olarak başvur",
    applying: "Başvuru gönderiliyor…",
    applyHelp:
      "BlueDeck profil özetiniz güvenli biçimde paylaşılır. Özel belgeleriniz ve referanslarınız başvuruya eklenmez.",
    submitError: "Başvurunuz gönderilemedi.",
    submitted: "Başvurunuz gönderildi.",
    applicationStatus: "Başvurunuz",
    teamApplication: "Team/Couple başvurusu",
    statusHelp: "İşveren başvuru durumunu BlueDeck üzerinden güncelleyecek.",
    withdraw: "Başvuruyu geri çek",
    teamWithdrawHelp:
      "Bu Team/Couple başvurusunu yalnızca başvuruyu gönderen mürettebat üyesi geri çekebilir.",
    withdrawError: "Başvurunuz geri çekilemedi.",
    withdrawn: "Başvurunuz geri çekildi. Şimdi yeniden başvurabilirsiniz.",
    publisherCannotApply:
      "Captain hesabı, ilan yayınladığı veya yönettiği yatın kendi ilanına başvuramaz.",
  },
} as const;

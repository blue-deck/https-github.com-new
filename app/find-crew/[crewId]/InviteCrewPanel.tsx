"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bookmark,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Languages,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  MapPin,
  Send,
  ShieldCheck,
  Ship,
  UserRound,
} from "lucide-react";
import {
  CrewCandidateEmployerProfileOverview,
  CrewCandidateProfileBody,
} from "../../components/CrewCandidatePresentation";
import { useLanguage } from "../../components/LanguageProvider";
import type { DiscoverableCrewProfile } from "../../lib/findCrewData";
import { translatePhrase, type Language } from "../../lib/i18n";
import { supabase } from "../../lib/supabase";
import { yachtPositionTitles } from "../../lib/yachtOperations";

type YachtOption = {
  id: string;
  name: string;
};

type HiringYacht = YachtOption & {
  access?: {
    status?: string;
  } | null;
};

type Notice = {
  kind: "error" | "success";
  message: string;
};

export function CrewProfileContent({
  profile,
}: {
  profile: DiscoverableCrewProfile;
}) {
  const { language } = useLanguage();
  const c = copy[language];
  const currentPosition = translatePhrase(profile.currentPosition, language);
  const seekingPositions = (
    profile.seekingPositions.length
      ? profile.seekingPositions
      : [profile.currentPosition]
  ).map((item) => translatePhrase(item, language));
  const contractPreferences = [
    ...profile.discovery.employmentTypes.map((item) =>
      translatePhrase(item, language),
    ),
    ...profile.workPreferences.map((item) => translatePhrase(item, language)),
  ];
  const preferredRegions = (
    profile.discovery.preferredLocations.length
      ? profile.discovery.preferredLocations
      : [profile.location].filter(Boolean)
  ).map((item) => translatePhrase(item, language));

  return (
    <section
      data-i18n-ignore
      aria-labelledby="crew-profile-heading"
      className="border-b border-slate-200 bg-slate-50/70"
    >
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
        <nav aria-label={c.profileNavigation}>
          <Link
            href="/find-crew"
            className="bd-focus inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-cyan-500 hover:text-cyan-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {c.backToSearch}
          </Link>
        </nav>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 lg:p-8">
            <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                {profile.profilePhotoUrl ? (
                  <img
                    src={profile.profilePhotoUrl}
                    alt={c.profilePhoto(profile.fullName)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-cyan-700">
                    <UserRound className="h-10 w-10" aria-hidden />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-cyan-900">
                  <BadgeCheck className="h-4 w-4" aria-hidden />
                  {c.discoverableProfile}
                </p>
                <h1
                  id="crew-profile-heading"
                  className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl"
                >
                  {profile.fullName}
                </h1>
                <p className="mt-2 text-lg font-black text-cyan-800">
                  {currentPosition}
                </p>
              </div>
            </header>

            <dl className="mt-7 grid gap-3 sm:grid-cols-2">
              <ProfileFact
                icon={<MapPin aria-hidden />}
                label={c.currentLocation}
                value={
                  profile.location
                    ? translatePhrase(profile.location, language)
                    : c.flexible
                }
              />
              <ProfileFact
                icon={<CalendarDays aria-hidden />}
                label={c.availability}
                value={
                  profile.discovery.availabilityStatus
                    ? translatePhrase(
                        profile.discovery.availabilityStatus,
                        language,
                      )
                    : c.notSpecified
                }
              />
              <ProfileFact
                icon={<BriefcaseBusiness aria-hidden />}
                label={c.yachtExperience}
                value={
                  profile.experienceYears > 0
                    ? profile.experienceYears < 1
                      ? language === "tr"
                        ? "1 yıldan az"
                        : "Less than 1 year"
                      : `${profile.experienceYears}+ ${c.years}`
                    : c.notSpecified
                }
              />
              <ProfileFact
                icon={<ShieldCheck aria-hidden />}
                label={c.contact}
                value={c.contactProtected}
              />
            </dl>

            {profile.bio ? (
              <section
                aria-labelledby="professional-summary-heading"
                className="mt-8 border-t border-slate-200 pt-7"
              >
                <h2
                  id="professional-summary-heading"
                  className="text-xs font-black uppercase tracking-[0.14em] text-cyan-800"
                >
                  {c.professionalSummary}
                </h2>
                <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
                  {profile.bio}
                </p>
              </section>
            ) : null}

            <div className="mt-8 grid gap-7 border-t border-slate-200 pt-7 md:grid-cols-2">
              <ProfileList
                id="seeking-positions-heading"
                title={c.seekingPositions}
                items={seekingPositions}
                emptyLabel={c.flexible}
              />
              <ProfileList
                id="contract-preferences-heading"
                title={c.contractPreferences}
                items={contractPreferences}
                emptyLabel={c.flexible}
              />
              <ProfileList
                id="preferred-regions-heading"
                title={c.preferredRegions}
                items={preferredRegions}
                emptyLabel={c.flexible}
              />
              <ProfileList
                id="skills-heading"
                title={c.skills}
                items={[
                  ...profile.personalSkills,
                  ...profile.personalCharacteristics,
                ].map((item) => translatePhrase(item, language))}
                emptyLabel={c.notSpecified}
              />
            </div>

            {profile.languages.length > 0 ? (
              <section
                aria-labelledby="languages-heading"
                className="mt-7 border-t border-slate-200 pt-7"
              >
                <h2
                  id="languages-heading"
                  className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-cyan-800"
                >
                  <Languages className="h-4 w-4" aria-hidden />
                  {c.languages}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.languages.map((profileLanguage) => (
                    <span
                      key={`${profileLanguage.name}-${profileLanguage.level}`}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                    >
                      {translatePhrase(profileLanguage.name, language)}
                      {profileLanguage.level
                        ? ` · ${translatePhrase(profileLanguage.level, language)}`
                        : ""}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}
          </article>

          <InviteCrewPanel
            crewId={profile.crewId}
            fullName={profile.fullName}
            defaultPosition={
              profile.seekingPositions[0] || profile.currentPosition
            }
          />
        </div>
      </div>
    </section>
  );
}

export function PublicCrewProfileContent({
  profile,
}: {
  profile: DiscoverableCrewProfile;
}) {
  const { language } = useLanguage();
  const c = copy[language];
  const p = publicProfileCopy[language];

  return (
    <section
      data-i18n-ignore
      aria-labelledby="crew-profile-heading"
      className="border-b border-slate-200 bg-slate-50/70"
    >
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
        <nav aria-label={c.profileNavigation}>
          <Link
            href="/find-crew"
            className="bd-focus inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-cyan-500 hover:text-cyan-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {c.backToSearch}
          </Link>
        </nav>

        <article className="mt-6 overflow-hidden rounded-[26px] border border-white/15 bg-[#f6f9fd] shadow-2xl shadow-slate-950/10 sm:rounded-[34px]">
          <CrewCandidateEmployerProfileOverview
            candidate={profile}
            copy={p}
            kicker={p.candidateProfile}
            titleId="crew-profile-heading"
            premiumLabel={p.premiumProfile}
            roleFallback={p.roleFallback}
            headingLevel="h1"
            reserveTrailingActionSpace={false}
          />

          <CrewCandidateProfileBody
            candidate={profile}
            copy={p}
            variant="public"
            sectionHeadingLevel="h2"
          >
            <section className="rounded-[26px] border border-cyan-100 bg-[linear-gradient(135deg,#ffffff,#edf9fc)] p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-800">
                    {p.crewPortal}
                  </p>
                  <h2 className="mt-2 text-xl font-black text-[#071631]">
                    {p.crewPortalTitle}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {profile.portalAvailable
                      ? p.crewPortalHelp
                      : p.crewPortalUnavailable}
                  </p>
                </div>
                {profile.portalAvailable && profile.publicCrewId ? (
                  <a
                    href={`/crew/${encodeURIComponent(profile.publicCrewId)}/gallery`}
                    target="_blank"
                    rel="noreferrer"
                    className="bd-focus inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#071631] px-5 text-sm font-black text-white shadow-lg shadow-[#071631]/15 transition hover:bg-[#0d3e72]"
                  >
                    {p.openCrewPortal}
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-h-12 shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-200 px-5 text-sm font-black text-slate-500"
                  >
                    <LockKeyhole className="h-4 w-4" aria-hidden />
                    {p.openCrewPortal}
                  </button>
                )}
              </div>
            </section>
            <p className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-xs leading-5 text-cyan-950">
              {p.privacyNote}
            </p>
          </CrewCandidateProfileBody>
        </article>

        <div className="mx-auto mt-6 max-w-xl">
          <InviteCrewPanel
            crewId={profile.crewId}
            fullName={profile.displayName}
            defaultPosition={
              profile.seekingPositions[0] || profile.currentPosition
            }
          />
        </div>
      </div>
    </section>
  );
}

export function InviteCrewPanel({
  crewId,
  fullName,
  defaultPosition,
}: {
  crewId: string;
  fullName: string;
  defaultPosition: string;
}) {
  const { language } = useLanguage();
  const c = copy[language];
  const [loading, setLoading] = useState(true);
  const [accessLoadError, setAccessLoadError] = useState(false);
  const [accessLoadAttempt, setAccessLoadAttempt] = useState(0);
  const [sessionToken, setSessionToken] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [hasOwnedYachts, setHasOwnedYachts] = useState(false);
  const [yachts, setYachts] = useState<YachtOption[]>([]);
  const [selectedYacht, setSelectedYacht] = useState("");
  const [position, setPosition] = useState(
    yachtPositionTitles.includes(defaultPosition)
      ? defaultPosition
      : yachtPositionTitles[0],
  );
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [shortlisted, setShortlisted] = useState(false);
  const [shortlistSaving, setShortlistSaving] = useState(false);
  const [shortlistError, setShortlistError] = useState("");

  const returnPath = useMemo(
    () => `/find-crew/${encodeURIComponent(crewId)}`,
    [crewId],
  );
  const loginHref = useMemo(
    () => `/login?next=${encodeURIComponent(returnPath)}`,
    [returnPath],
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadHiringContext() {
      setLoading(true);
      setAccessLoadError(false);
      setAuthorized(false);
      setHasOwnedYachts(false);
      setYachts([]);
      setSelectedYacht("");

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!active) return;

        if (sessionError) {
          window.location.replace(loginHref);
          return;
        }

        if (!session?.user) {
          setSessionToken("");
          setShortlisted(false);
          return;
        }

        setSessionToken(session.access_token);
        setShortlisted(
          readShortlist(session.user.user_metadata).includes(crewId),
        );

        const response = await fetch("/api/employer-access", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        const result =
          payload && typeof payload === "object"
            ? (payload as Record<string, unknown>)
            : {};

        if (!active) return;

        if (response.status === 401) {
          setSessionToken("");
          window.location.replace(loginHref);
          return;
        }

        if (
          !response.ok ||
          result.ok !== true ||
          !Array.isArray(result.yachts)
        ) {
          throw new Error("employer_access_request_failed");
        }

        const ownedYachts = Array.isArray(result.yachts)
          ? (result.yachts as HiringYacht[])
          : [];
        const nextYachts = ownedYachts
          .filter((yacht) => yacht.access?.status === "verified")
          .map((yacht) => ({ id: yacht.id, name: yacht.name }))
          .filter((yacht) => yacht.id && yacht.name);

        setHasOwnedYachts(ownedYachts.length > 0);
        setAuthorized(nextYachts.length > 0);
        setYachts(nextYachts);
        setSelectedYacht(nextYachts[0]?.id || "");
      } catch (error) {
        if (
          !active ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }

        setAccessLoadError(true);
        setHasOwnedYachts(false);
        setAuthorized(false);
        setYachts([]);
        setSelectedYacht("");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadHiringContext();

    return () => {
      active = false;
      controller.abort();
    };
  }, [accessLoadAttempt, crewId, loginHref]);

  async function toggleShortlist() {
    if (shortlistSaving) return;

    setShortlistError("");
    setShortlistSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = loginHref;
        return;
      }

      if (userError) throw userError;

      const current = readShortlist(user.user_metadata);
      const next = current.includes(crewId)
        ? current.filter((item) => item !== crewId)
        : [...current, crewId];
      const { error } = await supabase.auth.updateUser({
        data: { crew_shortlist: next },
      });

      if (error) throw error;

      setShortlisted(next.includes(crewId));
    } catch {
      setShortlistError(c.shortlistError);
    } finally {
      setShortlistSaving(false);
    }
  }

  async function sendInvitation() {
    if (!sessionToken || !selectedYacht || !position) return;

    setSending(true);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/yachts/${encodeURIComponent(selectedYacht)}/crew-invitations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            crewId,
            position,
          }),
        },
      );
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || !result?.ok) {
        setNotice({
          kind: "error",
          message: invitationErrorMessage(
            result?.error,
            language,
            c.invitationError,
          ),
        });
        return;
      }

      setNotice({
        kind: "success",
        message: c.invitationSent(fullName),
      });
    } catch {
      setNotice({ kind: "error", message: c.connectionError });
    } finally {
      setSending(false);
    }
  }

  if (!sessionToken) return null;

  return (
    <aside
      aria-labelledby="hiring-actions-heading"
      className="lg:sticky lg:top-[calc(var(--public-header-height)+2rem)]"
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#071f3c] text-cyan-200">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </div>
        <h2
          id="hiring-actions-heading"
          className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-slate-950"
        >
          {c.hiringActions}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {c.secureHiringText}
        </p>

        {loading ? (
          <div
            className="mt-5 flex min-h-20 items-center gap-3 rounded-xl bg-slate-50 px-4 text-sm font-bold text-cyan-900"
            role="status"
            aria-live="polite"
          >
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
            {c.checkingAccess}
          </div>
        ) : accessLoadError ? (
          <div className="mt-5">
            <p
              className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-950"
              role="alert"
            >
              {c.accessLoadError}
            </p>
            <button
              type="button"
              onClick={() => setAccessLoadAttempt((current) => current + 1)}
              className="bd-focus mt-3 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#071f3c] px-4 text-sm font-black text-white transition hover:bg-cyan-800"
            >
              {c.tryAgain}
            </button>
          </div>
        ) : !sessionToken ? (
          <Link
            href={loginHref}
            className="bd-focus mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-4 text-sm font-black text-white transition hover:bg-cyan-800"
          >
            <LogIn className="h-4 w-4" aria-hidden />
            {c.logInToContinue}
          </Link>
        ) : !hasOwnedYachts ? (
          <div className="mt-5">
            <p className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950">
              {c.yachtRequired}
            </p>
            <Link
              href="/yachts"
              className="bd-focus mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-4 text-sm font-black text-white transition hover:bg-cyan-800"
            >
              <Ship className="h-4 w-4" aria-hidden />
              {c.openYachtWorkspace}
            </Link>
          </div>
        ) : !authorized ? (
          <div className="mt-5">
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              {c.verificationRequired}
            </p>
            <Link
              href="/hiring"
              className="bd-focus mt-3 flex min-h-12 items-center justify-center rounded-xl bg-[#071f3c] px-4 text-sm font-black text-white transition hover:bg-cyan-800"
            >
              {c.requestHiringAccess}
            </Link>
          </div>
        ) : (
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void sendInvitation();
            }}
          >
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                {c.yacht}
              </span>
              <select
                value={selectedYacht}
                onChange={(event) => setSelectedYacht(event.target.value)}
                disabled={sending}
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 disabled:cursor-wait disabled:opacity-60"
              >
                {yachts.map((yacht) => (
                  <option key={yacht.id} value={yacht.id}>
                    {yacht.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                {c.offeredPosition}
              </span>
              <select
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                disabled={sending}
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 disabled:cursor-wait disabled:opacity-60"
              >
                {yachtPositionTitles.map((item) => (
                  <option key={item} value={item}>
                    {translatePhrase(item, language)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={sending}
              aria-busy={sending}
              className="bd-focus flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-4 text-sm font-black text-white transition hover:bg-cyan-800 disabled:cursor-wait disabled:opacity-60"
            >
              {sending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              {sending ? c.sendingInvitation : c.sendInvitation}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => void toggleShortlist()}
          disabled={shortlistSaving}
          aria-busy={shortlistSaving}
          aria-pressed={shortlisted}
          className={`bd-focus mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition disabled:cursor-wait disabled:opacity-60 ${
            shortlisted
              ? "border-cyan-500 bg-cyan-50 text-cyan-950"
              : "border-slate-300 bg-white text-slate-700 hover:border-cyan-500 hover:text-cyan-950"
          }`}
        >
          {shortlistSaving ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          ) : shortlisted ? (
            <CheckCircle2 className="h-4 w-4" aria-hidden />
          ) : (
            <Bookmark className="h-4 w-4" aria-hidden />
          )}
          {shortlistSaving
            ? c.updatingShortlist
            : shortlisted
              ? c.savedToShortlist
              : c.saveToShortlist}
        </button>

        {shortlistError ? (
          <p
            className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-950"
            role="alert"
          >
            {shortlistError}
          </p>
        ) : null}

        {notice ? (
          <p
            className={`mt-4 rounded-xl border p-4 text-sm leading-6 ${
              notice.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                : "border-rose-200 bg-rose-50 text-rose-950"
            }`}
            role={notice.kind === "success" ? "status" : "alert"}
          >
            {notice.message}
          </p>
        ) : null}

        <nav
          aria-label={c.moreOptions}
          className="mt-5 grid gap-1 border-t border-slate-200 pt-4"
        >
          <Link
            href="/find-crew"
            className="bd-focus flex min-h-11 items-center justify-between rounded-lg px-2 text-sm font-black text-cyan-900 transition hover:bg-cyan-50"
          >
            {c.browseMoreCrew}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/jobs"
            className="bd-focus flex min-h-11 items-center justify-between rounded-lg px-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 hover:text-cyan-900"
          >
            {c.viewOpenRoles}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </nav>
      </div>
    </aside>
  );
}

function ProfileFact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <dt className="flex items-center gap-2 text-cyan-700 [&>svg]:h-4 [&>svg]:w-4">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
          {label}
        </span>
      </dt>
      <dd className="mt-2 font-black text-slate-900">{value}</dd>
    </div>
  );
}

function ProfileList({
  id,
  title,
  items,
  emptyLabel,
}: {
  id: string;
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  const cleanItems = Array.from(new Set(items.filter(Boolean))).slice(0, 10);

  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        className="text-xs font-black uppercase tracking-[0.14em] text-cyan-800"
      >
        {title}
      </h2>
      {cleanItems.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {cleanItems.map((item) => (
            <span
              key={item}
              className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-sm font-semibold text-cyan-950"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{emptyLabel}</p>
      )}
    </section>
  );
}

function invitationErrorMessage(
  error: string | undefined,
  language: Language,
  fallback: string,
) {
  if (!error) return fallback;
  if (language === "en") return error;
  return invitationErrorsTr[error] || fallback;
}

function readShortlist(metadata?: Record<string, unknown>) {
  const value = metadata?.crew_shortlist;
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .slice(0, 100);
}

const invitationErrorsTr: Record<string, string> = {
  "Crew invitation could not be created.": "Ekip daveti oluşturulamadı.",
  "Yacht not found.": "Yat bulunamadı.",
  "Crew invitation service is unavailable.":
    "Ekip daveti hizmeti şu anda kullanılamıyor.",
  "Login session is required.": "Devam etmek için oturum açmanız gerekiyor.",
  "Login session is invalid.":
    "Oturumunuz geçersiz. Lütfen yeniden giriş yapın.",
  "Select a valid yacht position.": "Geçerli bir yat pozisyonu seçin.",
  "Your account is not authorised to invite this position to this yacht.":
    "Hesabınızın bu yata bu pozisyon için davet gönderme yetkisi yok.",
  "Hiring access could not be verified.":
    "İşe alım erişimi doğrulanamadı.",
  "Verified BlueDeck hiring access is required before inviting crew.":
    "Ekip davet etmeden önce doğrulanmış BlueDeck işe alım erişimi gerekir.",
  "No BlueDeck crew profile matches that Crew ID.":
    "Bu Crew ID ile eşleşen bir BlueDeck ekip profili bulunamadı.",
  "No active BlueDeck crew profile matches that Crew ID.":
    "Bu Crew ID ile eşleşen aktif bir BlueDeck crew profili bulunamadı.",
  "This crew profile is not currently available for discovery.":
    "Bu ekip profili şu anda aramalarda görünmüyor.",
  "The Crew ID and email do not match the same crew profile.":
    "Crew ID ile e-posta aynı ekip profiliyle eşleşmiyor.",
  "Crew profile could not be created.": "Ekip profili oluşturulamadı.",
  "Crew profile could not be resolved.": "Ekip profili doğrulanamadı.",
  "A pending invitation already exists for this crew member.":
    "Bu ekip üyesi için bekleyen bir davet zaten var.",
  "This crew member is already active on this yacht.":
    "Bu ekip üyesi bu yatta zaten aktif.",
  "Invalid invitation request.": "Davet isteği geçersiz.",
};

const publicProfileCopy = {
  en: {
    candidateProfile: "Crew profile",
    premiumProfile: "Premium profile",
    roleFallback: "Yacht crew",
    gallery: "Blue Gallery",
    galleryHelp: "Selected professional photos shared by this crew member.",
    galleryPhoto: "gallery photo",
    openGalleryPhoto: "Open gallery photo",
    closeGalleryPhoto: "Close photo preview",
    noGalleryPhotos: "This crew member has not added gallery photos yet.",
    years: "years",
    lessThanOneYear: "Less than 1 year",
    noExperience: "Not added",
    experiences: "Experience",
    references: "References",
    documents: "Documents",
    personalDetails: "Personal details",
    gender: "Gender",
    maritalStatus: "Marital status",
    height: "Height",
    weight: "Weight",
    smoker: "Smoker",
    visibleTattoos: "Visible tattoos",
    nationality: "Nationality",
    location: "Location",
    notProvided: "Not provided",
    professionalSummary: "Professional summary",
    noProfessionalSummary: "No professional summary has been added yet.",
    skillsCharacteristics: "Skills & characteristics",
    skillsHelp:
      "Skills, strengths and career preferences shared by this crew member.",
    skills: "Skills",
    characteristics: "Characteristics",
    seekingPositions: "Seeking positions",
    workPreferences: "Work preferences",
    employmentTypes: "Employment types",
    preferredLocations: "Preferred hiring regions",
    languages: "Languages",
    noLanguages: "No language information has been added yet.",
    teamCouple: "Team/Couple",
    teamCoupleConnected: "Confirmed Team/Couple connection",
    teamCoupleHelp:
      "This crew member has at least one accepted Team/Couple connection. Each crew member remains a separate profile in search results.",
    crewPortal: "Crew Portal / CV",
    crewPortalTitle: "Open this crew member’s public BlueDeck profile",
    crewPortalHelp:
      "This opens the same gallery linked by the CV QR code, with access to the public CV.",
    crewPortalUnavailable:
      "The public Crew Portal is unavailable for this profile.",
    openCrewPortal: "Open Crew Portal / CV",
    privacyNote:
      "Full names, stored contact fields, document files and reference identities are not included here. Photos and selected professional profile fields are public.",
  },
  tr: {
    candidateProfile: "Crew profili",
    premiumProfile: "Premium profil",
    roleFallback: "Yat mürettebatı",
    gallery: "Blue Gallery",
    galleryHelp:
      "Bu crew üyesinin paylaştığı seçilmiş profesyonel fotoğraflar.",
    galleryPhoto: "galeri fotoğrafı",
    openGalleryPhoto: "Galeri fotoğrafını aç",
    closeGalleryPhoto: "Fotoğraf önizlemesini kapat",
    noGalleryPhotos: "Bu crew üyesi henüz galeri fotoğrafı eklememiş.",
    years: "yıl",
    lessThanOneYear: "1 yıldan az",
    noExperience: "Eklenmedi",
    experiences: "Deneyim",
    references: "Referans",
    documents: "Doküman",
    personalDetails: "Kişisel bilgiler",
    gender: "Cinsiyet",
    maritalStatus: "Medeni durum",
    height: "Boy",
    weight: "Kilo",
    smoker: "Sigara kullanımı",
    visibleTattoos: "Görünür dövme",
    nationality: "Uyruk",
    location: "Konum",
    notProvided: "Belirtilmedi",
    professionalSummary: "Profesyonel özet",
    noProfessionalSummary: "Henüz profesyonel özet eklenmemiş.",
    skillsCharacteristics: "Beceriler ve özellikler",
    skillsHelp:
      "Bu crew üyesinin paylaştığı beceriler, güçlü yönler ve kariyer tercihleri.",
    skills: "Beceriler",
    characteristics: "Kişisel özellikler",
    seekingPositions: "Aranan pozisyonlar",
    workPreferences: "Çalışma tercihleri",
    employmentTypes: "Çalışma türleri",
    preferredLocations: "Tercih edilen çalışma bölgeleri",
    languages: "Diller",
    noLanguages: "Henüz dil bilgisi eklenmemiş.",
    teamCouple: "Team/Couple",
    teamCoupleConnected: "Onaylı Team/Couple bağlantısı",
    teamCoupleHelp:
      "Bu crew üyesinin kabul edilmiş en az bir Team/Couple bağlantısı var. Arama sonuçlarında her crew üyesi ayrı profil olarak gösterilir.",
    crewPortal: "Crew Portal / CV",
    crewPortalTitle: "Bu crew üyesinin herkese açık BlueDeck profilini aç",
    crewPortalHelp:
      "CV üzerindeki QR koduyla aynı galeriyi açar ve herkese açık CV’ye erişim sağlar.",
    crewPortalUnavailable:
      "Bu profil için herkese açık Crew Portal kullanılamıyor.",
    openCrewPortal: "Crew Portal / CV’yi aç",
    privacyNote:
      "Tam adlar, kayıtlı iletişim alanları, doküman dosyaları ve referans kimlikleri burada gösterilmez. Fotoğraflar ve seçili profesyonel profil alanları herkese açıktır.",
  },
} as const;

const copy = {
  en: {
    profileNavigation: "Crew profile navigation",
    backToSearch: "Back to crew search",
    profilePhoto: (name: string) => `${name} profile photo`,
    discoverableProfile: "Discoverable BlueDeck profile",
    currentLocation: "Current location",
    availability: "Availability",
    yachtExperience: "Yacht experience",
    years: "years",
    notSpecified: "Not specified",
    flexible: "Flexible",
    contact: "Contact",
    contactProtected: "Shared only after a secure request",
    professionalSummary: "Professional summary",
    seekingPositions: "Seeking positions",
    contractPreferences: "Contract preferences",
    preferredRegions: "Preferred regions",
    skills: "Skills",
    languages: "Languages",
    hiringActions: "Hiring actions",
    secureHiringText:
      "Contact details stay private. Invite this crew member to a verified yacht or save the profile for later.",
    checkingAccess: "Checking hiring access…",
    accessLoadError:
      "Hiring access could not be loaded. Check your connection and try again.",
    tryAgain: "Try again",
    logInToContinue: "Log in to continue",
    yachtRequired:
      "Add a yacht to your workspace before sending an invitation.",
    openYachtWorkspace: "Open yacht workspace",
    verificationRequired:
      "BlueDeck must verify hiring access for this yacht before you can contact crew.",
    requestHiringAccess: "Request hiring access",
    yacht: "Yacht",
    offeredPosition: "Offered position",
    sendingInvitation: "Sending invitation…",
    sendInvitation: "Send yacht invitation",
    updatingShortlist: "Updating shortlist…",
    savedToShortlist: "Saved to shortlist",
    saveToShortlist: "Save to shortlist",
    shortlistError: "The shortlist could not be updated. Please try again.",
    invitationError: "The yacht invitation could not be sent.",
    connectionError:
      "The yacht invitation could not be sent. Check your connection and try again.",
    invitationSent: (name: string) =>
      `Invitation sent to ${name}. It is now waiting in their BlueDeck portal.`,
    moreOptions: "More crew options",
    browseMoreCrew: "Browse more crew",
    viewOpenRoles: "View open roles",
  },
  tr: {
    profileNavigation: "Ekip profili navigasyonu",
    backToSearch: "Ekip aramasına dön",
    profilePhoto: (name: string) => `${name} profil fotoğrafı`,
    discoverableProfile: "Görünür BlueDeck profili",
    currentLocation: "Mevcut konum",
    availability: "Müsaitlik",
    yachtExperience: "Yat deneyimi",
    years: "yıl",
    notSpecified: "Belirtilmedi",
    flexible: "Esnek",
    contact: "İletişim",
    contactProtected: "Yalnızca güvenli talep sonrası paylaşılır",
    professionalSummary: "Profesyonel özet",
    seekingPositions: "Aranan pozisyonlar",
    contractPreferences: "Kontrat tercihleri",
    preferredRegions: "Tercih edilen bölgeler",
    skills: "Beceriler",
    languages: "Diller",
    hiringActions: "İşe alım aksiyonları",
    secureHiringText:
      "İletişim bilgileri gizli kalır. Bu ekip üyesini doğrulanmış bir yata davet edin veya profili daha sonra incelemek üzere kaydedin.",
    checkingAccess: "İşe alım erişimi kontrol ediliyor…",
    accessLoadError:
      "İşe alım erişimi yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.",
    tryAgain: "Tekrar dene",
    logInToContinue: "Devam etmek için giriş yap",
    yachtRequired:
      "Davet göndermeden önce çalışma alanınıza bir yat ekleyin.",
    openYachtWorkspace: "Yat çalışma alanını aç",
    verificationRequired:
      "Ekiple iletişim kurmadan önce bu yat için işe alım erişiminizin BlueDeck tarafından doğrulanması gerekir.",
    requestHiringAccess: "İşe alım erişimi talep et",
    yacht: "Yat",
    offeredPosition: "Teklif edilen pozisyon",
    sendingInvitation: "Davet gönderiliyor…",
    sendInvitation: "Yat daveti gönder",
    updatingShortlist: "Kısa liste güncelleniyor…",
    savedToShortlist: "Kısa listeye kaydedildi",
    saveToShortlist: "Kısa listeye kaydet",
    shortlistError: "Kısa liste güncellenemedi. Lütfen tekrar deneyin.",
    invitationError: "Yat daveti gönderilemedi.",
    connectionError:
      "Yat daveti gönderilemedi. Bağlantınızı kontrol edip tekrar deneyin.",
    invitationSent: (name: string) =>
      `${name} için davet gönderildi. Davet artık BlueDeck portalında bekliyor.`,
    moreOptions: "Diğer ekip seçenekleri",
    browseMoreCrew: "Daha fazla ekip profili incele",
    viewOpenRoles: "Açık pozisyonları görüntüle",
  },
} as const;
